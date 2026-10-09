'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ToastData } from '@/components/Toast';
import { sb } from '@/lib/supabase/browser';
import type { AvatarConfig } from '@/lib/avatar';
import { ZUMBIDO_COOLDOWN_MS, prepararSonido, recibirZumbido } from './zumbido';

interface Persona {
  seat: number;
  nickname: string;
  avatar?: AvatarConfig | null;
}

interface Payload {
  from: number;
  to: number[];
}

/**
 * Zumbidos de una sala por Realtime broadcast: no pasan por la base.
 * Es sólo un aviso cosmético, así que alcanza con el límite del lado del cliente.
 */
export function useZumbido(roomId: string | undefined, mySeat: number | null, players: Persona[]) {
  const [toast, setToast] = useState<ToastData | null>(null);
  const [listo, setListo] = useState(true);
  const channelRef = useRef<ReturnType<ReturnType<typeof sb>['channel']> | null>(null);
  const playersRef = useRef(players);
  const lastReceived = useRef(0);
  playersRef.current = players;

  const mostrar = useCallback((t: Omit<ToastData, 'id'>) => {
    const id = Date.now();
    setToast({ ...t, id });
    setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), 3500);
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const client = sb();
    const channel = client
      .channel(`zumbido-${roomId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'zumbido' }, ({ payload }) => {
        const p = payload as Payload;
        if (typeof p?.from !== 'number' || !Array.isArray(p.to)) return;
        const from = playersRef.current.find((x) => x.seat === p.from);
        const nombre = from?.nickname ?? 'Alguien';
        if (mySeat !== null && p.to.includes(mySeat)) {
          if (Date.now() - lastReceived.current < 4000) return; // no más de uno cada 4 s
          lastReceived.current = Date.now();
          recibirZumbido();
          mostrar({ text: `¡${nombre} te mandó un zumbido!`, avatar: from?.avatar ?? null, fuerte: true });
        } else {
          const a = playersRef.current.find((x) => x.seat === p.to[0]);
          mostrar({ text: `${nombre} le mandó un zumbido a ${p.to.length > 1 ? 'los rivales' : a?.nickname ?? 'alguien'}`, avatar: from?.avatar ?? null });
        }
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      client.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, mySeat, mostrar]);

  const mandar = useCallback(
    (to: number[]) => {
      if (!listo || mySeat === null || !channelRef.current) return;
      prepararSonido();
      void channelRef.current.send({ type: 'broadcast', event: 'zumbido', payload: { from: mySeat, to } satisfies Payload });
      const destino = to.length > 1 ? 'los rivales' : playersRef.current.find((x) => x.seat === to[0])?.nickname ?? 'tu rival';
      mostrar({ text: `Le mandaste un zumbido a ${destino}` });
      setListo(false);
      setTimeout(() => setListo(true), ZUMBIDO_COOLDOWN_MS);
    },
    [listo, mySeat, mostrar],
  );

  return { toast, mandar, listo };
}
