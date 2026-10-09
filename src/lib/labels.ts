import { parseCard } from '@/engine/cards.ts';
import type { Action, GameEvent, Pending, PlayerView } from '@/engine/engine.ts';

const PALO: Record<string, string> = { e: 'espada', b: 'basto', o: 'oro', c: 'copa' };
export const cardName = (id: string) => {
  const { n, s } = parseCard(id);
  return `${n} de ${PALO[s]}`;
};

const CALLS: Record<string, string> = {
  truco: '¡Truco!',
  retruco: '¡Quiero retruco!',
  vale4: '¡Quiero vale cuatro!',
  envido: 'Envido',
  real: 'Real envido',
  falta: 'Falta envido',
  flor: '¡Flor!',
  achico: 'Con flor me achico',
  contraflor: 'Contraflor',
  contraflor_resto: 'Contraflor al resto',
};
export const callText = (call: string) => CALLS[call] ?? call;

const NEXT_TRUCO: Record<number, string> = { 2: 'Truco', 3: 'Quiero retruco', 4: 'Quiero vale cuatro' };

export function actionLabel(a: Action, v: PlayerView): string {
  switch (a.type) {
    case 'truco': {
      const p = v.hand.pending;
      const level = p?.kind === 'truco' ? p.level + 1 : v.hand.trucoValue + 1;
      return NEXT_TRUCO[level];
    }
    case 'envido':
      return CALLS[a.call];
    case 'flor':
      return 'Flor';
    case 'achico':
    case 'contraflor':
    case 'contraflor_resto':
      return CALLS[a.type];
    case 'quiero':
      return 'Quiero';
    case 'no_quiero':
      return 'No quiero';
    case 'mazo':
      return 'Irme al mazo';
    case 'play':
      return `Jugar ${cardName(a.card)}`;
  }
}

export function pendingText(p: Pending): string {
  if (p.kind === 'truco') return CALLS[{ 2: 'truco', 3: 'retruco', 4: 'vale4' }[p.level]];
  if (p.kind === 'flor') return CALLS.flor;
  return p.chain.map((c) => CALLS[c]).join(', ');
}

const BAZA = ['Primera', 'Segunda', 'Tercera'];

/** Texto de cada evento para el registro de la mesa. `teamName(t)` devuelve "Nosotros"/"Ellos". */
export function eventText(e: GameEvent, name: (seat: number) => string, teamName: (t: 0 | 1) => string): string | null {
  const vos = (seat: number) => name(seat) === 'Vos';
  switch (e.t) {
    case 'deal':
      return `Mano ${e.hand}. Reparte y sale ${name(e.mano)}.`;
    case 'play':
      return `${name(e.seat)} ${vos(e.seat) ? 'jugás' : 'juega'} el ${cardName(e.card)}.`;
    case 'call':
      return `${name(e.seat)}: ${callText(e.call)}`;
    case 'quiero':
      return `${name(e.seat)}: Quiero.`;
    case 'no_quiero':
      return `${name(e.seat)}: No quiero.`;
    case 'mazo':
      return vos(e.seat) ? 'Te vas al mazo.' : `${name(e.seat)} se va al mazo.`;
    case 'baza':
      return e.winner === 'parda' ? `${BAZA[e.index]}: parda.` : `${BAZA[e.index]} para ${teamName(e.winner)}.`;
    case 'tanto':
      return `${name(e.seat)} ${vos(e.seat) ? 'tenés' : 'tiene'} ${e.value} de ${e.kind}.`;
    case 'points':
      return `+${e.pts} para ${teamName(e.team)} (${e.reason}).`;
    case 'hand_end':
      return null;
    case 'game_end':
      return null;
  }
}

/** Explicación corta de cada canto, para quien está aprendiendo. */
export function actionHelp(a: Action, v: PlayerView): string {
  const p = v.hand.pending;
  switch (a.type) {
    case 'truco': {
      const level = p?.kind === 'truco' ? p.level + 1 : v.hand.trucoValue + 1;
      return `Si te quieren, la mano pasa a valer ${level} puntos. Si no te quieren, te llevás ${level - 1}.`;
    }
    case 'envido':
      return a.call === 'envido'
        ? 'Apostás 2 puntos a que tenés más envido. Si no te quieren, ganás 1.'
        : a.call === 'real'
          ? 'Apostás 3 puntos a que tenés más envido. Si no te quieren, ganás 1.'
          : 'Te jugás lo que le falta al que va ganando. En las malas, puede definir el partido.';
    case 'flor':
      return 'Tenés las tres cartas del mismo palo: cantala y sumás 3 puntos.';
    case 'quiero':
      return p?.kind === 'envido' ? 'Aceptás: se comparan los envidos y el mejor se lleva los puntos.' : 'Aceptás: se sigue jugando y la mano vale lo cantado.';
    case 'no_quiero':
      return p?.kind === 'envido' ? 'No aceptás: el rival se lleva lo que valía antes del último canto.' : 'No aceptás: la mano termina y el rival se lleva lo que valía antes.';
    case 'achico':
      return 'Reconocés su flor: le das 4 puntos sin comparar.';
    case 'contraflor':
      return 'Comparan las flores: la mejor se lleva 6 puntos.';
    case 'contraflor_resto':
      return 'Comparan las flores y se juega la falta.';
    case 'mazo':
      return 'Abandonás la mano: el rival se lleva lo que valía.';
    case 'play':
      return '';
  }
}
