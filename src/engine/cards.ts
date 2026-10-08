// Baraja española de 40 cartas (sin 8 ni 9) y utilidades de truco argentino.
// Formato de carta: número + palo, ej. "1e" (ancho de espada), "12c" (rey de copa).

export type Suit = 'e' | 'b' | 'o' | 'c'; // espada, basto, oro, copa
export type CardId = string;

export const SUITS: Suit[] = ['e', 'b', 'o', 'c'];
export const NUMBERS = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
export const SUIT_NAMES: Record<Suit, string> = { e: 'espada', b: 'basto', o: 'oro', c: 'copa' };

export const DECK: CardId[] = SUITS.flatMap((s) => NUMBERS.map((n) => `${n}${s}`));

export function parseCard(id: CardId): { n: number; s: Suit } {
  const s = id.slice(-1) as Suit;
  const n = Number(id.slice(0, -1));
  if (!SUITS.includes(s) || !NUMBERS.includes(n)) throw new Error(`Carta inválida: ${id}`);
  return { n, s };
}

/** Jerarquía del truco: más alto = más fuerte (14 = ancho de espada, 1 = los cuatros). */
export function rank(id: CardId): number {
  const { n, s } = parseCard(id);
  if (n === 1 && s === 'e') return 14;
  if (n === 1 && s === 'b') return 13;
  if (n === 7 && s === 'e') return 12;
  if (n === 7 && s === 'o') return 11;
  const order: Record<number, number> = { 3: 10, 2: 9, 1: 8, 12: 7, 11: 6, 10: 5, 7: 4, 6: 3, 5: 2, 4: 1 };
  return order[n];
}

const tantoValue = (n: number) => (n >= 10 ? 0 : n);

/** Puntos de envido de una mano de 3 cartas (máximo 33). */
export function envidoPoints(cards: CardId[]): number {
  const bySuit = new Map<Suit, number[]>();
  for (const c of cards) {
    const { n, s } = parseCard(c);
    bySuit.set(s, [...(bySuit.get(s) ?? []), tantoValue(n)]);
  }
  let best = 0;
  for (const values of bySuit.values()) {
    values.sort((a, b) => b - a);
    best = Math.max(best, values.length >= 2 ? 20 + values[0] + values[1] : values[0]);
  }
  return best;
}

export function hasFlor(cards: CardId[]): boolean {
  return cards.length === 3 && cards.every((c) => parseCard(c).s === parseCard(cards[0]).s);
}

export function florPoints(cards: CardId[]): number {
  return 20 + cards.reduce((sum, c) => sum + tantoValue(parseCard(c).n), 0);
}

/** PRNG determinístico (mulberry32). Devuelve [valor en [0,1), nuevo estado]. */
export function nextRandom(state: number): [number, number] {
  const a = (state + 0x6d2b79f5) >>> 0;
  let t = a;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

export function shuffle(deck: CardId[], rngState: number): [CardId[], number] {
  const out = [...deck];
  let st = rngState;
  for (let i = out.length - 1; i > 0; i--) {
    const [r, next] = nextRandom(st);
    st = next;
    const j = Math.floor(r * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return [out, st];
}
