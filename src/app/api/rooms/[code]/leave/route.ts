import { admin } from '@/lib/supabase/admin';
import { HttpError, handle, requireUser } from '@/lib/server/http';
import { getRoom, getSeats } from '@/lib/server/rooms';

export const POST = handle(async (req: Request, ctx: RouteContext<'/api/rooms/[code]/leave'>) => {
  const uid = await requireUser(req);
  const { code } = await ctx.params;
  const db = admin();
  const room = await getRoom(db, code);
  if (room.status === 'playing') throw new HttpError(409, 'No podés levantarte en medio de una partida.');
  if (room.tournament_id) throw new HttpError(409, 'Es un partido de torneo: no te podés levantar.');
  await db.from('room_players').delete().eq('room_id', room.id).eq('user_id', uid);
  const rest = await getSeats(db, room.id);
  if (rest.length === 0) await db.from('rooms').update({ status: 'abandoned' }).eq('id', room.id);
  else if (room.host === uid) await db.from('rooms').update({ host: rest[0].user_id }).eq('id', room.id);
});
