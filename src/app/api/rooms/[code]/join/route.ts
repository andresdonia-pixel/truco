import { admin } from '@/lib/supabase/admin';
import { HttpError, handle, requireUser } from '@/lib/server/http';
import { getRoom, getSeats } from '@/lib/server/rooms';

/** Sentarse en la sala (o cambiar de asiento mientras se espera). */
export const POST = handle(async (req: Request, ctx: RouteContext<'/api/rooms/[code]/join'>) => {
  const uid = await requireUser(req);
  const { code } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const db = admin();
  const room = await getRoom(db, code);
  if (room.status !== 'waiting') throw new HttpError(409, 'La partida ya empezó.');

  const { data: profile } = await db.from('profiles').select('id').eq('id', uid).maybeSingle();
  if (!profile) throw new HttpError(400, 'Elegí un apodo antes de sentarte.');

  const seats = await getSeats(db, room.id);
  const taken = new Set(seats.map((s) => s.seat));
  const free = Array.from({ length: room.players }, (_, i) => i).filter((i) => !taken.has(i));
  const wanted = typeof body.seat === 'number' ? body.seat : free[0];
  if (wanted === undefined) throw new HttpError(409, 'La mesa está completa.');
  if (!free.includes(wanted)) throw new HttpError(409, 'Ese lugar está ocupado.');

  const mine = seats.find((s) => s.user_id === uid);
  const { error } = mine
    ? await db.from('room_players').update({ seat: wanted }).eq('room_id', room.id).eq('user_id', uid)
    : await db.from('room_players').insert({ room_id: room.id, seat: wanted, user_id: uid });
  if (error?.code === '23505') throw new HttpError(409, 'Ese lugar se acaba de ocupar.');
  if (error) throw error;
  return { seat: wanted };
});
