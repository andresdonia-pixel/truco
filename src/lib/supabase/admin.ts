import 'server-only';
import { createClient } from '@supabase/supabase-js';

/** Cliente con la secret key: sólo en el servidor. Lee y escribe `games`, que ningún jugador puede ver. */
export function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export type Admin = ReturnType<typeof admin>;
