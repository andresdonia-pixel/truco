import { createGame } from '@/engine/engine.ts';
import { admin } from '@/lib/supabase/admin';
import { HttpError, handle, requireUser } from '@/lib/server/http';
import { getRoom, getSeats, startGame } from '@/lib/server/rooms';

/** Repartir la primera mano. También sirve para la revancha cuando la partida terminó. */
export const POST = handle(async (req: Request, ctx: RouteContext<'/api/rooms/[code]/start'>) => {
  const uid = await requireUser(req);
  const { code } = await ctx.params;
  const db = admin();
  const room = await getRoom(db, code);
  if (room.host !== uid) throw new HttpError(403, 'Sólo quien creó la sala puede empezar.');
  if (room.status === 'playing') throw new HttpError(409, 'La partida ya está en juego.');
  if (room.tournament_id && room.status === 'finished') throw new HttpError(409, 'Es un partido de torneo: no hay revancha.');
  const seats = await getSeats(db, room.id);
  if (seats.length !== room.players) throw new HttpError(409, 'Falta gente en la mesa.');
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  const state = createGame({ players: room.players, target: room.target, flor: room.flor }, seed);
  await startGame(db, room, seats, state);
});
