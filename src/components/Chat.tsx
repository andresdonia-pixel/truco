'use client';
import { useEffect, useRef, useState } from 'react';
import { sb } from '@/lib/supabase/browser';
import type { Jugador } from './Mesa';

interface Message {
  id: number;
  user_id: string;
  channel: 'all' | 'team';
  team: number | null;
  body: string;
  created_at: string;
}

interface Props {
  roomId: string;
  userId: string;
  myTeam: number | null;
  teamChat: boolean;
  players: Jugador[];
}

export function Chat({ roomId, userId, myTeam, teamChat, players }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [tab, setTab] = useState<'all' | 'team'>('all');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [unread, setUnread] = useState<{ all: number; team: number }>({ all: 0, team: 0 });
  const listRef = useRef<HTMLDivElement>(null);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  useEffect(() => {
    const client = sb();
    let alive = true;
    client
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(80)
      .then(({ data }) => alive && data && setMessages((data as Message[]).reverse()));
    const channel = client
      .channel(`chat-${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` }, (p) => {
        const m = p.new as Message;
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev.slice(-150), m]));
        if (m.channel !== tabRef.current) setUnread((u) => ({ ...u, [m.channel]: u[m.channel] + 1 }));
      })
      .subscribe();
    return () => {
      alive = false;
      client.removeChannel(channel);
    };
  }, [roomId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, tab]);

  const visible = messages.filter((m) => m.channel === tab);
  const nameOf = (uid: string) => players.find((p) => p.user_id === uid)?.nickname ?? 'Alguien';

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setError(null);
    const { error: err } = await sb()
      .from('messages')
      .insert({ room_id: roomId, user_id: userId, channel: tab, team: tab === 'team' ? myTeam : null, body: body.slice(0, 300) });
    if (err) setError('No se pudo enviar el mensaje.');
    else setText('');
  }

  const tabs: ['all' | 'team', string][] = teamChat && myTeam !== null ? [['all', 'Mesa'], ['team', 'Equipo']] : [['all', 'Mesa']];

  return (
    <section className="flex h-80 flex-col rounded-2xl bg-pano-osc/70 lg:h-full lg:min-h-[420px]" aria-label="Chat">
      <div className="flex gap-1 border-b border-claro/15 p-1.5" role="tablist">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => {
              setTab(id);
              setUnread((u) => ({ ...u, [id]: 0 }));
            }}
            className={`rounded-lg px-3 py-1 text-sm font-semibold ${tab === id ? 'bg-claro text-pano-osc' : 'text-claro/80'}`}
          >
            {label}
            {unread[id] > 0 && tab !== id && <span className="ml-1.5 rounded-full bg-rojo px-1.5 text-xs text-claro">{unread[id]}</span>}
          </button>
        ))}
        {tab === 'team' && <span className="self-center pl-2 text-xs text-claro/60">sólo lo ve tu compañero</span>}
      </div>
      <div ref={listRef} className="flex-1 space-y-1.5 overflow-y-auto p-3 text-sm">
        {visible.length === 0 && (
          <p className="text-claro/60">{tab === 'team' ? 'Pasale señas a tu compañero acá.' : 'Saludá a la mesa.'}</p>
        )}
        {visible.map((m) => (
          <p key={m.id} className={m.user_id === userId ? 'text-oro' : ''}>
            <span className="font-semibold">{nameOf(m.user_id)}:</span> {m.body}
          </p>
        ))}
      </div>
      <form onSubmit={send} className="flex gap-2 border-t border-claro/15 p-2">
        <label htmlFor="chat-input" className="sr-only">Mensaje</label>
        <input
          id="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          placeholder={tab === 'team' ? 'Mensaje al compañero' : 'Mensaje a la mesa'}
          className="min-w-0 flex-1 rounded-lg bg-claro px-3 py-1.5 text-tinta placeholder:text-tinta/50"
        />
        <button type="submit" className="rounded-lg bg-oro px-3 py-1.5 font-semibold text-tinta">
          Enviar
        </button>
      </form>
      {error && <p className="px-3 pb-2 text-xs text-rojo">{error}</p>}
    </section>
  );
}
