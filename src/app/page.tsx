'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Apodo } from '@/components/Apodo';
import { Carta } from '@/components/Carta';
import { api, sb } from '@/lib/supabase/browser';
import { useSession } from '@/lib/useSession';

interface Stats {
  played: number;
  won: number;
  points_for: number;
}

export default function Home() {
  const { session, error, saveNickname } = useSession();
  const router = useRouter();
  const [players, setPlayers] = useState<2 | 4 | 6>(2);
  const [target, setTarget] = useState<15 | 30>(30);
  const [flor, setFlor] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!session?.nickname) return;
    sb()
      .from('leaderboard')
      .select('played,won,points_for')
      .eq('user_id', session.userId)
      .maybeSingle()
      .then(({ data }) => setStats(data as Stats | null));
  }, [session]);

  async function crear() {
    setBusy(true);
    setMsg(null);
    try {
      const { code } = await api<{ code: string }>('/api/rooms', { players, target, flor });
      router.push(`/sala/${code}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'No se pudo crear la sala');
      setBusy(false);
    }
  }

  function unirme(e: React.FormEvent) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean.length >= 4) router.push(`/sala/${clean}`);
  }

  const option = (active: boolean) =>
    `rounded-xl px-4 py-2 font-semibold transition ${active ? 'bg-claro text-pano-osc' : 'bg-pano-osc/60 text-claro/80'}`;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-10">
      <header className="flex items-end justify-between gap-6">
        <div>
          <h1 className="font-mano text-7xl font-bold leading-none tracking-tight sm:text-8xl">Truco</h1>
          <p className="mt-2 max-w-sm text-lg text-claro/85">
            Armá una mesa, pasale el link a los tuyos y jugá de a dos, de a cuatro o de a seis.
          </p>
        </div>
        <div className="hidden shrink-0 sm:flex" aria-hidden>
          <span className="-mr-6 rotate-[-12deg]"><Carta id="1e" size="lg" /></span>
          <span className="-mr-6 translate-y-2"><Carta id="1b" size="lg" /></span>
          <span className="rotate-[12deg] translate-y-6"><Carta id="7e" size="lg" /></span>
        </div>
      </header>

      {error && <p className="rounded-xl bg-rojo/80 p-4">No pudimos conectarte: {error}</p>}
      {!session && !error && <p className="text-claro/70">Preparando la mesa…</p>}

      {session && (!session.nickname || editing) && (
        <section className="rounded-3xl bg-pano-osc/60 p-6">
          <Apodo
            initial={session.nickname ?? ''}
            onSave={async (n) => {
              await saveNickname(n);
              setEditing(false);
            }}
          />
        </section>
      )}

      {session?.nickname && !editing && (
        <>
          <p className="text-lg">
            Jugás como <strong>{session.nickname}</strong>.{' '}
            <button onClick={() => setEditing(true)} className="underline decoration-claro/40 underline-offset-4">
              Cambiar apodo
            </button>
            {stats && (
              <span className="block text-base text-claro/75">
                {stats.played} partidas, {stats.won} ganadas, {stats.points_for} puntos hechos.
              </span>
            )}
          </p>

          <section className="grid gap-6 sm:grid-cols-[1.3fr_1fr]">
            <div className="flex flex-col gap-4 rounded-3xl bg-pano-osc/60 p-6">
              <h2 className="text-2xl font-bold">Armar una mesa</h2>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-claro/80">Jugadores</legend>
                <div className="flex flex-wrap gap-2">
                  <button type="button" aria-pressed={players === 2} className={option(players === 2)} onClick={() => setPlayers(2)}>Mano a mano</button>
                  <button type="button" aria-pressed={players === 4} className={option(players === 4)} onClick={() => setPlayers(4)}>Dos contra dos</button>
                  <button type="button" aria-pressed={players === 6} className={option(players === 6)} onClick={() => setPlayers(6)}>Tres contra tres</button>
                </div>
              </fieldset>
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-2 text-claro/80">Puntos</legend>
                <div className="flex gap-2">
                  <button type="button" aria-pressed={target === 15} className={option(target === 15)} onClick={() => setTarget(15)}>A 15</button>
                  <button type="button" aria-pressed={target === 30} className={option(target === 30)} onClick={() => setTarget(30)}>A 30</button>
                </div>
              </fieldset>
              <label className="flex items-center gap-3 text-lg">
                <input type="checkbox" checked={flor} onChange={(e) => setFlor(e.target.checked)} className="h-5 w-5 accent-oro" />
                Se juega con flor
              </label>
              <button
                onClick={crear}
                disabled={busy}
                className="mt-2 rounded-2xl bg-rojo px-6 py-3 text-xl font-bold shadow-[0_4px_0_rgba(0,0,0,.4)] active:translate-y-1 active:shadow-none disabled:opacity-60"
              >
                {busy ? 'Armando…' : 'Crear sala'}
              </button>
              {msg && <p className="text-[#ffb4a8]">{msg}</p>}
            </div>

            <div className="flex flex-col gap-6">
              <form onSubmit={unirme} className="flex flex-col gap-3 rounded-3xl bg-pano-osc/60 p-6">
                <h2 className="text-2xl font-bold">Tengo un código</h2>
                <label htmlFor="codigo" className="sr-only">Código de sala</label>
                <input
                  id="codigo"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="AB12CD"
                  maxLength={6}
                  className="rounded-xl bg-claro px-4 py-2.5 text-center font-mano text-2xl uppercase tracking-[0.2em] text-tinta placeholder:text-tinta/40"
                />
                <button className="rounded-xl bg-oro px-4 py-2.5 text-lg font-bold text-tinta">Entrar a la sala</button>
              </form>
              <Link href="/maquina" className="rounded-3xl bg-pano-osc/60 p-6 transition hover:bg-pano-osc/80">
                <span className="block text-2xl font-bold">Contra la máquina</span>
                <span className="text-claro/75">Practicá sin esperar a nadie.</span>
              </Link>
              <Link href="/ranking" className="rounded-3xl bg-papel p-6 font-mano text-2xl font-bold text-tinta shadow-[2px_4px_0_rgba(0,0,0,.35)] rotate-[1deg]">
                Ver el ranking
              </Link>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
