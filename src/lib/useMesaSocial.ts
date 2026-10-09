'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { sb } from '@/lib/supabase/browser';
import { SENA_PREFIX, esSena, senaDe } from '@/lib/social';
import type { Gesto } from '@/lib/social';
import { sonar } from '@/lib/sonidos';

interface Persona {
  seat: number;
  user_id: string;
}

const BURBUJA_MS = 4500;
const SENA_MS = 3500;

/**
 * Globitos de chat y señas sobre los personajes.
 * Se apoya en la tabla `messages`: las señas van por el canal de equipo, y la RLS
 * hace que Realtime sólo se las entregue a los compañeros. Los rivales nunca las reciben.
 */
export function useMesaSocial(roomId: string | undefined, userId: string | undefined, mySeat: number | null, players: Persona[]) {
  const [burbujas, setBurbujas] = useState<Record<number, string>>({});
  const [senas, setSenas] = useState<Record<number, Gesto>>({});
  const playersRef = useRef(players);
  playersRef.current = players;

  const mostrar = useCallback(<T,>(set: React.Dispatch<React.SetStateAction<Record<number, T>>>, seat: number, value: T, ms: number) => {
    set((prev) => ({ ...prev, [seat]: value }));
    setTimeout(() => set((prev) => (prev[seat] === value ? Object.fromEntries(Object.entries(prev).filter(([k]) => Number(k) !== seat)) : prev) as Record<number, T>), ms);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const client = sb();
    const channel = client
      .channel(`social-${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, (p) => {
        const m = p.new as { user_id: string; body: string };
        const seat = playersRef.current.find((x) => x.user_id === m.user_id)?.seat;
        if (seat === undefined) return;
        if (esSena(m.body)) {
          const g = senaDe(m.body);
          if (g) mostrar(setSenas, seat, g, SENA_MS);
        } else {
          mostrar(setBurbujas, seat, m.body, BURBUJA_MS);
          if (m.user_id !== userId) sonar('mensaje');
        }
      })
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [roomId, userId, mostrar]);

  const decir = useCallback(
    async (text: string) => {
      if (!roomId || !userId) return;
      await sb().from('messages').insert({ room_id: roomId, user_id: userId, channel: 'all', team: null, body: text.slice(0, 300) });
    },
    [roomId, userId],
  );

  const hacerSena = useCallback(
    async (g: Gesto) => {
      if (!roomId || !userId || mySeat === null) return;
      await sb()
        .from('messages')
        .insert({ room_id: roomId, user_id: userId, channel: 'team', team: mySeat % 2, body: SENA_PREFIX + g });
    },
    [roomId, userId, mySeat],
  );

  return { burbujas, senas, decir, hacerSena };
}
