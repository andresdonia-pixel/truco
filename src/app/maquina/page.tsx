'use client';
// Contra la máquina: corre todo en el navegador con el mismo motor y un bot por asiento.
// No usa la base de datos, así que no suma al ranking.
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { botAction } from '@/engine/bot.ts';
import { applyAction, createGame, legalActions, viewFor } from '@/engine/engine.ts';
import type { Action, Config, GameState } from '@/engine/engine.ts';
import { Anotador } from '@/components/Anotador';
import { Mesa, type Jugador } from '@/components/Mesa';

const HUMAN = 0;
const NAMES: Record<2 | 4, string[]> = {
  2: ['Vos', 'El Mago'],
  4: ['Vos', 'El Mago', 'Coco', 'La Viuda'], // Coco es tu compañero (asiento 2)
};

/** Quién decide ahora. Si un canto lo podemos responder vos o tu compañero, respondés vos. */
function nextActor(s: GameState): number | null {
  if (s.winner !== null) return null;
  const n = s.config.players;
  const able = Array.from({ length: n }, (_, i) => i).filter((seat) => legalActions(s, seat).length > 0);
  if (able.length === 0) return null;
  if (able.includes(HUMAN)) return HUMAN;
  return able[0];
}

export default function Maquina() {
  const [config, setConfig] = useState<Config>({ players: 2, target: 30, flor: false });
  const [state, setState] = useState<GameState | null>(null);
  const [thinking, setThinking] = useState(false);

  const actor = state ? nextActor(state) : null;

  // turno de un bot: piensa un momento y juega
  useEffect(() => {
    if (!state || actor === null || actor === HUMAN) {
      setThinking(false);
      return;
    }
    setThinking(true);
    const freshHand = state.hand.events.length <= 1;
    const delay = freshHand ? 1600 : 900 + Math.random() * 500;
    const t = setTimeout(() => {
      setState((s) => (s ? applyAction(s, actor, botAction(viewFor(s, actor))) : s));
    }, delay);
    return () => clearTimeout(t);
  }, [state, actor]);

  const view = useMemo(() => (state ? viewFor(state, HUMAN) : null), [state]);
  const players: Jugador[] = useMemo(
    () => NAMES[config.players].map((nickname, seat) => ({ seat, user_id: `bot-${seat}`, nickname })),
    [config.players],
  );

  function empezar() {
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    setState(createGame(config, seed));
  }

  function jugar(a: Action) {
    if (!state || actor !== HUMAN) return;
    setState(applyAction(state, HUMAN, a));
  }

  const option = (active: boolean) =>
    `rounded-xl px-4 py-2 font-semibold transition ${active ? 'bg-claro text-pano-osc' : 'bg-pano-osc/60 text-claro/80'}`;

  if (!state || !view) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-4 py-10">
        <Link href="/" className="font-mano text-3xl font-bold">Truco</Link>
        <section className="flex flex-col gap-4 rounded-3xl bg-pano-osc/60 p-6">
          <h1 className="text-3xl font-bold">Contra la máquina</h1>
          <p className="text-claro/80">Para practicar sin esperar a nadie. Estas partidas no suman al ranking.</p>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-claro/80">Jugadores</legend>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={config.players === 2} className={option(config.players === 2)} onClick={() => setConfig({ ...config, players: 2 })}>
                Mano a mano
              </button>
              <button type="button" aria-pressed={config.players === 4} className={option(config.players === 4)} onClick={() => setConfig({ ...config, players: 4 })}>
                Dos contra dos
              </button>
            </div>
            {config.players === 4 && <p className="text-sm text-claro/70">Tu compañero también es la máquina.</p>}
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-claro/80">Puntos</legend>
            <div className="flex gap-2">
              <button type="button" aria-pressed={config.target === 15} className={option(config.target === 15)} onClick={() => setConfig({ ...config, target: 15 })}>A 15</button>
              <button type="button" aria-pressed={config.target === 30} className={option(config.target === 30)} onClick={() => setConfig({ ...config, target: 30 })}>A 30</button>
            </div>
          </fieldset>
          <label className="flex items-center gap-3 text-lg">
            <input type="checkbox" checked={config.flor} onChange={(e) => setConfig({ ...config, flor: e.target.checked })} className="h-5 w-5 accent-oro" />
            Se juega con flor
          </label>
          <button
            onClick={empezar}
            className="mt-2 rounded-2xl bg-rojo px-6 py-3 text-xl font-bold shadow-[0_4px_0_rgba(0,0,0,.4)] active:translate-y-1 active:shadow-none"
          >
            Repartir
          </button>
        </section>
      </main>
    );
  }

  const finished = view.winner !== null;
  const rivals = config.players === 2 ? 'El Mago' : 'El Mago y La Viuda';

  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 gap-5 px-3 py-4 lg:grid-cols-[230px_1fr_230px] lg:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3 lg:col-span-3">
        <Link href="/" className="font-mano text-3xl font-bold">Truco</Link>
        <span className="rounded-full bg-pano-osc/70 px-3 py-1 text-sm">
          Contra {rivals}, a {config.target}
          {config.flor ? ', con flor' : ''}
        </span>
      </header>

      <aside className="order-2 lg:order-1">
        <Anotador nosotros={view.score[view.team]} ellos={view.score[1 - view.team]} target={config.target} />
      </aside>

      <section className="order-1 flex flex-col gap-4 lg:order-2">
        <p className="flex justify-center gap-3 font-mano text-xl lg:hidden" aria-hidden>
          <span className="rounded-full bg-papel px-3 text-tinta">Nosotros {view.score[view.team]}</span>
          <span className="rounded-full bg-papel px-3 text-tinta">Ellos {view.score[1 - view.team]}</span>
        </p>
        {finished ? (
          <div className="canto flex flex-col items-center gap-4 rounded-3xl bg-papel p-8 text-center text-tinta">
            <p className="font-mano text-5xl font-bold">{view.winner === view.team ? '¡Ganaste!' : 'Ganó la máquina'}</p>
            <p className="text-lg">
              {view.score[view.team]} a {view.score[1 - view.team]}.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button onClick={empezar} className="rounded-2xl bg-rojo px-6 py-3 text-xl font-bold text-claro">
                Jugar otra
              </button>
              <button onClick={() => setState(null)} className="rounded-2xl px-6 py-3 text-lg underline">
                Cambiar reglas
              </button>
            </div>
          </div>
        ) : (
          <Mesa view={view} players={players} busy={actor !== HUMAN} onAction={jugar} />
        )}
        {thinking && !finished && (
          <p className="text-center text-sm text-claro/70" role="status">
            {players[actor!]?.nickname} está pensando…
          </p>
        )}
      </section>

      <aside className="order-3 flex flex-col gap-3 text-sm text-claro/80">
        <p>Practicá acá y después armá una mesa con amigos.</p>
        <Link href="/" className="w-fit rounded-xl bg-oro px-4 py-2 font-bold text-tinta">Jugar online</Link>
        <button onClick={() => setState(null)} className="w-fit underline underline-offset-4">Abandonar partida</button>
      </aside>
    </main>
  );
}
