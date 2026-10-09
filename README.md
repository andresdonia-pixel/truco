# Truco online

Truco argentino multijugador (1v1, 2v2 y 3v3) en tiempo real, con chat general y de equipo, y un histórico de puntos.

**Stack:** Next.js (App Router) + Supabase (Postgres, Realtime, Anonymous Auth) + Vercel.

## Estado

- [x] Motor de reglas (`src/engine/`): puro, determinístico, testeado
- [x] Esquema de base y RLS (`supabase/schema.sql`), validado contra Postgres
- [x] App Next.js: inicio con apodo, sala con link, mesa, chat general y de equipo, ranking
- [x] Endpoints del servidor que aplican jugadas (`src/app/api/rooms`)
- [x] Proyecto Supabase + deploy en Vercel: https://truco-livid.vercel.app
- [x] Modo contra la máquina (`/maquina`, bot en `src/engine/bot.ts`), 1v1, 2v2 y 3v3, corre en el navegador y no suma al ranking
- [x] Truco de a 6 (3 contra 3), envido por equipo (sin pica-pica). Base existente: correr `supabase/migrations_002_truco_de_6.sql`
- [x] Mesa con las cartas jugadas delante de cada jugador; la mano anterior queda visible hasta la primera carta nueva
- [x] Personajes: cara, piel, pelo, barba, ojos, labios y fondo, dibujados en SVG propio (`src/components/Avatar.tsx`); abren la boca cuando cantan. Base existente: correr `supabase/migrations_003_avatar.sql`
- [x] Zumbido estilo MSN para apurar al que tiene que jugar (Realtime broadcast, sin tocar la base): sacude la pantalla, suena y vibra. Contra la máquina, El Mago te zumba si tardás
- [x] Estadísticas al final de cada partida (manos, bazas, trucos, envidos, flores, mazos, mejores envidos) y racha de victorias
- [x] Sonidos de mesa sintetizados con Web Audio (carta, barajar, canto, victoria) y botón de silencio
- [x] Frases rápidas: globitos sobre el personaje; la máquina también comenta la partida
- [x] Señas del truco en el personaje. Viajan por el canal de equipo (RLS), así que los rivales nunca las reciben. El compañero máquina hace señas al repartir
- [x] Cómo se juega (`/como-jugar`): reglas para quien nunca jugó, con las cartas dibujadas. En la mesa: tu envido calculado, explicación de cada canto y acceso a las reglas
- [x] Torneos de 4 u 8, mano a mano, con llaves y salas automáticas. Base existente: correr `supabase/migrations_004_torneos.sql`

## Correr local

```bash
cp .env.example .env.local   # completar con las claves de Supabase
npm install
npm run dev
npm test   # 21 tests: reglas puntuales + ~1.400 partidas simuladas en 1v1 y 2v2
```

## Arquitectura

```
Cliente (Next.js)                    Servidor (route handler)                 Supabase
─────────────────                    ────────────────────────                 ────────
botón "Truco" ──POST /api/rooms/:id/action──▶ valida JWT y asiento
                                     lee games.state (service role)
                                     applyAction(state, seat, action)   ──▶ games (sólo servidor)
                                     viewFor(state, seat) por asiento   ──▶ game_views (RLS: sólo tu fila)
mesa se actualiza ◀───────────── Realtime (postgres_changes) ◀────────────── game_views
chat ◀──────────────────────────────────────────── Realtime ◀──────────── messages (RLS por equipo)
```

- **Las cartas nunca viajan al rival.** El estado completo vive en `games`, que no tiene políticas de lectura. Cada jugador recibe sólo su `PlayerView`.
- **Concurrencia:** `games.version` se usa como control optimista. Si dos jugadas llegan juntas, la segunda se rechaza y se reintenta.
- **Identidad:** login anónimo de Supabase y un apodo. El histórico queda atado a ese usuario. Más adelante se puede vincular Google para no perderlo al cambiar de dispositivo.
- **Histórico:** al terminar una partida, el servidor inserta en `matches` y `match_players`. La vista `leaderboard` arma el ranking.

## Reglas implementadas

| Tema | Decisión |
|---|---|
| Equipos | Asientos alternados: pares contra impares (en 2v2, 0 y 2 contra 1 y 3; en 3v3, 0-2-4 contra 1-3-5). La mano rota cada ronda. |
| Truco de a 6 | Envido por equipo como en el de a 4, sin pica-pica. |
| Pardas | Parda en primera: define segunda. Parda en segunda o tercera: gana quien ganó primera. Todo pardas: gana la mano. Después de una parda, sale quien abrió esa baza. |
| Truco | Truco 2, retruco 3, vale cuatro 4. No querido vale el nivel anterior. Sólo sube quien tiene el quiero. |
| Envido | Envido, envido, real envido y falta, con "el envido está primero" ante un truco en primera. Empate: gana el más cercano a la mano. |
| Falta envido | Lo que le falta al que va ganando. A 30 y en las malas, gana el partido. |
| Flor (opcional) | 3 puntos y anula el envido. Si el rival tiene flor: me achico (4), contraflor (6) o contraflor al resto (falta). |
| Mazo | El rival suma lo que vale la mano. En primera, sin envido cantado, +1. |
| Respuestas en equipo | Cualquiera del equipo rival puede responder un canto. |

Las reglas regionales varían. Cualquier ajuste es un cambio chico en `engine.ts` más su test.
