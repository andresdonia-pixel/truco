'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { PerfilEditor } from '@/components/PerfilEditor';
import { sanitizeAvatar } from '@/lib/avatar';
import type { AvatarConfig } from '@/lib/avatar';
import { api, sb } from '@/lib/supabase/browser';
import { useSession } from '@/lib/useSession';

interface Torneo {
  id: string;
  code: string;
  name: string;
  host: string;
  size: 4 | 8;
  target: 15 | 30;
  flor: boolean;
  status: 'waiting' | 'playing' | 'finished';
  champion: string | null;
}
interface Perfil {
  id: string;
  nickname: string;
  avatar: AvatarConfig | null;
}
interface Partido {
  round: number;
  idx: number;
  a: string | null;
  b: string | null;
  winner: string | null;
  rooms: { code: string; status: string } | null;
}

const RONDAS: Record<number, string[]> = { 4: ['Semifinal', 'Final'], 8: ['Cuartos', 'Semifinal', 'Final'] };

export default function TorneoPage() {
  const { code: raw } = useParams<{ code: string }>();
  const code = raw.toUpperCase();
  const { session, error: sessionError, saveProfile } = useSession();
  const [t, setT] = useState<Torneo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [inscriptos, setInscriptos] = useState<string[]>([]);
  const [perfiles, setPerfiles] = useState<Record<string, Perfil>>({});
  const [partidos, setPartidos] = useState<Partido[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const client = sb();
    const { data, error } = await client.from('tournaments').select('*').eq('code', code).maybeSingle();
    if (error) return setNotFound(true);
    if (!data) return setNotFound(true);
    const torneo = data as Torneo;
    setT(torneo);
    const [{ data: ent }, { data: mts }] = await Promise.all([
      client.from('tournament_entries').select('user_id, profiles(id,nickname,avatar)').eq('tournament_id', torneo.id).order('joined_at'),
      client.from('tournament_matches').select('round,idx,a,b,winner,rooms(code,status)').eq('tournament_id', torneo.id).order('round').order('idx'),
    ]);
    const rows = (ent ?? []) as unknown as { user_id: string; profiles: { id: string; nickname: string; avatar: unknown } | null }[];
    setInscriptos(rows.map((r) => r.user_id));
    setPerfiles(
      Object.fromEntries(
        rows.filter((r) => r.profiles).map((r) => [r.user_id, { id: r.user_id, nickname: r.profiles!.nickname, avatar: r.profiles!.avatar ? sanitizeAvatar(r.profiles!.avatar) : null }]),
      ),
    );
    setPartidos((mts ?? []) as unknown as Partido[]);
  }, [code]);

  useEffect(() => {
    if (!session) return;
    load();
    const id = setInterval(load, 4000); // la llave cambia poco: alcanza con mirar cada tanto
    return () => clearInterval(id);
  }, [session, load]);

  async function call(path: string) {
    setBusy(true);
    setMsg(null);
    try {
      await api(`/api/torneos/${code}/${path}`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Algo salió mal');
    } finally {
      setBusy(false);
    }
  }

  if (sessionError) return <Centro>No pudimos conectarte: {sessionError}</Centro>;
  if (!session) return <Centro>Buscando el torneo…</Centro>;
  if (!session.nickname)
    return (
      <Centro>
        <PerfilEditor onSave={saveProfile} />
      </Centro>
    );
  if (notFound)
    return (
      <Centro>
        <p className="text-xl">No existe un torneo con el código {code}.</p>
        <Link href="/torneo" className="mt-4 inline-block underline">Armar uno</Link>
      </Centro>
    );
  if (!t) return <Centro>Buscando el torneo…</Centro>;

  const anotado = inscriptos.includes(session.userId);
  const isHost = t.host === session.userId;
  const link = typeof window !== 'undefined' ? `${window.location.origin}/torneo/${t.code}` : '';
  const quien = (id: string | null) => (id ? perfiles[id] : null);
  const miPartido = partidos.find((p) => !p.winner && p.rooms && (p.a === session.userId || p.b === session.userId));
  const campeon = quien(t.champion);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="font-mano text-3xl font-bold">Truco</Link>
        <span className="rounded-full bg-pano-osc/70 px-3 py-1 text-sm">
          {t.size} jugadores, partidos a {t.target}
          {t.flor ? ', con flor' : ''} · <span className="font-mano tracking-widest">{t.code}</span>
        </span>
      </header>

      <h1 className="font-mano text-5xl font-bold leading-none">{t.name}</h1>

      {t.status === 'finished' && campeon && (
        <section className="canto flex items-center gap-5 rounded-3xl bg-papel p-6 text-tinta shadow-[3px_5px_0_rgba(0,0,0,.35)]">
          <Trofeo />
          <Avatar avatar={campeon.avatar} size={84} />
          <div>
            <p className="font-mano text-4xl font-bold leading-none">¡{campeon.nickname} campeón!</p>
            <p className="mt-1 text-lg">Se llevó la copa del torneo.</p>
          </div>
        </section>
      )}

      {miPartido && (
        <Link
          href={`/sala/${miPartido.rooms!.code}`}
          className="flex items-center justify-between gap-4 rounded-3xl bg-rojo px-6 py-4 text-xl font-bold shadow-[0_4px_0_rgba(0,0,0,.4)]"
        >
          <span>Te toca jugar contra {quien(miPartido.a === session.userId ? miPartido.b : miPartido.a)?.nickname}</span>
          <span className="rounded-xl bg-claro px-4 py-1.5 text-tinta">Ir a la mesa</span>
        </Link>
      )}

      {t.status === 'waiting' && (
        <section className="flex flex-col gap-4 rounded-3xl bg-pano-osc/60 p-6">
          <h2 className="text-2xl font-bold">
            Anotados {inscriptos.length} de {t.size}
          </h2>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Array.from({ length: t.size }, (_, i) => {
              const p = quien(inscriptos[i] ?? null);
              return (
                <li key={i} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${p ? 'bg-pano-claro/70' : 'border-2 border-dashed border-claro/30'}`}>
                  {p ? (
                    <>
                      <Avatar avatar={p.avatar} size={36} />
                      <span className="truncate font-semibold">{p.nickname}</span>
                    </>
                  ) : (
                    <span className="text-claro/50">Lugar libre</span>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap gap-2">
            <code className="min-w-0 flex-1 truncate rounded-xl bg-pano-osc/70 px-4 py-2.5">{link}</code>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                } catch {
                  /* sin portapapeles */
                }
              }}
              className="rounded-xl bg-oro px-4 py-2.5 font-bold text-tinta"
            >
              {copied ? 'Copiado' : 'Copiar link'}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {!anotado && (
              <button disabled={busy || inscriptos.length >= t.size} onClick={() => call('join')} className="rounded-2xl bg-rojo px-6 py-3 text-xl font-bold disabled:opacity-50">
                Anotarme
              </button>
            )}
            {anotado && !isHost && (
              <button disabled={busy} onClick={() => call('leave')} className="text-claro/80 underline underline-offset-4">
                Bajarme del torneo
              </button>
            )}
            {isHost && (
              <button
                disabled={busy || inscriptos.length !== t.size}
                onClick={() => call('start')}
                className="rounded-2xl bg-rojo px-6 py-3 text-xl font-bold shadow-[0_4px_0_rgba(0,0,0,.4)] disabled:opacity-50"
              >
                Sortear las llaves
              </button>
            )}
            {isHost && inscriptos.length !== t.size && <p className="text-claro/70">Faltan {t.size - inscriptos.length} para sortear.</p>}
            {!isHost && anotado && <p className="text-claro/70">Cuando esté completo, sortea quien armó el torneo.</p>}
          </div>
          {msg && <p className="text-[#ffb4a8]">{msg}</p>}
        </section>
      )}

      {partidos.length > 0 && (
        <section aria-label="Llaves" className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-6">
            {RONDAS[t.size].map((nombre, r) => (
              <div key={r} className="flex w-60 flex-col justify-around gap-4">
                <h2 className="text-center font-mano text-2xl font-bold">{nombre}</h2>
                {partidos
                  .filter((p) => p.round === r)
                  .map((p) => (
                    <div key={p.idx} className="flex flex-col gap-1 rounded-2xl bg-papel p-2 text-tinta shadow-[2px_3px_0_rgba(0,0,0,.35)]">
                      {[p.a, p.b].map((id, k) => {
                        const pf = quien(id);
                        const gano = id && p.winner === id;
                        const perdio = id && p.winner && p.winner !== id;
                        return (
                          <div
                            key={k}
                            className={`flex items-center gap-2 rounded-xl px-2 py-1 ${gano ? 'bg-oro/60 font-bold' : ''} ${perdio ? 'opacity-45 line-through' : ''}`}
                          >
                            {pf ? <Avatar avatar={pf.avatar} size={30} /> : <span className="h-[30px] w-[30px] rounded-full border-2 border-dashed border-tinta/30" />}
                            <span className="truncate">{pf?.nickname ?? 'A definir'}</span>
                          </div>
                        );
                      })}
                      {p.rooms && !p.winner &&
                        (p.a === session.userId || p.b === session.userId ? (
                          <Link href={`/sala/${p.rooms.code}`} className="mt-1 text-center text-sm font-semibold underline">
                            Ir a tu mesa
                          </Link>
                        ) : (
                          <p className="mt-1 text-center text-sm">{p.rooms.status === 'playing' ? 'Se está jugando' : 'Por empezar'}</p>
                        ))}
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function Trofeo() {
  return (
    <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden className="shrink-0">
      <path d="M18 8h28v14c0 9-6 16-14 16S18 31 18 22z" fill="#c9a227" stroke="#7a5e0f" strokeWidth="2" />
      <path d="M18 12H9c0 8 4 13 10 14M46 12h9c0 8-4 13-10 14" fill="none" stroke="#7a5e0f" strokeWidth="3" strokeLinecap="round" />
      <rect x="28" y="38" width="8" height="10" fill="#c9a227" stroke="#7a5e0f" strokeWidth="2" />
      <rect x="20" y="48" width="24" height="8" rx="2" fill="#5a3420" />
      <path d="M26 16l2 4 4 .6-3 3 .7 4.4L26 26l-3.7 2 .7-4.4-3-3 4-.6z" fill="#fff8d6" opacity="0.8" />
    </svg>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-10">{children}</main>;
}
