import 'server-only';
import { IllegalMove } from '@/engine/engine.ts';
import { admin } from '@/lib/supabase/admin';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireUser(req: Request): Promise<string> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Necesitás una sesión para jugar. Recargá la página.');
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Tu sesión venció. Recargá la página.');
  return data.user.id;
}

type Handler<C> = (req: Request, ctx: C) => Promise<unknown>;

export function handle<C>(fn: Handler<C>) {
  return async (req: Request, ctx: C) => {
    try {
      return Response.json((await fn(req, ctx)) ?? { ok: true });
    } catch (e) {
      if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
      if (e instanceof IllegalMove) return Response.json({ error: 'Esa jugada no vale ahora.' }, { status: 400 });
      console.error(e);
      return Response.json({ error: 'Error del servidor' }, { status: 500 });
    }
  };
}
