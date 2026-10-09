'use client';
import { useCallback, useEffect, useState } from 'react';
import { sb } from '@/lib/supabase/browser';
import { sanitizeAvatar, saveLocalAvatar } from '@/lib/avatar';
import type { AvatarConfig } from '@/lib/avatar';

export interface Session {
  userId: string;
  nickname: string | null;
  avatar: AvatarConfig | null;
}

/** Sesión anónima de Supabase + apodo y personaje. El histórico queda atado a este usuario. */
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
        const { data: profile } = await client.from('profiles').select('nickname,avatar').eq('id', userId).maybeSingle();
        const avatar = profile?.avatar ? sanitizeAvatar(profile.avatar) : null;
        if (avatar) saveLocalAvatar(avatar);
        if (alive) setSession({ userId, nickname: profile?.nickname ?? null, avatar });
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

  const saveProfile = useCallback(
    async (nickname: string, avatar: AvatarConfig) => {
      if (!session) return;
      const clean = nickname.trim().slice(0, 20);
      const safe = sanitizeAvatar(avatar);
      const { error: e } = await sb().from('profiles').upsert({ id: session.userId, nickname: clean, avatar: safe });
      if (e) throw new Error('No se pudo guardar tu personaje');
      saveLocalAvatar(safe);
      setSession({ ...session, nickname: clean, avatar: safe });
    },
    [session],
  );

  return { session, error, saveProfile };
}
