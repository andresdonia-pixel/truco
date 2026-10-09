// Jugador automático. Decide sólo con lo que ve su asiento (PlayerView): nunca mira cartas ajenas.
// Heurísticas simples de mesa: canta envido con buenos puntos, truco con buenas cartas,
// mata la baza con la carta más baja que alcance y de vez en cuando se tira un farol.

import { envidoPoints, florPoints, hasFlor, rank } from './cards.ts';
import type { CardId } from './cards.ts';
import type { Action, EnvidoCall, PlayerView } from './engine.ts';

export type Rng = () => number;

const ENVIDO_VALUE: Record<EnvidoCall, number> = { envido: 2, real: 3, falta: 6 };

function has(legal: Action[], pred: (a: Action) => boolean): Action | undefined {
  return legal.find(pred);
}

/** Las tres cartas con las que arrancó la mano (las que quedan + las que ya jugó). */
function dealtCards(v: PlayerView): CardId[] {
  const played = v.hand.bazas.flatMap((b) => b.plays.filter((p) => p.seat === v.seat).map((p) => p.card));
  return [...v.hand.myCards, ...played];
}

/** Qué tan buena viene la mano para el truco, de 0 a ~1. */
export function trucoStrength(v: PlayerView): number {
  const team = v.team;
  const ranks = v.hand.myCards.map(rank).sort((a, b) => b - a);
  const done = v.hand.bazas.filter((b) => b.winner !== null);
  const won = done.filter((b) => b.winner === team).length;
  const lost = done.filter((b) => b.winner !== 'parda' && b.winner !== team).length;
  const pardas = done.filter((b) => b.winner === 'parda').length;

  let p: number;
  if (ranks.length === 0) p = 0.5;
  else if (ranks.length === 1) p = ranks[0] / 14;
  else p = (ranks[0] / 14) * 0.65 + (ranks[1] / 14) * 0.35;

  if (won > lost) p += 0.25;
  if (lost > won) p -= 0.3;
  if (pardas && won === lost) p += (ranks[0] ?? 0) >= 10 ? 0.15 : -0.1;

  // en la baza en juego: ¿ya me están ganando con algo que no alcanzo?
  const current = v.hand.bazas[v.hand.bazas.length - 1];
  const oppBest = Math.max(0, ...current.plays.filter((x) => x.seat % 2 !== team).map((x) => rank(x.card)));
  if (oppBest && (ranks[0] ?? 0) < oppBest) p -= 0.15;

  if (v.config.players > 2) p += 0.03 * (v.config.players / 2); // los compañeros también juegan
  return Math.max(0, Math.min(1, p));
}

function chooseCard(v: PlayerView): CardId {
  const team = v.team;
  const mine = [...v.hand.myCards].sort((a, b) => rank(a) - rank(b)); // de menor a mayor
  const current = v.hand.bazas[v.hand.bazas.length - 1];
  const first = v.hand.bazas.length === 1;

  if (current.plays.length === 0) {
    // salgo yo: en primera, una del medio; después, la mejor para cerrar
    if (first && mine.length === 3) return mine[1];
    return mine[mine.length - 1];
  }

  const oppBest = Math.max(0, ...current.plays.filter((x) => x.seat % 2 !== team).map((x) => rank(x.card)));
  const partnerBest = Math.max(0, ...current.plays.filter((x) => x.seat % 2 === team).map((x) => rank(x.card)));
  if (partnerBest > oppBest) return mine[0]; // la está ganando el compañero: tiro la más baja

  const winner = mine.find((c) => rank(c) > oppBest);
  if (winner) return winner; // la más baja que mata
  const tie = mine.find((c) => rank(c) === oppBest);
  if (tie && first) return tie; // parda en primera: después define la mejor
  return mine[0]; // no llego: la tiro baja
}

export function botAction(v: PlayerView, rnd: Rng = Math.random): Action {
  const legal = v.legal;
  if (legal.length === 0) throw new Error('El bot no tiene jugadas');
  const p = v.hand.pending;
  const dealt = dealtCards(v);
  const env = envidoPoints(dealt);
  const strength = trucoStrength(v);
  const isMano = v.hand.mano === v.seat;
  const pick = (a: Action | undefined) => (a && legal.some((l) => JSON.stringify(l) === JSON.stringify(a)) ? a : undefined);

  // con flor, siempre se canta
  const flor = has(legal, (a) => a.type === 'flor');
  if (flor) return flor;

  if (p) {
    if (p.kind === 'flor') {
      const fp = hasFlor(dealt) ? florPoints(dealt) : 0;
      if (fp >= 34) return pick({ type: 'contraflor_resto' }) ?? legal[0];
      if (fp >= 30) return pick({ type: 'contraflor' }) ?? legal[0];
      return pick({ type: 'achico' }) ?? legal[0];
    }

    if (p.kind === 'envido') {
      const value = p.chain.reduce((s, c) => s + ENVIDO_VALUE[c], 0);
      const bonus = isMano ? 1 : 0;
      if (env + bonus >= 31) {
        const raise =
          (env >= 32 && pick({ type: 'envido', call: 'falta' })) ||
          pick({ type: 'envido', call: 'real' }) ||
          pick({ type: 'envido', call: 'envido' });
        if (raise && rnd() < 0.6) return raise;
      }
      const need = p.chain.includes('falta') ? 31 : value <= 2 ? 26 : value <= 4 ? 28 : 29;
      if (env + bonus >= need || rnd() < 0.05) return pick({ type: 'quiero' })!;
      return pick({ type: 'no_quiero' })!;
    }

    // truco pendiente: el envido está primero
    if (env >= 28) {
      const e = pick({ type: 'envido', call: env >= 31 ? 'real' : 'envido' });
      if (e) return e;
    }
    const level = p.level;
    if (strength > 0.8 && pick({ type: 'truco' }) && rnd() < 0.7) return { type: 'truco' };
    const need = 0.45 + (level - 2) * 0.08;
    if (strength >= need || rnd() < 0.07) return pick({ type: 'quiero' })!;
    return pick({ type: 'no_quiero' })!;
  }

  // me toca: primero los cantos
  const canEnvido = legal.some((a) => a.type === 'envido');
  if (canEnvido) {
    if (env >= 31 && rnd() < 0.5) return pick({ type: 'envido', call: 'real' }) ?? pick({ type: 'envido', call: 'envido' })!;
    if (env >= 27) return pick({ type: 'envido', call: 'envido' })!;
    if (rnd() < 0.06) return pick({ type: 'envido', call: 'envido' })!; // farol
  }

  const truco = pick({ type: 'truco' });
  if (truco) {
    const lastCard = v.hand.myCards.length === 1;
    if (strength > 0.72 && rnd() < 0.8) return truco;
    if (lastCard && rnd() < 0.08) return truco; // farol con la última
  }

  return { type: 'play', card: chooseCard(v) };
}
