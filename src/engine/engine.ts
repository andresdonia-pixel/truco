// Motor de reglas de truco argentino. Puro y determinístico: (estado, asiento, acción) -> estado nuevo.
// Corre en el servidor; los clientes sólo reciben viewFor(estado, asiento), que oculta las cartas ajenas.
//
// Reglas implementadas (decisiones documentadas en README):
// - 1v1, 2v2 y 3v3 (asientos alternados: pares = equipo 0, impares = equipo 1). La mano rota cada ronda.
//   En el de a 6 el envido es por equipo, como en el de a 4 (sin pica-pica).
// - Bazas con pardas; tras una parda vuelve a salir quien abrió esa baza.
// - Truco / retruco / vale cuatro; sólo puede subir el equipo que tiene "el quiero".
// - Envido / envido / real envido / falta envido, con "el envido está primero" ante un truco.
// - Flor (configurable): 3 puntos; si el rival tiene flor responde con me achico (4),
//   contraflor (6) o contraflor al resto (falta).
// - Irse al mazo: el rival suma lo que vale la mano; en primera sin envido cantado, +1.
// - Falta envido: lo que le falta al que va ganando; a 30 y en las malas, gana el partido.

import { DECK, envidoPoints, florPoints, hasFlor, rank, shuffle } from './cards.ts';
import type { CardId } from './cards.ts';

export type Team = 0 | 1;
export type EnvidoCall = 'envido' | 'real' | 'falta';

export interface Config {
  players: 2 | 4 | 6;
  target: 15 | 30;
  flor: boolean;
}

export type Pending =
  | { kind: 'truco'; level: 2 | 3 | 4; by: Team; seat: number }
  | { kind: 'envido'; chain: EnvidoCall[]; by: Team; seat: number }
  | { kind: 'flor'; by: Team; seat: number };

export type Action =
  | { type: 'play'; card: CardId }
  | { type: 'truco' }
  | { type: 'envido'; call: EnvidoCall }
  | { type: 'flor' }
  | { type: 'quiero' }
  | { type: 'no_quiero' }
  | { type: 'achico' }
  | { type: 'contraflor' }
  | { type: 'contraflor_resto' }
  | { type: 'mazo' };

export interface Baza {
  leader: number;
  plays: { seat: number; card: CardId }[];
  winner: Team | 'parda' | null;
  winnerSeat: number | null;
}

export type GameEvent =
  | { t: 'deal'; hand: number; mano: number }
  | { t: 'play'; seat: number; card: CardId }
  | { t: 'call'; seat: number; call: string }
  | { t: 'quiero'; seat: number; to: 'truco' | 'envido' }
  | { t: 'no_quiero'; seat: number; to: 'truco' | 'envido' }
  | { t: 'mazo'; seat: number }
  | { t: 'baza'; index: number; winner: Team | 'parda'; seat: number | null }
  | { t: 'tanto'; kind: 'envido' | 'flor'; seat: number; value: number }
  | { t: 'points'; team: Team; pts: number; reason: string }
  | { t: 'hand_end'; winner: Team; pts: number }
  | { t: 'game_end'; winner: Team };

export interface HandState {
  number: number;
  mano: number;
  dealt: CardId[][];
  cards: CardId[][];
  bazas: Baza[];
  turn: number;
  trucoValue: number; // valor aceptado de la mano (1, 2, 3 o 4)
  trucoHolder: Team | null; // equipo con "el quiero" (único que puede subir)
  pending: Pending | null;
  suspended: Pending | null; // truco en espera mientras se resuelve envido/flor
  envidoDone: boolean;
  florDone: boolean;
  events: GameEvent[];
}

export interface HandSummary {
  number: number;
  winner: Team | null;
  events: GameEvent[];
}

export interface TeamStats {
  manos: number; // manos ganadas
  trucos: number; // manos ganadas en las que se cantó truco
  puntosTruco: number;
  envidos: number; // envidos ganados (queridos o no)
  puntosEnvido: number;
  flores: number;
  bazas: number;
  mazos: number; // veces que el equipo se fue al mazo
}

export interface MatchStats {
  teams: [TeamStats, TeamStats];
  /** Mejor tanto mostrado por cada asiento (sólo lo que se cantó en la mesa). */
  mejorEnvido: Record<number, number>;
}

export interface GameState {
  config: Config;
  score: [number, number];
  rng: number;
  hand: HandState;
  lastHand: HandSummary | null;
  winner: Team | null;
  stats?: MatchStats; // opcional para partidas guardadas antes de las estadísticas
}

const emptyTeam = (): TeamStats => ({ manos: 0, trucos: 0, puntosTruco: 0, envidos: 0, puntosEnvido: 0, flores: 0, bazas: 0, mazos: 0 });
export const emptyStats = (): MatchStats => ({ teams: [emptyTeam(), emptyTeam()], mejorEnvido: {} });
function stats(state: GameState): MatchStats {
  return (state.stats ??= emptyStats());
}

export class IllegalMove extends Error {}

const teamOf = (seat: number): Team => (seat % 2) as Team;
const other = (t: Team): Team => (1 - t) as Team;
const TRUCO_NAMES: Record<number, string> = { 2: 'truco', 3: 'retruco', 4: 'vale4' };
const ENVIDO_VALUES: Record<EnvidoCall, number> = { envido: 2, real: 3, falta: 0 };

// ---------- creación y reparto ----------

export function createGame(config: Config, seed: number, opts: { hands?: CardId[][] } = {}): GameState {
  const state = {
    config: { ...config },
    score: [0, 0],
    rng: seed >>> 0,
    hand: null as unknown as HandState,
    lastHand: null,
    stats: emptyStats(),
    winner: null,
  } as GameState;
  startHand(state, 0, 1, opts.hands);
  return state;
}

function startHand(state: GameState, mano: number, number: number, forced?: CardId[][]) {
  const n = state.config.players;
  let dealt: CardId[][];
  if (forced) {
    dealt = forced.map((h) => [...h]);
  } else {
    const [deck, rng] = shuffle(DECK, state.rng);
    state.rng = rng;
    dealt = Array.from({ length: n }, (_, i) => deck.slice(i * 3, i * 3 + 3));
  }
  state.hand = {
    number,
    mano,
    dealt,
    cards: dealt.map((h) => [...h]),
    bazas: [{ leader: mano, plays: [], winner: null, winnerSeat: null }],
    turn: mano,
    trucoValue: 1,
    trucoHolder: null,
    pending: null,
    suspended: null,
    envidoDone: false,
    florDone: !state.config.flor,
    events: [{ t: 'deal', hand: number, mano }],
  };
}

// ---------- acciones legales ----------

const inFirstBaza = (h: HandState) => h.bazas.length === 1;
const canEnvido = (h: HandState) => inFirstBaza(h) && !h.envidoDone && h.trucoValue === 1 && h.trucoHolder === null;

function canFlor(state: GameState, seat: number): boolean {
  const h = state.hand;
  return !h.florDone && inFirstBaza(h) && hasFlor(h.dealt[seat]);
}

function envidoRaises(chain: EnvidoCall[]): EnvidoCall[] {
  const out: EnvidoCall[] = [];
  const has = (c: EnvidoCall) => chain.includes(c);
  if (!has('real') && !has('falta') && chain.filter((c) => c === 'envido').length < 2) out.push('envido');
  if (!has('real') && !has('falta')) out.push('real');
  if (!has('falta')) out.push('falta');
  return out;
}

export function legalActions(state: GameState, seat: number): Action[] {
  const h = state.hand;
  if (state.winner !== null || seat < 0 || seat >= state.config.players) return [];
  const team = teamOf(seat);
  const out: Action[] = [];
  const p = h.pending;

  if (p) {
    if (p.by === team) return []; // esperando la respuesta del rival
    if (p.kind === 'flor') {
      if (hasFlor(h.dealt[seat])) out.push({ type: 'achico' }, { type: 'contraflor' }, { type: 'contraflor_resto' });
      return out;
    }
    out.push({ type: 'quiero' }, { type: 'no_quiero' });
    if (p.kind === 'truco') {
      if (p.level < 4) out.push({ type: 'truco' });
      if (p.level === 2 && canEnvido(h)) {
        for (const call of envidoRaises([])) out.push({ type: 'envido', call });
      }
    } else {
      for (const call of envidoRaises(p.chain)) out.push({ type: 'envido', call });
    }
    if (canFlor(state, seat) && (p.kind === 'envido' || (p.kind === 'truco' && p.level === 2 && canEnvido(h)))) {
      out.push({ type: 'flor' });
    }
    out.push({ type: 'mazo' });
    return out;
  }

  if (seat !== h.turn) return [];
  for (const card of h.cards[seat]) out.push({ type: 'play', card });
  if (h.trucoValue < 4 && (h.trucoHolder === null || h.trucoHolder === team)) out.push({ type: 'truco' });
  if (canEnvido(h)) for (const call of envidoRaises([])) out.push({ type: 'envido', call });
  if (canFlor(state, seat)) out.push({ type: 'flor' });
  out.push({ type: 'mazo' });
  return out;
}

// Se compara campo por campo: las jugadas que vuelven de la base (jsonb) llegan con las claves en otro orden.
const actionKey = (a: Action) => `${a.type}:${'card' in a ? a.card : 'call' in a ? a.call : ''}`;
const sameAction = (a: Action, b: Action) => actionKey(a) === actionKey(b);

// ---------- aplicar acción ----------

export function applyAction(prev: GameState, seat: number, action: Action): GameState {
  if (!legalActions(prev, seat).some((a) => sameAction(a, action))) {
    throw new IllegalMove(`Jugada ilegal para el asiento ${seat}: ${JSON.stringify(action)}`);
  }
  const state = structuredClone(prev);
  const h = state.hand;
  const team = teamOf(seat);
  const p = h.pending;

  switch (action.type) {
    case 'play':
      playCard(state, seat, action.card);
      break;

    case 'truco':
      if (p && p.kind === 'truco') {
        // subir = aceptar el nivel anterior y cantar el siguiente
        h.trucoValue = p.level;
        h.trucoHolder = null;
        h.pending = { kind: 'truco', level: (p.level + 1) as 3 | 4, by: team, seat };
      } else {
        h.pending = { kind: 'truco', level: (h.trucoValue + 1) as 2 | 3 | 4, by: team, seat };
      }
      h.events.push({ t: 'call', seat, call: TRUCO_NAMES[h.pending.kind === 'truco' ? h.pending.level : 2] });
      break;

    case 'envido':
      if (p && p.kind === 'envido') {
        h.pending = { kind: 'envido', chain: [...p.chain, action.call], by: team, seat };
      } else {
        if (p && p.kind === 'truco') h.suspended = p; // el envido está primero
        h.pending = { kind: 'envido', chain: [action.call], by: team, seat };
      }
      h.events.push({ t: 'call', seat, call: action.call });
      break;

    case 'flor':
      singFlor(state, seat);
      break;

    case 'quiero':
      if (p!.kind === 'truco') {
        h.events.push({ t: 'quiero', seat, to: 'truco' });
        h.trucoValue = p!.level;
        h.trucoHolder = team;
        h.pending = null;
      } else if (p!.kind === 'envido') {
        h.events.push({ t: 'quiero', seat, to: 'envido' });
        resolveEnvido(state, p!.chain);
      }
      break;

    case 'no_quiero':
      if (p!.kind === 'truco') {
        h.events.push({ t: 'no_quiero', seat, to: 'truco' });
        endHand(state, p!.by, h.trucoValue);
      } else if (p!.kind === 'envido') {
        h.events.push({ t: 'no_quiero', seat, to: 'envido' });
        rejectEnvido(state, p!);
      }
      break;

    case 'achico':
    case 'contraflor':
    case 'contraflor_resto':
      answerFlor(state, seat, action.type);
      break;

    case 'mazo':
      h.events.push({ t: 'mazo', seat });
      stats(state).teams[team].mazos++;
      if (p && p.kind === 'envido') {
        rejectEnvido(state, p);
        if (state.winner !== null) break;
      }
      endHand(state, other(team), h.trucoValue + (inFirstBaza(h) && !h.envidoDone ? 1 : 0));
      break;
  }
  return state;
}

// ---------- bazas ----------

function playCard(state: GameState, seat: number, card: CardId) {
  const h = state.hand;
  const n = state.config.players;
  h.cards[seat] = h.cards[seat].filter((c) => c !== card);
  const baza = h.bazas[h.bazas.length - 1];
  baza.plays.push({ seat, card });
  h.events.push({ t: 'play', seat, card });

  if (baza.plays.length < n) {
    h.turn = (seat + 1) % n;
    return;
  }

  // baza completa
  const top = Math.max(...baza.plays.map((x) => rank(x.card)));
  const best = baza.plays.filter((x) => rank(x.card) === top);
  const teams = new Set(best.map((x) => teamOf(x.seat)));
  if (teams.size > 1) {
    baza.winner = 'parda';
    baza.winnerSeat = null;
  } else {
    baza.winner = teamOf(best[0].seat);
    baza.winnerSeat = best[0].seat;
  }
  h.events.push({ t: 'baza', index: h.bazas.length - 1, winner: baza.winner, seat: baza.winnerSeat });
  if (baza.winner !== 'parda') stats(state).teams[baza.winner].bazas++;

  const winner = handWinner(h);
  if (winner !== null) {
    endHand(state, winner, h.trucoValue);
    return;
  }
  const leader = baza.winnerSeat ?? baza.leader;
  h.bazas.push({ leader, plays: [], winner: null, winnerSeat: null });
  h.turn = leader;
}

/** Ganador de la mano según las bazas jugadas, o null si todavía no se decide. */
export function handWinner(h: HandState): Team | null {
  const r = h.bazas.filter((b) => b.winner !== null).map((b) => b.winner as Team | 'parda');
  const wins = (t: Team) => r.filter((x) => x === t).length;
  if (wins(0) >= 2) return 0;
  if (wins(1) >= 2) return 1;
  if (r.length === 2) {
    if (r[0] === 'parda' && r[1] !== 'parda') return r[1];
    if (r[0] !== 'parda' && r[1] === 'parda') return r[0];
    return null;
  }
  if (r.length === 3) {
    if (r[2] === 'parda') {
      if (r[0] !== 'parda') return r[0];
      if (r[1] !== 'parda') return r[1];
      return teamOf(h.mano);
    }
    return r[2];
  }
  return null;
}

// ---------- puntos ----------

function addPoints(state: GameState, team: Team, pts: number, reason: string): boolean {
  if (pts <= 0) return false;
  state.score[team] += pts;
  state.hand.events.push({ t: 'points', team, pts, reason });
  const t = stats(state).teams[team];
  if (reason === 'mano') t.puntosTruco += pts;
  else if (reason.startsWith('envido')) {
    t.envidos++;
    t.puntosEnvido += pts;
  } else t.flores++;
  if (state.score[team] >= state.config.target) {
    state.winner = team;
    state.hand.pending = null;
    state.hand.suspended = null;
    state.hand.events.push({ t: 'game_end', winner: team });
    state.lastHand = { number: state.hand.number, winner: null, events: state.hand.events };
    return true;
  }
  return false;
}

/** Valor de la falta: lo que le falta al que va ganando; a 30 y en las malas, el partido. */
export function faltaPoints(state: GameState, winner: Team): number {
  const leader = Math.max(...state.score);
  if (state.config.target === 30 && leader < 15) return state.config.target - state.score[winner];
  return state.config.target - leader;
}

function endHand(state: GameState, winner: Team, pts: number) {
  const h = state.hand;
  h.pending = null;
  h.suspended = null;
  h.events.push({ t: 'hand_end', winner, pts });
  const t = stats(state).teams[winner];
  t.manos++;
  if (h.events.some((e) => e.t === 'call' && (e.call === 'truco' || e.call === 'retruco' || e.call === 'vale4'))) t.trucos++;
  if (addPoints(state, winner, pts, 'mano')) return;
  state.lastHand = { number: h.number, winner, events: h.events };
  startHand(state, (h.mano + 1) % state.config.players, h.number + 1);
}

/** Recorre asientos desde la mano: ante empate gana el más cercano a la mano. */
function bestOf(state: GameState, seats: number[], value: (seat: number) => number) {
  const n = state.config.players;
  let best: { seat: number; value: number } | null = null;
  for (let i = 0; i < n; i++) {
    const seat = (state.hand.mano + i) % n;
    if (!seats.includes(seat)) continue;
    const v = value(seat);
    if (!best || v > best.value) best = { seat, value: v };
  }
  return best!;
}

function resumeAfterTanto(h: HandState) {
  h.pending = h.suspended;
  h.suspended = null;
}

function resolveEnvido(state: GameState, chain: EnvidoCall[]) {
  const h = state.hand;
  const all = Array.from({ length: state.config.players }, (_, i) => i);
  const win = bestOf(state, all, (s) => envidoPoints(h.dealt[s]));
  const winner = teamOf(win.seat);
  h.events.push({ t: 'tanto', kind: 'envido', seat: win.seat, value: win.value });
  const best = stats(state).mejorEnvido;
  best[win.seat] = Math.max(best[win.seat] ?? 0, win.value);
  h.envidoDone = true;
  const pts = chain.includes('falta') ? faltaPoints(state, winner) : chain.reduce((s, c) => s + ENVIDO_VALUES[c], 0);
  if (addPoints(state, winner, pts, 'envido')) return;
  resumeAfterTanto(h);
}

function rejectEnvido(state: GameState, p: Extract<Pending, { kind: 'envido' }>) {
  const h = state.hand;
  h.envidoDone = true;
  const pts = p.chain.length === 1 ? 1 : p.chain.slice(0, -1).reduce((s, c) => s + ENVIDO_VALUES[c], 0);
  if (addPoints(state, p.by, pts, 'envido no querido')) return;
  resumeAfterTanto(h);
}

function singFlor(state: GameState, seat: number) {
  const h = state.hand;
  const team = teamOf(seat);
  h.events.push({ t: 'call', seat, call: 'flor' });
  // la flor anula el envido; un truco pendiente queda esperando
  const resumeTo = h.pending?.kind === 'envido' ? h.suspended : h.pending;
  h.envidoDone = true;
  const rivalHasFlor = Array.from({ length: state.config.players }, (_, i) => i).some(
    (s) => teamOf(s) !== team && hasFlor(h.dealt[s]),
  );
  if (rivalHasFlor) {
    h.suspended = resumeTo;
    h.pending = { kind: 'flor', by: team, seat };
    return;
  }
  h.florDone = true;
  h.pending = resumeTo;
  h.suspended = null;
  addPoints(state, team, 3, 'flor');
}

function answerFlor(state: GameState, seat: number, answer: 'achico' | 'contraflor' | 'contraflor_resto') {
  const h = state.hand;
  const p = h.pending as Extract<Pending, { kind: 'flor' }>;
  h.florDone = true;
  h.events.push({ t: 'call', seat, call: answer });
  if (answer === 'achico') {
    if (addPoints(state, p.by, 4, 'flor')) return;
  } else {
    const withFlor = Array.from({ length: state.config.players }, (_, i) => i).filter((s) => hasFlor(h.dealt[s]));
    const win = bestOf(state, withFlor, (s) => florPoints(h.dealt[s]));
    const winner = teamOf(win.seat);
    h.events.push({ t: 'tanto', kind: 'flor', seat: win.seat, value: win.value });
    const pts = answer === 'contraflor' ? 6 : faltaPoints(state, winner);
    if (addPoints(state, winner, pts, answer)) return;
  }
  resumeAfterTanto(h);
}

// ---------- vista por jugador ----------

export interface PlayerView {
  config: Config;
  seat: number;
  team: Team;
  score: [number, number];
  winner: Team | null;
  hand: {
    number: number;
    mano: number;
    turn: number;
    myCards: CardId[];
    cardsLeft: number[];
    bazas: Baza[];
    trucoValue: number;
    trucoHolder: Team | null;
    pending: Pending | null;
    suspended: Pending | null;
    events: GameEvent[];
  };
  lastHand: HandSummary | null;
  stats: MatchStats;
  legal: Action[];
}

/** Lo único que viaja al cliente: nunca incluye cartas ajenas sin jugar ni el estado del RNG. */
export function viewFor(state: GameState, seat: number): PlayerView {
  const h = state.hand;
  return structuredClone({
    config: state.config,
    seat,
    team: teamOf(seat),
    score: state.score,
    winner: state.winner,
    hand: {
      number: h.number,
      mano: h.mano,
      turn: h.turn,
      myCards: h.cards[seat],
      cardsLeft: h.cards.map((c) => c.length),
      bazas: h.bazas,
      trucoValue: h.trucoValue,
      trucoHolder: h.trucoHolder,
      pending: h.pending,
      suspended: h.suspended,
      events: h.events,
    },
    lastHand: state.lastHand,
    stats: state.stats ?? emptyStats(),
    legal: legalActions(state, seat),
  });
}
