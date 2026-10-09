'use client';
// Contra la máquina: corre todo en el navegador con el mismo motor y un bot por asiento.
// No usa la base de datos, así que no suma al ranking.
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { botAction } from '@/engine/bot.ts';
import { applyAction, createGame, legalActions, viewFor } from '@/engine/engine.ts';
import type { Action, Config, GameState } from '@/engine/engine.ts';
import { Anotador } from '@/components/Anotador';
import { Mesa, type Jugador } from '@/components/Mesa';
import { Toast, type ToastData } from '@/components/Toast';
import { Resumen } from '@/components/Resumen';
import { SonidoToggle } from '@/components/SonidoToggle';
import { prepararSonido, recibirZumbido } from '@/lib/zumbido';
import { FRASES_BOT, senaParaMano } from '@/lib/social';
import type { Gesto } from '@/lib/social';
import { Avatar } from '@/components/Avatar';
import { BOT_AVATARS, loadLocalAvatar } from '@/lib/avatar';
import type { AvatarConfig } from '@/lib/avatar';

const HUMAN = 0;
// asientos pares = tu equipo, impares = rivales
const NAMES: Record<2 | 4 | 6, string[]> = {
  2: ['Vos', 'El Mago'],
  4: ['Vos', 'El Mago', 'Coco', 'La Viuda'],
  6: ['Vos', 'El Mago', 'Coco', 'La Viuda', 'Pepa', 'Tito'],
};
const RIVALES = { 2: 'El Mago', 4: 'El Mago y La Viuda', 6: 'El Mago, La Viuda y Tito' } as const;

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
  const [myAvatar, setMyAvatar] = useState<AvatarConfig | null>(null);
  useEffect(() => setMyAvatar(loadLocalAvatar()), []);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [burbujas, setBurbujas] = useState<Record<number, string>>({});
  const [senas, setSenas] = useState<Record<number, Gesto>>({});
  const flash = <T,>(set: React.Dispatch<React.SetStateAction<Record<number, T>>>, seat: number, value: T, ms: number) => {
    set((prev) => ({ ...prev, [seat]: value }));
    setTimeout(() => set((prev) => (prev[seat] === value ? (Object.fromEntries(Object.entries(prev).filter(([k]) => Number(k) !== seat)) as Record<number, T>) : prev)), ms);
  };
  const pick = (xs: string[]) => xs[Math.floor(Math.random() * xs.length)];

  // la máquina comenta la partida y el compañero máquina te hace señas al repartir
  const visto = useRef<{ hand: number; count: number } | null>(null);
  useEffect(() => {
    if (!state) {
      visto.current = null;
      return;
    }
    const prev = visto.current;
    const h = state.hand;
    visto.current = { hand: h.number, count: h.events.length };
    const nuevaMano = !prev || prev.hand !== h.number;
    const nuevos = !prev
      ? h.events
      : nuevaMano
        ? [...(state.lastHand?.events.slice(prev.count) ?? []), ...h.events]
        : h.events.slice(prev.count);
    const rivalBot = () => [1, 3, 5].filter((s) => s < state.config.players)[Math.floor(Math.random() * (state.config.players / 2))];
    for (const e of nuevos) {
      if (e.t === 'call' && e.seat % 2 === 1 && ['truco', 'retruco', 'vale4'].includes(e.call) && Math.random() < 0.3)
        flash(setBurbujas, e.seat, pick(FRASES_BOT.canta), 3500);
      if (e.t === 'no_quiero' && e.seat === HUMAN && e.to === 'truco' && Math.random() < 0.5)
        flash(setBurbujas, rivalBot(), pick(FRASES_BOT.noQuiere), 3500);
      if (e.t === 'hand_end' && e.winner === 1 && Math.random() < 0.2) flash(setBurbujas, rivalBot(), pick(FRASES_BOT.gana), 3500);
    }
    if (nuevaMano && state.winner === null && state.config.players > 2) {
      for (let seat = 2; seat < state.config.players; seat += 2) {
        const g = senaParaMano(h.dealt[seat], state.config.flor);
        setTimeout(() => flash(setSenas, seat, g, 3500), 1200 + seat * 300);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
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

  // si tardás mucho en jugar, un rival te manda un zumbido (uno por decisión)
  useEffect(() => {
    if (!state || actor !== HUMAN || state.winner !== null) return;
    const t = setTimeout(() => {
      recibirZumbido();
      const id = Date.now();
      setToast({ id, text: '¡El Mago te mandó un zumbido! Dale que se enfría el mate.', avatar: BOT_AVATARS[1], fuerte: true });
      setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), 3500);
    }, 25_000);
    return () => clearTimeout(t);
  }, [state, actor]);

  const view = useMemo(() => (state ? viewFor(state, HUMAN) : null), [state]);
  const players: Jugador[] = useMemo(
    () =>
      NAMES[config.players].map((nickname, seat) => ({
        seat,
        user_id: `bot-${seat}`,
        nickname,
        avatar: seat === HUMAN ? myAvatar ?? BOT_AVATARS[0] : BOT_AVATARS[seat],
      })),
    [config.players, myAvatar],
  );

  function empezar() {
    prepararSonido();
    const seed = crypto.getRandomValues(new Uint32Array(1))[0];
    setState(createGame(config, seed));
  }

  function jugar(a: Action) {
    if (!state || actor !== HUMAN) return;
    prepararSonido();
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
          <div className="flex items-center gap-4 rounded-2xl bg-pano-osc/50 p-3">
            <Avatar avatar={myAvatar ?? BOT_AVATARS[0]} size={56} title="Tu personaje" />
            <span className="text-2xl font-bold text-claro/60" aria-hidden>vs</span>
            <div className="flex -space-x-3">
              {NAMES[config.players].map((name, seat) =>
                seat % 2 === 1 ? <Avatar key={seat} avatar={BOT_AVATARS[seat]} size={48} title={name} className="rounded-full ring-2 ring-pano-osc" /> : null,
              )}
            </div>
            <Link href="/" className="ml-auto text-sm text-claro/80 underline underline-offset-4">
              {myAvatar ? 'Editar tu personaje' : 'Armá tu personaje'}
            </Link>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-claro/80">Jugadores</legend>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={config.players === 2} className={option(config.players === 2)} onClick={() => setConfig({ ...config, players: 2 })}>
                Mano a mano
              </button>
              <button type="button" aria-pressed={config.players === 4} className={option(config.players === 4)} onClick={() => setConfig({ ...config, players: 4 })}>
                Dos contra dos
              </button>
              <button type="button" aria-pressed={config.players === 6} className={option(config.players === 6)} onClick={() => setConfig({ ...config, players: 6 })}>
                Tres contra tres
              </button>
            </div>
            {config.players > 2 && <p className="text-sm text-claro/70">Tus compañeros también son la máquina.</p>}
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
  const rivals = RIVALES[config.players];

  return (
    <main className="mx-auto grid w-full max-w-7xl flex-1 gap-5 px-3 py-4 lg:grid-cols-[200px_1fr_200px] lg:px-6">
      <Toast toast={toast} />
      <header className="flex flex-wrap items-center justify-between gap-3 lg:col-span-3">
        <Link href="/" className="font-mano text-3xl font-bold">Truco</Link>
        <span className="rounded-full bg-pano-osc/70 px-3 py-1 text-sm">
          Contra {rivals}, a {config.target}
          {config.flor ? ', con flor' : ''}
        </span>
        <SonidoToggle />
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
            <Resumen stats={view.stats} team={view.team} ganador={view.winner} players={players} />
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
          <Mesa view={view} players={players} busy={actor !== HUMAN} onAction={jugar} burbujas={burbujas} senas={senas} onFrase={(f) => flash(setBurbujas, HUMAN, f, 4500)} onSena={(g) => flash(setSenas, HUMAN, g, 3500)} />
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
