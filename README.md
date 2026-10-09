# Truco online

Truco argentino multijugador (1v1 y 2v2) en tiempo real, con chat general y de equipo, y un histórico de puntos.

**Stack:** Next.js (App Router) + Supabase (Postgres, Realtime, Anonymous Auth) + Vercel.

## Estado

- [x] Motor de reglas (`src/engine/`): puro, determinístico, testeado
- [x] Esquema de base y RLS (`supabase/schema.sql`), validado contra Postgres
- [x] App Next.js: inicio con apodo, sala con link, mesa, chat general y de equipo, ranking
- [x] Endpoints del servidor que aplican jugadas (`src/app/api/rooms`)
- [x] Proyecto Supabase + deploy en Vercel: https://truco-livid.vercel.app
- [x] Modo contra la máquina (`/maquina`, bot en `src/engine/bot.ts`), 1v1 y 2v2, corre en el navegador y no suma al ranking

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
| Equipos 2v2 | Asientos alternados: 0 y 2 contra 1 y 3. La mano rota cada ronda. |
| Pardas | Parda en primera: define segunda. Parda en segunda o tercera: gana quien ganó primera. Todo pardas: gana la mano. Después de una parda, sale quien abrió esa baza. |
| Truco | Truco 2, retruco 3, vale cuatro 4. No querido vale el nivel anterior. Sólo sube quien tiene el quiero. |
| Envido | Envido, envido, real envido y falta, con "el envido está primero" ante un truco en primera. Empate: gana el más cercano a la mano. |
| Falta envido | Lo que le falta al que va ganando. A 30 y en las malas, gana el partido. |
| Flor (opcional) | 3 puntos y anula el envido. Si el rival tiene flor: me achico (4), contraflor (6) o contraflor al resto (falta). |
| Mazo | El rival suma lo que vale la mano. En primera, sin envido cantado, +1. |
| Respuestas en 2v2 | Cualquiera del equipo rival puede responder un canto. |

Las reglas regionales varían. Cualquier ajuste es un cambio chico en `engine.ts` más su test.
