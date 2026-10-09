import { admin } from '@/lib/supabase/admin';
import { HttpError, handle, requireUser } from '@/lib/server/http';

export const POST = handle(async (req: Request) => {
  const uid = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? '').trim().slice(0, 40);
  if (name.length < 2) throw new HttpError(400, 'Ponele un nombre al torneo.');
  const size = body.size === 8 ? 8 : 4;
  const target = body.target === 15 ? 15 : 30;
  const flor = Boolean(body.flor);
  const db = admin();
  const { data: profile } = await db.from('profiles').select('id').eq('id', uid).maybeSingle();
  if (!profile) throw new HttpError(400, 'Elegí un apodo antes de armar un torneo.');
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: t, error } = await db.from('tournaments').insert({ name, host: uid, size, target, flor }).select('id,code').single();
    if (error?.code === '23505') continue;
    if (error) throw error;
    const { error: e2 } = await db.from('tournament_entries').insert({ tournament_id: t.id, user_id: uid });
    if (e2) throw e2;
    return { code: t.code };
  }
  throw new HttpError(500, 'No se pudo generar un código de torneo.');
});
