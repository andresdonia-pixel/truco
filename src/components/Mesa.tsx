'use client';
import { useMemo } from 'react';
import type { Action, PlayerView, Team } from '@/engine/engine.ts';
import { Carta, Dorso } from './Carta';
import { actionLabel, callText, eventText, pendingText } from '@/lib/labels';

export interface Jugador {
  seat: number;
  user_id: string;
  nickname: string;
}

interface Props {
  view: PlayerView;
  players: Jugador[];
  busy: boolean;
  onAction: (a: Action) => void;
}

type Pos = 'abajo' | 'derecha' | 'arriba' | 'izquierda';

function positions(n: number, mySeat: number): Record<number, Pos> {
  const out: Record<number, Pos> = {};
  for (let s = 0; s < n; s++) {
    const rel = (s - mySeat + n) % n;
    out[s] = n === 2 ? (rel === 0 ? 'abajo' : 'arriba') : (['abajo', 'derecha', 'arriba', 'izquierda'] as Pos[])[rel];
  }
  return out;
}

const BUTTON: Record<string, string> = {
  truco: 'bg-rojo text-claro',
  envido: 'bg-oro text-tinta',
  flor: 'bg-oro text-tinta',
  quiero: 'bg-claro text-pano-osc',
  no_quiero: 'bg-tinta text-claro',
  achico: 'bg-tinta text-claro',
  contraflor: 'bg-oro text-tinta',
  contraflor_resto: 'bg-rojo text-claro',
  mazo: 'border-2 border-claro/50 text-claro',
};

export function Mesa({ view, players, busy, onAction }: Props) {
  const h = view.hand;
  const n = view.config.players;
  const pos = useMemo(() => positions(n, view.seat), [n, view.seat]);
  const nameOf = (seat: number) => players.find((p) => p.seat === seat)?.nickname ?? `Asiento ${seat + 1}`;
  const teamName = (t: Team) => (t === view.team ? 'nosotros' : 'ellos');

  const currentBaza = h.bazas[h.bazas.length - 1];
  const pastBazas = h.bazas.slice(0, -1);
  const playable = new Set(view.legal.filter((a) => a.type === 'play').map((a) => (a as { card: string }).card));
  const others = view.legal.filter((a) => a.type !== 'play');
  const pending = h.pending;
  const myTurnToAnswer = pending && pending.by !== view.team && others.length > 0;
  const waitingAnswer = pending && pending.by === view.team;

  // último canto de cada jugador en esta mano, como globito
  const bubbles = useMemo(() => {
    const out: Record<number, string> = {};
    for (const e of h.events) {
      if (e.t === 'call') out[e.seat] = callText(e.call);
      if (e.t === 'quiero') out[e.seat] = 'Quiero';
      if (e.t === 'no_quiero') out[e.seat] = 'No quiero';
      if (e.t === 'tanto') out[e.seat] = `${e.value}`;
      if (e.t === 'mazo') out[e.seat] = 'Me voy';
    }
    return out;
  }, [h.events]);

  const log = h.events
    .map((e) => eventText(e, nameOf, teamName))
    .filter(Boolean)
    .slice(-5) as string[];

  const lastHandPoints = useMemo(() => {
    if (!view.lastHand) return null;
    const pts: [number, number] = [0, 0];
    for (const e of view.lastHand.events) if (e.t === 'points') pts[e.team] += e.pts;
    return pts;
  }, [view.lastHand]);

  const seatBadge = (seat: number) => {
    const isTurn = !pending && h.turn === seat && view.winner === null;
    const partner = seat !== view.seat && seat % 2 === view.team;
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="flex gap-1" aria-label={`${h.cardsLeft[seat]} cartas en la mano`}>
          {Array.from({ length: h.cardsLeft[seat] }, (_, i) => (
            <Dorso key={i} />
          ))}
        </div>
        <div
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm ${
            isTurn ? 'bg-oro text-tinta' : partner ? 'bg-pano-claro' : 'bg-pano-osc/70'
          }`}
        >
          <span className="font-semibold">{nameOf(seat)}</span>
          {partner && <span className="text-xs opacity-80">(compañero)</span>}
          {h.mano === seat && <span className="text-xs opacity-80">es mano</span>}
        </div>
        {bubbles[seat] && (
          <span key={bubbles[seat]} className="canto rounded-xl bg-claro px-2.5 py-1 font-mano text-base font-bold text-tinta">
            {bubbles[seat]}
          </span>
        )}
      </div>
    );
  };

  const playAt = (p: Pos) => {
    const play = currentBaza.plays.find((x) => pos[x.seat] === p);
    return (
      <div className="flex h-[70px] w-12 items-center justify-center">
        {play && (
          <span className="carta-entra">
            <Carta
              id={play.card}
              size="sm"
              highlight={currentBaza.winnerSeat === play.seat}
            />
          </span>
        )}
      </div>
    );
  };

  const seatAt = (p: Pos) => Object.keys(pos).map(Number).find((s) => pos[s] === p);
  const top = seatAt('arriba');
  const left = seatAt('izquierda');
  const right = seatAt('derecha');

  return (
    <div className="flex flex-col gap-3">
      {/* rivales y compañero */}
      <div className="flex justify-center">{top !== undefined && seatBadge(top)}</div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex justify-start">{left !== undefined && seatBadge(left)}</div>

        {/* paño central: la baza en juego */}
        <div className="grid grid-cols-3 grid-rows-3 place-items-center rounded-[40px] border-4 border-madera/80 bg-pano-osc/40 px-3 py-2 shadow-inner">
          <div />
          {playAt('arriba')}
          <div />
          {playAt('izquierda')}
          <div className="text-center text-xs leading-tight text-claro/70">
            {h.trucoValue > 1 ? <span className="font-semibold text-oro">Vale {h.trucoValue}</span> : `Mano ${h.number}`}
          </div>
          {playAt('derecha')}
          <div />
          {playAt('abajo')}
          <div />
        </div>

        <div className="flex justify-end">{right !== undefined && seatBadge(right)}</div>
      </div>

      {/* bazas ya jugadas */}
      <ol className="flex flex-wrap justify-center gap-2 text-sm" aria-label="Bazas jugadas">
        {pastBazas.map((b, i) => (
          <li key={i} className="rounded-full bg-pano-osc/70 px-3 py-1">
            {['Primera', 'Segunda'][i]}:{' '}
            <strong className={b.winner === view.team ? 'text-oro' : ''}>
              {b.winner === 'parda' ? 'parda' : b.winner === view.team ? 'nuestra' : 'de ellos'}
            </strong>
          </li>
        ))}
      </ol>

      {/* canto pendiente */}
      {myTurnToAnswer && (
        <div className="canto mx-auto rounded-2xl bg-claro px-4 py-2 text-center text-tinta" role="status">
          <span className="font-mano text-xl font-bold">
            {nameOf(pending.seat)}: {pendingText(pending)}
          </span>
        </div>
      )}
      {waitingAnswer && (
        <p className="text-center text-sm text-claro/80" role="status">
          Esperando la respuesta de {teamName((1 - view.team) as Team)}…
        </p>
      )}

      {/* mi mano */}
      <div className="flex flex-col items-center gap-2">
        <div className="flex justify-center gap-2">
          {h.myCards.map((c) => (
            <Carta
              key={c}
              id={c}
              size="lg"
              onClick={() => onAction({ type: 'play', card: c })}
              disabled={busy || !playable.has(c)}
              dim={!playable.has(c) && !pending && h.turn !== view.seat}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`rounded-full px-2.5 py-0.5 ${!pending && h.turn === view.seat ? 'bg-oro text-tinta font-semibold' : 'bg-pano-osc/70'}`}>
            {!pending && h.turn === view.seat && view.winner === null ? 'Te toca' : nameOf(view.seat)}
          </span>
          {h.mano === view.seat && <span className="text-xs text-claro/80">sos mano</span>}
          {bubbles[view.seat] && (
            <span key={bubbles[view.seat]} className="canto rounded-xl bg-claro px-2.5 py-0.5 font-mano font-bold text-tinta">
              {bubbles[view.seat]}
            </span>
          )}
        </div>
      </div>

      {/* botonera de cantos */}
      {others.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Cantos">
          {others.map((a) => (
            <button
              key={JSON.stringify(a)}
              type="button"
              disabled={busy}
              onClick={() => onAction(a)}
              className={`rounded-xl px-4 py-2 text-base font-bold shadow-[0_3px_0_rgba(0,0,0,.35)] transition active:translate-y-0.5 active:shadow-none disabled:opacity-50 ${
                BUTTON[a.type] ?? 'bg-claro text-tinta'
              }`}
            >
              {actionLabel(a, view)}
            </button>
          ))}
        </div>
      )}

      {/* lo que va pasando */}
      <div className="mx-auto w-full max-w-md text-sm text-claro/80" aria-live="polite">
        {lastHandPoints && h.events.length <= 2 && (
          <p className="mb-1 text-claro">
            Mano anterior: {lastHandPoints[view.team]} para nosotros, {lastHandPoints[1 - view.team]} para ellos.
          </p>
        )}
        <ul className="space-y-0.5">
          {log.map((t, i) => (
            <li key={`${h.number}-${h.events.length}-${i}`}>{t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
