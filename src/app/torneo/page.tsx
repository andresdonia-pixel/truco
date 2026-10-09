'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PerfilEditor } from '@/components/PerfilEditor';
import { api } from '@/lib/supabase/browser';
import { useSession } from '@/lib/useSession';

export default function NuevoTorneo() {
  const { session, error, saveProfile } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [size, setSize] = useState<4 | 8>(4);
  const [target, setTarget] = useState<15 | 30>(15);
  const [flor, setFlor] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const option = (active: boolean) =>
    `rounded-xl px-4 py-2 font-semibold transition ${active ? 'bg-claro text-pano-osc' : 'bg-pano-osc/60 text-claro/80'}`;

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const { code } = await api<{ code: string }>('/api/torneos', { name, size, target, flor });
      router.push(`/torneo/${code}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'No se pudo armar el torneo');
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="font-mano text-3xl font-bold">Truco</Link>
      </header>
      <h1 className="font-mano text-5xl font-bold">Torneo entre amigos</h1>
      <p className="-mt-3 max-w-lg text-claro/80">
        Llaves de eliminación directa, mano a mano. El que gana pasa de ronda solo; el último que queda en pie se lleva la copa.
      </p>

      {error && <p className="rounded-xl bg-rojo/80 p-4">No pudimos conectarte: {error}</p>}
      {session && !session.nickname && (
        <section className="rounded-3xl bg-pano-osc/60 p-6">
          <PerfilEditor onSave={saveProfile} />
        </section>
      )}

      {session?.nickname && (
        <section className="grid gap-6 sm:grid-cols-[1.3fr_1fr]">
          <form onSubmit={crear} className="flex flex-col gap-4 rounded-3xl bg-pano-osc/60 p-6">
            <h2 className="text-2xl font-bold">Armar un torneo</h2>
            <label className="flex flex-col gap-1.5">
              <span className="text-claro/80">Nombre</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                placeholder="Copa de los viernes"
                className="rounded-xl bg-claro px-4 py-2.5 text-lg text-tinta placeholder:text-tinta/40"
              />
            </label>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-claro/80">Jugadores</legend>
              <div className="flex gap-2">
                <button type="button" aria-pressed={size === 4} className={option(size === 4)} onClick={() => setSize(4)}>4</button>
                <button type="button" aria-pressed={size === 8} className={option(size === 8)} onClick={() => setSize(8)}>8</button>
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-claro/80">Cada partido</legend>
              <div className="flex gap-2">
                <button type="button" aria-pressed={target === 15} className={option(target === 15)} onClick={() => setTarget(15)}>A 15</button>
                <button type="button" aria-pressed={target === 30} className={option(target === 30)} onClick={() => setTarget(30)}>A 30</button>
              </div>
            </fieldset>
            <label className="flex items-center gap-3 text-lg">
              <input type="checkbox" checked={flor} onChange={(e) => setFlor(e.target.checked)} className="h-5 w-5 accent-oro" />
              Se juega con flor
            </label>
            <button disabled={busy} className="mt-2 rounded-2xl bg-rojo px-6 py-3 text-xl font-bold shadow-[0_4px_0_rgba(0,0,0,.4)] disabled:opacity-60">
              {busy ? 'Armando…' : 'Armar el torneo'}
            </button>
            {msg && <p className="text-[#ffb4a8]">{msg}</p>}
          </form>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const c = code.trim().toUpperCase();
              if (c.length >= 4) router.push(`/torneo/${c}`);
            }}
            className="flex flex-col gap-3 self-start rounded-3xl bg-pano-osc/60 p-6"
          >
            <h2 className="text-2xl font-bold">Tengo un código</h2>
            <label htmlFor="codigo-torneo" className="sr-only">Código del torneo</label>
            <input
              id="codigo-torneo"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              placeholder="AB12CD"
              className="rounded-xl bg-claro px-4 py-2.5 text-center font-mano text-2xl uppercase tracking-[0.2em] text-tinta placeholder:text-tinta/40"
            />
            <button className="rounded-xl bg-oro px-4 py-2.5 text-lg font-bold text-tinta">Ver el torneo</button>
          </form>
        </section>
      )}
    </main>
  );
}
