import { applyAction } from '@/engine/engine.ts';
import type { Action, GameState } from '@/engine/engine.ts';
import { admin } from '@/lib/supabase/admin';
import { HttpError, handle, requireUser } from '@/lib/server/http';
import { commitMove, getRoom, getSeats } from '@/lib/server/rooms';

export const POST = handle(async (req: Request, ctx: RouteContext<'/api/rooms/[code]/action'>) => {
  const uid = await requireUser(req);
  const { code } = await ctx.params;
  const { action } = (await req.json().catch(() => ({}))) as { action?: Action };
  if (!action || typeof action.type !== 'string') throw new HttpError(400, 'Jugada inválida.');
  const db = admin();
  const room = await getRoom(db, code);
  if (room.status !== 'playing') throw new HttpError(409, 'No hay una partida en juego.');
  const seats = await getSeats(db, room.id);
  const me = seats.find((s) => s.user_id === uid);
  if (!me) throw new HttpError(403, 'No estás sentado en esta mesa.');

  // si dos jugadas llegan a la vez, la segunda se reaplica sobre el estado nuevo
  for (let attempt = 0; attempt < 4; attempt++) {
    const { data: game, error } = await db.from('games').select('state,version').eq('room_id', room.id).single();
    if (error) throw error;
    const prev = game.state as GameState;
    const next = applyAction(prev, me.seat, action);
    if (await commitMove(db, room, seats, prev, next, game.version)) return { ok: true };
  }
  throw new HttpError(409, 'La mesa cambió mientras jugabas. Probá de nuevo.');
});
