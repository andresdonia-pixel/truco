import { admin } from '@/lib/supabase/admin';
import { HttpError, handle, requireUser } from '@/lib/server/http';
import { getTournament, startTournament } from '@/lib/server/torneos';

/** Sortea las llaves y abre las salas de la primera ronda. */
export const POST = handle(async (req: Request, ctx: RouteContext<'/api/torneos/[code]/start'>) => {
  const uid = await requireUser(req);
  const { code } = await ctx.params;
  const db = admin();
  const t = await getTournament(db, code);
  if (t.host !== uid) throw new HttpError(403, 'Sólo quien armó el torneo puede sortear las llaves.');
  if (t.status !== 'waiting') throw new HttpError(409, 'El torneo ya empezó.');
  const { data: entries } = await db.from('tournament_entries').select('user_id').eq('tournament_id', t.id);
  if ((entries?.length ?? 0) !== t.size) throw new HttpError(409, `Faltan jugadores: son ${t.size}.`);
  await startTournament(db, t, entries!.map((e) => e.user_id));
});
