import { admin } from '@/lib/supabase/admin';
import { HttpError, handle, requireUser } from '@/lib/server/http';
import { getTournament } from '@/lib/server/torneos';

export const POST = handle(async (req: Request, ctx: RouteContext<'/api/torneos/[code]/join'>) => {
  const uid = await requireUser(req);
  const { code } = await ctx.params;
  const db = admin();
  const t = await getTournament(db, code);
  if (t.status !== 'waiting') throw new HttpError(409, 'El torneo ya empezó.');
  const { data: profile } = await db.from('profiles').select('id').eq('id', uid).maybeSingle();
  if (!profile) throw new HttpError(400, 'Elegí un apodo antes de anotarte.');
  const { count } = await db.from('tournament_entries').select('*', { count: 'exact', head: true }).eq('tournament_id', t.id);
  if ((count ?? 0) >= t.size) throw new HttpError(409, 'El torneo ya está completo.');
  const { error } = await db.from('tournament_entries').insert({ tournament_id: t.id, user_id: uid });
  if (error?.code === '23505') return { ok: true }; // ya estaba anotado
  if (error) throw error;
});
