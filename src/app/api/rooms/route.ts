import { admin } from '@/lib/supabase/admin';
import { HttpError, handle, requireUser } from '@/lib/server/http';

export const POST = handle(async (req: Request) => {
  const uid = await requireUser(req);
  const body = await req.json().catch(() => ({}));
  const players = body.players === 4 ? 4 : 2;
  const target = body.target === 15 ? 15 : 30;
  const flor = Boolean(body.flor);
  const db = admin();

  const { data: profile } = await db.from('profiles').select('id').eq('id', uid).maybeSingle();
  if (!profile) throw new HttpError(400, 'Elegí un apodo antes de crear una sala.');

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: room, error } = await db
      .from('rooms')
      .insert({ host: uid, players, target, flor })
      .select('id,code')
      .single();
    if (error?.code === '23505') continue; // código repetido, otro intento
    if (error) throw error;
    const { error: e2 } = await db.from('room_players').insert({ room_id: room.id, seat: 0, user_id: uid });
    if (e2) throw e2;
    return { code: room.code };
  }
  throw new HttpError(500, 'No se pudo generar un código de sala.');
});
