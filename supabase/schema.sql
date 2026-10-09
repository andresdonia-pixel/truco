-- Truco online — esquema Supabase
-- Identidad: Supabase Anonymous Auth (apodo, sin contraseña). Más adelante se puede vincular Google
-- a la misma cuenta y el histórico se conserva.
-- Seguridad: el estado completo de la partida (con las cartas de todos) vive en `games`, sin acceso
-- para clientes. Cada jugador sólo puede leer su fila de `game_views`, que el servidor escribe
-- con viewFor(). Realtime respeta RLS, así que nadie recibe la mano ajena.

create extension if not exists pgcrypto;

-- ---------- perfiles ----------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(nickname) between 2 and 20),
  avatar jsonb check (avatar is null or (jsonb_typeof(avatar) = 'object' and pg_column_size(avatar) < 600)),
  created_at timestamptz not null default now()
);

-- ---------- salas ----------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6)),
  host uuid not null references public.profiles (id),
  players smallint not null check (players in (2, 4, 6)),
  target smallint not null check (target in (15, 30)),
  flor boolean not null default false,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished', 'abandoned')),
  created_at timestamptz not null default now()
);

create table public.room_players (
  room_id uuid not null references public.rooms (id) on delete cascade,
  seat smallint not null check (seat between 0 and 5),
  user_id uuid not null references public.profiles (id),
  team smallint generated always as (seat % 2) stored,
  joined_at timestamptz not null default now(),
  primary key (room_id, seat),
  unique (room_id, user_id)
);

-- ---------- estado de juego ----------
create table public.games (
  room_id uuid primary key references public.rooms (id) on delete cascade,
  state jsonb not null, -- GameState completo: SÓLO servidor (service role)
  version integer not null default 0, -- control optimista de concurrencia
  updated_at timestamptz not null default now()
);

create table public.game_views (
  room_id uuid not null references public.rooms (id) on delete cascade,
  seat smallint not null,
  user_id uuid not null references public.profiles (id),
  view jsonb not null, -- PlayerView de ese asiento
  version integer not null,
  primary key (room_id, seat)
);

-- ---------- chat ----------
create table public.messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  channel text not null check (channel in ('all', 'team')),
  team smallint check (team in (0, 1)),
  body text not null check (char_length(body) between 1 and 300),
  created_at timestamptz not null default now(),
  check ((channel = 'team') = (team is not null))
);
create index messages_room_idx on public.messages (room_id, created_at);

-- ---------- histórico ----------
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms (id) on delete set null,
  players smallint not null,
  target smallint not null,
  flor boolean not null,
  winner_team smallint not null,
  score smallint[] not null,
  hands_played integer not null,
  finished_at timestamptz not null default now()
);

create table public.match_players (
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  seat smallint not null,
  team smallint not null,
  won boolean not null,
  points_for smallint not null,
  points_against smallint not null,
  primary key (match_id, user_id)
);
create index match_players_user_idx on public.match_players (user_id);

create view public.leaderboard with (security_invoker = true) as
select
  p.id as user_id,
  p.nickname,
  count(mp.*)::int as played,
  count(mp.*) filter (where mp.won)::int as won,
  coalesce(sum(mp.points_for), 0)::int as points_for,
  coalesce(sum(mp.points_against), 0)::int as points_against,
  round(100.0 * count(mp.*) filter (where mp.won) / nullif(count(mp.*), 0), 1) as win_pct,
  p.avatar
from public.profiles p
join public.match_players mp on mp.user_id = p.id
group by p.id, p.nickname, p.avatar;

-- ---------- helpers para RLS ----------
create function public.is_member(r uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from room_players where room_id = r and user_id = auth.uid());
$$;

create function public.my_team(r uuid) returns smallint
language sql stable security definer set search_path = public as $$
  select team from room_players where room_id = r and user_id = auth.uid();
$$;

-- ---------- RLS ----------
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.games enable row level security; -- sin políticas: nadie salvo service role
alter table public.game_views enable row level security;
alter table public.messages enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;

create policy "perfiles visibles" on public.profiles for select using (true);
create policy "crear mi perfil" on public.profiles for insert with check (id = auth.uid());
create policy "editar mi perfil" on public.profiles for update using (id = auth.uid());

-- salas: se ven por código para poder unirse; crear/unirse/arrancar pasa por el servidor
create policy "salas visibles" on public.rooms for select using (true);
create policy "jugadores visibles" on public.room_players for select using (true);

create policy "mi vista" on public.game_views for select using (user_id = auth.uid());

create policy "leer chat" on public.messages for select using (
  public.is_member(room_id) and (channel = 'all' or team = public.my_team(room_id))
);
create policy "escribir chat" on public.messages for insert with check (
  user_id = auth.uid()
  and public.is_member(room_id)
  and (channel = 'all' or team = public.my_team(room_id))
);

create policy "histórico visible" on public.matches for select using (true);
create policy "histórico jugadores visible" on public.match_players for select using (true);

-- ---------- realtime ----------
alter publication supabase_realtime add table public.game_views, public.messages, public.room_players, public.rooms;
-- Torneos entre amigos: llaves de 4 u 8 jugadores, mano a mano, eliminación directa.
-- Todo lo escribe el servidor (secret key); los clientes sólo leen.

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 6)),
  name text not null check (char_length(name) between 2 and 40),
  host uuid not null references public.profiles (id),
  size smallint not null check (size in (4, 8)),
  target smallint not null check (target in (15, 30)),
  flor boolean not null default false,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  champion uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table if not exists public.tournament_entries (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  joined_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);

create table if not exists public.tournament_matches (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  round smallint not null check (round between 0 and 2),
  idx smallint not null check (idx between 0 and 3),
  a uuid references public.profiles (id),
  b uuid references public.profiles (id),
  room_id uuid references public.rooms (id) on delete set null,
  winner uuid references public.profiles (id),
  primary key (tournament_id, round, idx)
);

alter table public.rooms add column if not exists tournament_id uuid references public.tournaments (id) on delete set null;

alter table public.tournaments enable row level security;
alter table public.tournament_entries enable row level security;
alter table public.tournament_matches enable row level security;

drop policy if exists "torneos visibles" on public.tournaments;
create policy "torneos visibles" on public.tournaments for select using (true);
drop policy if exists "inscriptos visibles" on public.tournament_entries;
create policy "inscriptos visibles" on public.tournament_entries for select using (true);
drop policy if exists "llaves visibles" on public.tournament_matches;
create policy "llaves visibles" on public.tournament_matches for select using (true);
