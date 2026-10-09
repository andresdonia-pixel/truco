-- Personaje de cada jugador (cara, pelo, barba, ojos, labios, colores) como JSON chico.
alter table public.profiles add column if not exists avatar jsonb
  check (avatar is null or (jsonb_typeof(avatar) = 'object' and pg_column_size(avatar) < 600));

create or replace view public.leaderboard with (security_invoker = true) as
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
