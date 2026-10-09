'use client';
import { useEffect, useMemo, useRef } from 'react';
import { sonar } from '@/lib/sonidos';
import type { Action, GameEvent, PlayerView, Team } from '@/engine/engine.ts';
import { Avatar } from './Avatar';
import { Carta, Dorso } from './Carta';
import type { AvatarConfig } from '@/lib/avatar';
import { SENAS } from '@/lib/social';
import type { Gesto } from '@/lib/social';
import { Frases, Senas } from './Social';
import { actionHelp, actionLabel, callText, eventText, pendingText } from '@/lib/labels';
import { envidoPoints, hasFlor } from '@/engine/cards.ts';

export interface Jugador {
  seat: number;
  user_id: string;
  nickname: string;
  avatar?: AvatarConfig | null;
}

interface Props {
  view: PlayerView;
  players: Jugador[];
  busy: boolean;
  onAction: (a: Action) => void;
  /** Si viene, aparece el botón de zumbido para apurar al que tiene que jugar. */
  onZumbido?: (targets: number[]) => void;
  zumbidoListo?: boolean;
  /** Globitos de chat y señas activas por asiento. */
  burbujas?: Record<number, string>;
  senas?: Record<number, Gesto>;
  onFrase?: (f: string) => void;
  onSena?: (g: Gesto) => void;
}

interface TableBaza {
  plays: { seat: number; card: string }[];
  winnerSeat: number | null;
}

/** Bazas de una mano terminada, a partir de sus eventos. */
function bazasFromEvents(events: GameEvent[]): TableBaza[] {
  const out: TableBaza[] = [{ plays: [], winnerSeat: null }];
  for (const e of events) {
    if (e.t === 'play') out[out.length - 1].plays.push({ seat: e.seat, card: e.card });
    if (e.t === 'baza') {
      out[out.length - 1].winnerSeat = e.seat;
      out.push({ plays: [], winnerSeat: null });
    }
  }
  return out.filter((b) => b.plays.length > 0);
}

/**
 * Posición de cada asiento alrededor de la mesa, en % del contenedor.
 * Vos abajo; el siguiente en jugar (tu derecha) a la derecha, y así en sentido antihorario.
 */
function seatGeometry(n: number, mySeat: number, seat: number) {
  const rel = (seat - mySeat + n) % n;
  const angle = ((90 - (rel * 360) / n) * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    rel,
    outer: { left: 50 + 41 * cos, top: 50 + 40 * sin },
    inner: { left: 50 + 24 * cos, top: 50 + 21 * sin },
  };
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

const BAZA_NAME = ['Primera', 'Segunda', 'Tercera'];

export function Mesa({ view, players, busy, onAction, onZumbido, zumbidoListo = true, burbujas = {}, senas = {}, onFrase, onSena }: Props) {
  const h = view.hand;
  const n = view.config.players;
  const nameOf = (seat: number) => players.find((p) => p.seat === seat)?.nickname ?? `Asiento ${seat + 1}`;
  const avatarOf = (seat: number) => players.find((p) => p.seat === seat)?.avatar ?? null;
  const teamName = (t: Team) => (t === view.team ? 'nosotros' : 'ellos');

  const pending = h.pending;
  const playable = new Set(view.legal.filter((a) => a.type === 'play').map((a) => (a as { card: string }).card));
  const others = view.legal.filter((a) => a.type !== 'play');
  const myTurnToAnswer = pending && pending.by !== view.team && others.length > 0;
  const waitingAnswer = pending && pending.by === view.team;
  // a quién estamos esperando (para el zumbido)
  const waitingFor: number[] =
    view.winner !== null
      ? []
      : pending
        ? pending.by === view.team
          ? Array.from({ length: n }, (_, s) => s).filter((s) => s % 2 !== view.team)
          : []
        : h.turn !== view.seat
          ? [h.turn]
          : [];

  // en la mesa: las bazas de esta mano; si todavía no se jugó nada, cómo quedó la anterior
  const anyPlayed = h.bazas.some((b) => b.plays.length > 0);
  const showingPrevious = !anyPlayed && !!view.lastHand && view.lastHand.events.some((e) => e.t === 'play');
  const tableBazas: TableBaza[] = useMemo(
    () => (showingPrevious ? bazasFromEvents(view.lastHand!.events) : h.bazas.map((b) => ({ plays: b.plays, winnerSeat: b.winnerSeat }))),
    [showingPrevious, view.lastHand, h.bazas],
  );
  const lastPlayKey = useMemo(() => {
    const plays = h.bazas.flatMap((b) => b.plays);
    const last = plays[plays.length - 1];
    return last ? `${last.seat}-${last.card}` : null;
  }, [h.bazas]);

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

  const lastHandPoints = useMemo(() => {
    if (!view.lastHand) return null;
    const pts: [number, number] = [0, 0];
    for (const e of view.lastHand.events) if (e.t === 'points') pts[e.team] += e.pts;
    return pts;
  }, [view.lastHand]);

  const log = h.events
    .map((e) => eventText(e, nameOf, teamName))
    .filter(Boolean)
    .slice(-5) as string[];

  const seats = Array.from({ length: n }, (_, i) => i);

  // ayuda para quien aprende: tus puntos de envido mientras se puede cantar
  const miTanto = useMemo(() => {
    if (h.bazas.length !== 1 || view.winner !== null) return null;
    const jugadas = h.bazas.flatMap((b) => b.plays.filter((p) => p.seat === view.seat).map((p) => p.card));
    const mano = [...h.myCards, ...jugadas];
    if (mano.length !== 3) return null;
    return { envido: envidoPoints(mano), flor: view.config.flor && hasFlor(mano) };
  }, [h.bazas, h.myCards, view.seat, view.winner, view.config.flor]);

  // sonidos de lo que pasó desde el último render
  const visto = useRef<{ hand: number; count: number } | null>(null);
  useEffect(() => {
    const prev = visto.current;
    visto.current = { hand: h.number, count: h.events.length };
    if (!prev) return; // al entrar no suena lo que ya había pasado
    const nuevos = prev.hand === h.number ? h.events.slice(prev.count) : h.events;
    if (nuevos.some((e) => e.t === 'deal')) sonar('barajar');
    else if (nuevos.some((e) => e.t === 'call')) sonar('canto');
    else if (nuevos.some((e) => e.t === 'play')) sonar('carta');
  }, [h.number, h.events]);
  const lastEvent = h.events[h.events.length - 1];
  const shouting = (seat: number) =>
    (pending?.seat === seat) || (lastEvent?.t === 'call' && lastEvent.seat === seat) || (lastEvent?.t === 'mazo' && lastEvent.seat === seat);
  const isTurn = (seat: number) => !pending && h.turn === seat && view.winner === null;

  return (
    <div className="flex flex-col gap-3">
      {/* la mesa */}
      <div
        className={`relative mx-auto w-full max-w-3xl ${n === 6 ? 'aspect-[4/5] sm:aspect-[16/11]' : 'aspect-square sm:aspect-[16/10]'}`}
        aria-label="Mesa"
      >
        <div
          className="absolute inset-[9%] rounded-[50%] border-[6px] border-madera/80 bg-pano-osc/35 shadow-[inset_0_0_40px_rgba(0,0,0,.35)]"
          aria-hidden
        />

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center text-xs leading-tight text-claro/70">
          {showingPrevious ? (
            <span>Así quedó la mano {view.lastHand!.number}</span>
          ) : h.trucoValue > 1 ? (
            <span className="text-sm font-semibold text-oro">Vale {h.trucoValue}</span>
          ) : (
            <span>Mano {h.number}</span>
          )}
        </div>

        {/* cartas jugadas, delante de cada uno */}
        {seats.map((seat) => {
          const g = seatGeometry(n, view.seat, seat);
          const cards = tableBazas.map((b, i) => ({ i, play: b.plays.find((p) => p.seat === seat), won: b.winnerSeat === seat }));
          const played = cards.filter((c) => c.play);
          if (!played.length) return null;
          return (
            <ol
              key={`cards-${seat}`}
              className={`absolute flex -translate-x-1/2 -translate-y-1/2 ${showingPrevious ? 'opacity-60' : ''}`}
              style={{ left: `${g.inner.left}%`, top: `${g.inner.top}%` }}
              aria-label={`Cartas jugadas por ${nameOf(seat)}`}
            >
              {played.map(({ i, play, won }, k) => (
                <li
                  key={`${i}-${play!.card}`}
                  className={`${k > 0 ? '-ml-3 sm:-ml-4' : ''} ${!showingPrevious && `${seat}-${play!.card}` === lastPlayKey ? 'carta-entra' : ''}`}
                  style={{ transform: `rotate(${(k - (played.length - 1) / 2) * 7}deg)` }}
                  title={`${BAZA_NAME[i]}${won ? ', la ganó' : ''}`}
                >
                  <Carta id={play!.card} size="mesa" highlight={won} />
                </li>
              ))}
            </ol>
          );
        })}

        {/* los demás jugadores */}
        {seats
          .filter((seat) => seat !== view.seat)
          .map((seat) => {
            const g = seatGeometry(n, view.seat, seat);
            const partner = seat % 2 === view.team;
            return (
              <div
                key={`seat-${seat}`}
                className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 ${n === 6 ? 'flex-col' : 'flex-row'}`}
                style={{ left: `${g.outer.left}%`, top: `${g.outer.top}%` }}
              >
                <div className="relative shrink-0">
                  {burbujas[seat] && (
                    <span className="canto absolute bottom-full left-1/2 z-20 mb-1.5 w-max max-w-[9.5rem] -translate-x-1/2 rounded-xl bg-white px-2 py-1 text-center text-xs font-semibold leading-tight text-tinta shadow-[0_2px_0_rgba(0,0,0,.3)] after:absolute after:left-1/2 after:top-full after:-ml-1 after:border-4 after:border-transparent after:border-t-white">
                      {burbujas[seat]}
                    </span>
                  )}
                  <Avatar
                    avatar={avatarOf(seat)}
                    size={n === 6 ? 38 : 48}
                    gesto={senas[seat]}
                    shouting={shouting(seat)}
                    className={`rounded-full ${isTurn(seat) ? 'ring-[3px] ring-oro' : partner ? 'ring-2 ring-claro/60' : ''}`}
                  />
                  <div className="absolute -bottom-1 -right-4 flex" aria-label={`${h.cardsLeft[seat]} cartas en la mano`}>
                    {Array.from({ length: h.cardsLeft[seat] }, (_, i) => (
                      <span key={i} className={i > 0 ? '-ml-1.5' : ''} style={{ transform: `rotate(${(i - 1) * 12}deg)` }}>
                        <Dorso size="xs" />
                      </span>
                    ))}
                  </div>
                </div>
                <div className={`flex flex-col gap-0.5 ${n === 6 ? 'items-center' : 'items-start'}`}>
                  <div
                    className={`max-w-[7.5rem] truncate rounded-full px-2 py-0.5 text-xs sm:text-sm ${
                      isTurn(seat) ? 'bg-oro font-semibold text-tinta' : partner ? 'bg-pano-claro ring-1 ring-claro/50' : 'bg-tinta/75'
                    }`}
                    title={partner ? 'Compañero' : 'Rival'}
                  >
                    <span className="font-semibold">{nameOf(seat)}</span>
                    {h.mano === seat && <span className="opacity-80"> · mano</span>}
                  </div>
                  {bubbles[seat] && (
                    <span key={bubbles[seat]} className="canto whitespace-nowrap rounded-xl bg-claro px-2 py-0.5 font-mano text-sm font-bold text-tinta sm:text-base">
                      {bubbles[seat]}
                    </span>
                  )}
                  {senas[seat] && partner && (
                    <span key={`s-${senas[seat]}`} className="canto whitespace-nowrap rounded-xl bg-oro px-2 py-0.5 text-xs font-bold text-tinta">
                      Seña: {SENAS.find((x) => x.id === senas[seat])?.significa}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
      </div>

      {n > 2 && (
        <p className="-mt-1 text-center text-xs text-claro/60">
          Compañeros en verde y rivales en negro, sentados alternados como en la mesa.
        </p>
      )}

      {/* bazas ya resueltas */}
      {!showingPrevious && (
        <ol className="flex flex-wrap justify-center gap-2 text-sm" aria-label="Bazas jugadas">
          {h.bazas
            .filter((b) => b.winner !== null)
            .map((b, i) => (
              <li key={i} className="rounded-full bg-pano-osc/70 px-3 py-1">
                {BAZA_NAME[i]}:{' '}
                <strong className={b.winner === view.team ? 'text-oro' : ''}>
                  {b.winner === 'parda' ? 'parda' : b.winner === view.team ? 'nuestra' : 'de ellos'}
                </strong>
              </li>
            ))}
        </ol>
      )}
      {showingPrevious && lastHandPoints && (
        <p className="text-center text-sm text-claro">
          Mano anterior: {lastHandPoints[view.team]} para nosotros, {lastHandPoints[1 - view.team]} para ellos.
        </p>
      )}

      {/* canto pendiente */}
      {myTurnToAnswer && (
        <div className="canto mx-auto max-w-md rounded-2xl bg-claro px-4 py-2 text-center text-tinta" role="status">
          <span className="font-mano text-xl font-bold">
            {nameOf(pending.seat)}: {pendingText(pending)}
          </span>
          <span className="block text-sm">
            {pending.kind === 'truco'
              ? `Si querés, la mano vale ${pending.level}. Si no, ${nameOf(pending.seat)} se lleva ${pending.level - 1}.`
              : pending.kind === 'envido'
                ? 'Si querés, se comparan los envidos. Si no, ellos suman lo cantado antes.'
                : 'Tu rival cantó flor: respondé con la tuya.'}
          </span>
        </div>
      )}
      {waitingFor.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-claro/80" role="status">
          <span>
            {waitingAnswer
              ? `Esperando la respuesta de ${teamName((1 - view.team) as Team)}…`
              : `Esperando a ${nameOf(waitingFor[0])}…`}
          </span>
          {onZumbido && (
            <button
              type="button"
              onClick={() => onZumbido(waitingFor)}
              disabled={!zumbidoListo}
              title={zumbidoListo ? 'Mandale un zumbido para que juegue' : 'Esperá un ratito para mandar otro'}
              className="rounded-full border-2 border-oro px-3 py-0.5 font-bold text-oro transition hover:bg-oro hover:text-tinta disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-oro"
            >
              Zumbido
            </button>
          )}
        </div>
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
          <span className="relative">
            {burbujas[view.seat] && (
              <span className="canto absolute bottom-full left-1/2 z-20 mb-1.5 w-max max-w-[11rem] -translate-x-1/2 rounded-xl bg-white px-2 py-1 text-center text-xs font-semibold leading-tight text-tinta shadow-[0_2px_0_rgba(0,0,0,.3)]">
                {burbujas[view.seat]}
              </span>
            )}
            <Avatar avatar={avatarOf(view.seat)} size={40} gesto={senas[view.seat]} shouting={shouting(view.seat)} className={`rounded-full ${isTurn(view.seat) ? 'ring-[3px] ring-oro' : ''}`} />
          </span>
          <span className={`rounded-full px-2.5 py-0.5 ${isTurn(view.seat) ? 'bg-oro font-semibold text-tinta' : 'bg-pano-osc/70'}`}>
            {isTurn(view.seat) ? 'Te toca' : nameOf(view.seat)}
          </span>
          {h.mano === view.seat && <span className="text-xs text-claro/80">sos mano</span>}
          {miTanto && (
            <span className="rounded-full bg-pano-osc/70 px-2.5 py-0.5 text-xs" title="Durante la primera baza te mostramos tus puntos de envido">
              Tu envido: <strong>{miTanto.envido}</strong>
              {miTanto.flor && <strong className="text-oro"> · ¡Tenés flor!</strong>}
            </span>
          )}
          {bubbles[view.seat] && (
            <span key={bubbles[view.seat]} className="canto rounded-xl bg-claro px-2.5 py-0.5 font-mano font-bold text-tinta">
              {bubbles[view.seat]}
            </span>
          )}
        </div>
      </div>

      {(onFrase || (onSena && n > 2)) && (
        <div className="flex justify-center gap-2">
          {onFrase && <Frases onPick={onFrase} />}
          {onSena && n > 2 && <Senas avatar={avatarOf(view.seat)} onPick={onSena} />}
        </div>
      )}

      {/* botonera de cantos */}
      {others.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Cantos">
          {others.map((a) => (
            <button
              key={JSON.stringify(a)}
              title={actionHelp(a, view)}
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
      <ul className="mx-auto w-full max-w-md space-y-0.5 text-sm text-claro/80" aria-live="polite">
        {log.map((t, i) => (
          <li key={`${h.number}-${h.events.length}-${i}`}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
