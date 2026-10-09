'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { Action, PlayerView } from '@/engine/engine.ts';
import { Anotador } from '@/components/Anotador';
import { Avatar } from '@/components/Avatar';
import { PerfilEditor } from '@/components/PerfilEditor';
import { Chat } from '@/components/Chat';
import { Mesa, type Jugador } from '@/components/Mesa';
import { api, sb } from '@/lib/supabase/browser';
import { useSession } from '@/lib/useSession';
import { sanitizeAvatar } from '@/lib/avatar';
import { Toast } from '@/components/Toast';
import { Resumen } from '@/components/Resumen';
import { SonidoToggle } from '@/components/SonidoToggle';
import { fetchRacha } from '@/lib/racha';
import { useZumbido } from '@/lib/useZumbido';
import { useMesaSocial } from '@/lib/useMesaSocial';
import { prepararSonido } from '@/lib/zumbido';

interface Room {
  id: string;
  code: string;
  host: string;
  players: 2 | 4 | 6;
  target: 15 | 30;
  flor: boolean;
  status: 'waiting' | 'playing' | 'finished' | 'abandoned';
  tournament_id?: string | null;
}

const FORMATO = { 2: 'Mano a mano', 4: 'Dos contra dos', 6: 'Tres contra tres' } as const;

export default function Sala() {
  const { code: rawCode } = useParams<{ code: string }>();
  const code = rawCode.toUpperCase();
  const { session, error: sessionError, saveProfile } = useSession();
  const [room, setRoom] = useState<Room | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [players, setPlayers] = useState<Jugador[]>([]);
  const [view, setView] = useState<PlayerView | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [torneo, setTorneo] = useState<{ code: string; name: string } | null>(null);

  const loadRoom = useCallback(async () => {
    let { data, error } = await sb().from('rooms').select('*, tournaments(code,name)').eq('code', code).maybeSingle();
    // base sin la migración de torneos: la sala anda igual, sin el dato del torneo
    if (error) ({ data } = await sb().from('rooms').select('*').eq('code', code).maybeSingle());
    if (!data) setNotFound(true);
    else {
      const { tournaments, ...r } = data as Room & { tournaments?: { code: string; name: string } | null };
      setRoom(r);
      setTorneo(tournaments ?? null);
    }
  }, [code]);

  const loadPlayers = useCallback(async (roomId: string) => {
    const { data } = await sb()
      .from('room_players')
      .select('seat,user_id,profiles(nickname,avatar)')
      .eq('room_id', roomId)
      .order('seat');
    setPlayers(
      ((data ?? []) as unknown as { seat: number; user_id: string; profiles: { nickname: string; avatar: unknown } | null }[]).map((r) => ({
        seat: r.seat,
        user_id: r.user_id,
        nickname: r.profiles?.nickname ?? 'Sin apodo',
        avatar: r.profiles?.avatar ? sanitizeAvatar(r.profiles.avatar) : null,
      })),
    );
  }, []);

  const loadView = useCallback(async (roomId: string, userId: string) => {
    const { data } = await sb().from('game_views').select('view').eq('room_id', roomId).eq('user_id', userId).maybeSingle();
    setView((data?.view as PlayerView) ?? null);
  }, []);

  useEffect(() => {
    if (session) loadRoom();
  }, [session, loadRoom]);

  // tiempo real: sala, jugadores y mi vista de la partida
  useEffect(() => {
    if (!room?.id || !session) return;
    const client = sb();
    loadPlayers(room.id);
    loadView(room.id, session.userId);
    const channel = client
      .channel(`sala-${room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, (p) => {
        if (p.new && 'id' in p.new) setRoom(p.new as Room);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_players', filter: `room_id=eq.${room.id}` }, () =>
        loadPlayers(room.id),
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_views', filter: `room_id=eq.${room.id}` }, (p) => {
        const row = p.new as { user_id?: string; view?: PlayerView };
        if (row?.user_id === session.userId && row.view) setView(row.view);
      })
      .subscribe();
    // las bajas de jugadores no siempre llegan filtradas: refresco suave mientras se espera
    const poll = setInterval(() => loadPlayers(room.id), 6000);
    return () => {
      clearInterval(poll);
      client.removeChannel(channel);
    };
  }, [room?.id, session, loadPlayers, loadView]);

  // si la sala pasa a "jugando", traigo mi vista por si el evento llegó antes que la suscripción
  useEffect(() => {
    if (room?.status === 'playing' && session && room.id) loadView(room.id, session.userId);
  }, [room?.status, room?.id, session, loadView]);

  const mySeat = session ? (players.find((p) => p.user_id === session.userId)?.seat ?? null) : null;
  const zumbido = useZumbido(room?.id, mySeat, players);
  const social = useMesaSocial(room?.id, session?.userId, mySeat, players);
  const [racha, setRacha] = useState<number | null>(null);
  const gameOver = view?.winner ?? null;
  useEffect(() => {
    if (gameOver === null || !session) return setRacha(null);
    // el histórico se graba apenas después de la última jugada
    const t = setTimeout(() => fetchRacha(session.userId).then(setRacha), 1500);
    return () => clearTimeout(t);
  }, [gameOver, session]);

  async function call(path: string, body: unknown = {}) {
    prepararSonido();
    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/rooms/${code}/${path}`, body);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Algo salió mal');
    } finally {
      setBusy(false);
    }
  }

  const act = (action: Action) => call('action', { action });

  if (sessionError) return <Centro>No pudimos conectarte: {sessionError}</Centro>;
  if (!session) return <Centro>Preparando la mesa…</Centro>;
  if (!session.nickname)
    return (
      <Centro>
        <PerfilEditor onSave={saveProfile} />
      </Centro>
    );
  if (notFound)
    return (
      <Centro>
        <p className="text-xl">No existe una sala con el código {code}.</p>
        <Link href="/" className="mt-4 inline-block underline">Volver al inicio</Link>
      </Centro>
    );
  if (!room) return <Centro>Buscando la sala…</Centro>;

  const me = players.find((p) => p.user_id === session.userId);
  const isHost = room.host === session.userId;
  const full = players.length === room.players;
  const link = typeof window !== 'undefined' ? `${window.location.origin}/sala/${room.code}` : '';
  const teamNames: [string, string] = view ? (view.team === 0 ? ['Nosotros', 'Ellos'] : ['Ellos', 'Nosotros']) : ['Equipo 1', 'Equipo 2'];

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  const header = (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/" className="font-mano text-3xl font-bold">Truco</Link>
      <div className="flex items-center gap-2 text-sm">
        <span className="rounded-full bg-pano-osc/70 px-3 py-1">
          {FORMATO[room.players]}, a {room.target}
          {room.flor ? ', con flor' : ''}
        </span>
        {torneo && (
          <Link href={`/torneo/${torneo.code}`} className="rounded-full bg-oro px-3 py-1 font-semibold text-tinta">
            Torneo: {torneo.name}
          </Link>
        )}
        <span className="rounded-full bg-pano-osc/70 px-3 py-1 font-mano text-base tracking-widest">{room.code}</span>
        <Link href="/como-jugar" target="_blank" className="rounded-full bg-pano-osc/70 px-3 py-1 text-sm">Reglas</Link>
        <SonidoToggle />
      </div>
    </header>
  );

  // ---------- esperando jugadores ----------
  if (room.status === 'waiting' || (room.status !== 'playing' && !view)) {
    const seatsOf = (team: number) => Array.from({ length: room.players }, (_, i) => i).filter((s) => s % 2 === team);
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-6">
        {header}
        <section className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold">{full ? 'Mesa completa' : 'Esperando jugadores'}</h1>
          <p className="text-claro/80">Pasales este link para que se sienten:</p>
          <div className="flex flex-wrap gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-pano-osc/70 px-4 py-2.5">{link}</code>
            <button onClick={copiar} className="rounded-xl bg-oro px-4 py-2.5 font-bold text-tinta">
              {copied ? 'Copiado' : 'Copiar link'}
            </button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((team) => (
            <div key={team} className="rounded-3xl bg-pano-osc/60 p-5">
              <h2 className="mb-3 text-xl font-bold">{room.players > 2 ? `Equipo ${team + 1}` : `Jugador ${team + 1}`}</h2>
              <ul className="flex flex-col gap-2">
                {seatsOf(team).map((seat) => {
                  const p = players.find((x) => x.seat === seat);
                  return (
                    <li key={seat}>
                      {p ? (
                        <div className="flex items-center justify-between rounded-xl bg-pano-claro/70 px-4 py-2.5">
                          <span className="flex items-center gap-2.5 font-semibold">
                            <Avatar avatar={p.avatar} size={36} />
                            {p.nickname}
                          </span>
                          <span className="text-sm text-claro/70">
                            {p.user_id === session.userId ? 'vos' : ''}
                            {p.user_id === room.host ? (p.user_id === session.userId ? ', armó la mesa' : 'armó la mesa') : ''}
                          </span>
                        </div>
                      ) : (
                        <button
                          disabled={busy || room.status !== 'waiting'}
                          onClick={() => call('join', { seat })}
                          className="w-full rounded-xl border-2 border-dashed border-claro/40 px-4 py-2.5 text-left text-claro/80 hover:border-oro hover:text-claro"
                        >
                          {me ? 'Cambiarme acá' : 'Sentarme acá'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>

        <div className="flex flex-wrap items-center gap-3">
          {isHost && (
            <button
              disabled={!full || busy}
              onClick={() => call('start')}
              className="rounded-2xl bg-rojo px-6 py-3 text-xl font-bold shadow-[0_4px_0_rgba(0,0,0,.4)] disabled:opacity-50"
            >
              Repartir
            </button>
          )}
          {!isHost && me && <p className="text-claro/80">Cuando esté la mesa completa, reparte quien la armó.</p>}
          {me && !torneo && (
            <button disabled={busy} onClick={() => call('leave')} className="rounded-xl px-4 py-2 text-claro/80 underline underline-offset-4">
              Levantarme
            </button>
          )}
          {isHost && !full && <p className="text-claro/70">Faltan {room.players - players.length} para repartir.</p>}
        </div>
        {msg && <p className="text-[#ffb4a8]">{msg}</p>}
        {me && <Chat roomId={room.id} userId={session.userId} myTeam={me.seat % 2} teamChat={room.players > 2} players={players} />}
      </main>
    );
  }

  // ---------- partida ----------
  if (!me || !view) {
    return (
      <Centro>
        <p className="text-xl">Esta partida ya empezó y no estás sentado en la mesa.</p>
        <Link href="/" className="mt-4 inline-block underline">Armar otra mesa</Link>
      </Centro>
    );
  }

  const finished = view.winner !== null;

  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 gap-5 px-3 py-4 lg:grid-cols-[230px_1fr_300px] lg:px-6">
      <Toast toast={zumbido.toast} />
      <div className="lg:col-span-3">{header}</div>

      <aside className="order-2 flex flex-col gap-4 lg:order-1">
        <Anotador nosotros={view.score[view.team]} ellos={view.score[1 - view.team]} target={view.config.target} />
      </aside>

      <section className="order-1 flex flex-col gap-4 lg:order-2">
        <p className="flex justify-center gap-3 font-mano text-xl lg:hidden" aria-hidden>
          <span className="rounded-full bg-papel px-3 text-tinta">Nosotros {view.score[view.team]}</span>
          <span className="rounded-full bg-papel px-3 text-tinta">Ellos {view.score[1 - view.team]}</span>
        </p>
        {finished ? (
          <div className="canto flex flex-col items-center gap-4 rounded-3xl bg-papel p-8 text-center text-tinta">
            <p className="font-mano text-5xl font-bold">{view.winner === view.team ? '¡Ganamos!' : 'Perdimos'}</p>
            <p className="text-lg">
              {view.score[view.team]} a {view.score[1 - view.team]}. La partida quedó en el ranking.
            </p>
            <Resumen stats={view.stats} team={view.team} ganador={view.winner} players={players} racha={view.winner === view.team ? racha : null} />
            {torneo ? (
              <Link href={`/torneo/${torneo.code}`} className="rounded-2xl bg-rojo px-6 py-3 text-xl font-bold text-claro">
                Volver al torneo
              </Link>
            ) : isHost ? (
              <button onClick={() => call('start')} disabled={busy} className="rounded-2xl bg-rojo px-6 py-3 text-xl font-bold text-claro">
                Jugar la revancha
              </button>
            ) : (
              <p>Si quieren revancha, la reparte quien armó la mesa.</p>
            )}
            <Link href="/ranking" className="underline">Ver el ranking</Link>
          </div>
        ) : (
          <Mesa view={view} players={players} busy={busy} onAction={act} onZumbido={zumbido.mandar} zumbidoListo={zumbido.listo} burbujas={social.burbujas} senas={social.senas} onFrase={social.decir} onSena={social.hacerSena} />
        )}
        {msg && <p className="text-center text-[#ffb4a8]" role="alert">{msg}</p>}
      </section>

      <aside className="order-3">
        <Chat roomId={room.id} userId={session.userId} myTeam={me.seat % 2} teamChat={room.players > 2} players={players} />
      </aside>
      <span className="sr-only">{teamNames.join(' contra ')}</span>
    </main>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">{children}</main>;
}
