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
