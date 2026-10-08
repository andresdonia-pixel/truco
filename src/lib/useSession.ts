'use client';
import { useCallback, useEffect, useState } from 'react';
import { sb } from '@/lib/supabase/browser';

export interface Session {
  userId: string;
  nickname: string | null;
}

/** Sesión anónima de Supabase + apodo. El histórico queda atado a este usuario. */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const client = sb();
        let { data } = await client.auth.getSession();
        if (!data.session) {
          const res = await client.auth.signInAnonymously();
          if (res.error) throw res.error;
          data = { session: res.data.session! };
        }
        const userId = data.session!.user.id;
        const { data: profile } = await client.from('profiles').select('nickname').eq('id', userId).maybeSingle();
        if (alive) setSession({ userId, nickname: profile?.nickname ?? null });
      } catch (e) {
        const text = e instanceof Error ? e.message : '';
        if (alive)
          setError(
            /fetch|network/i.test(text)
              ? 'no hay conexión con el servidor. Revisá tu internet y recargá la página.'
              : text || 'no se pudo iniciar la sesión.',
          );
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const saveNickname = useCallback(
    async (nickname: string) => {
      if (!session) return;
      const clean = nickname.trim().slice(0, 20);
      const { error: e } = await sb().from('profiles').upsert({ id: session.userId, nickname: clean });
      if (e) throw new Error('No se pudo guardar el apodo');
      setSession({ ...session, nickname: clean });
    },
    [session],
  );

  return { session, error, saveNickname };
}
