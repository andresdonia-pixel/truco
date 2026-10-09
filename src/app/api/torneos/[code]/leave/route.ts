import { admin } from '@/lib/supabase/admin';
import { HttpError, handle, requireUser } from '@/lib/server/http';
import { getTournament } from '@/lib/server/torneos';

export const POST = handle(async (req: Request, ctx: RouteContext<'/api/torneos/[code]/leave'>) => {
  const uid = await requireUser(req);
  const { code } = await ctx.params;
  const db = admin();
  const t = await getTournament(db, code);
  if (t.status !== 'waiting') throw new HttpError(409, 'El torneo ya empezó: no te podés bajar.');
  if (t.host === uid) throw new HttpError(409, 'Quien armó el torneo no se puede bajar.');
  await db.from('tournament_entries').delete().eq('tournament_id', t.id).eq('user_id', uid);
});
