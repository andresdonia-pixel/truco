// Frases rápidas y señas del truco.

export const FRASES = [
  '¡Mentiroso!',
  'Andá a cantarle a Gardel',
  'Me voy al mazo, compañero',
  '¡Esa no la vi venir!',
  'Dale que se enfría el mate',
  'Tengo un hambre…',
  '¡Qué suerte, che!',
  'Bien jugado',
  'Vamos que se puede',
  'Te quedaste sin nada, ¿no?',
  '¡A la bolsa!',
  'Buena partida, gente',
];

/** Lo que dice la máquina cuando le va bien o cuando le cantan. */
export const FRASES_BOT = {
  gana: ['¡A la bolsa!', 'Andá a cantarle a Gardel', '¡Esa no la viste venir!', 'Uno más para el anotador'],
  noQuiere: ['¡Gallina!', 'Me lo imaginaba…', 'Te faltó coraje'],
  canta: ['¡A ver si te animás!', 'Tengo con qué, eh', '¿Y ahora?'],
};

export type Gesto = 'cejas' | 'guino' | 'boca_der' | 'boca_izq' | 'labio' | 'trompa' | 'boca_abierta' | 'cachetes' | 'ojos_cerrados';

/** Las señas de siempre. Varían según la mesa; éstas son las más difundidas. */
export const SENAS: { id: Gesto; gesto: string; significa: string }[] = [
  { id: 'cejas', gesto: 'Levantar las cejas', significa: 'Ancho de espada' },
  { id: 'guino', gesto: 'Guiñar un ojo', significa: 'Ancho de basto' },
  { id: 'boca_der', gesto: 'Torcer la boca a la derecha', significa: 'Siete de espada' },
  { id: 'boca_izq', gesto: 'Torcer la boca a la izquierda', significa: 'Siete de oro' },
  { id: 'labio', gesto: 'Morderse el labio', significa: 'Un tres' },
  { id: 'trompa', gesto: 'Hacer trompita', significa: 'Un dos' },
  { id: 'boca_abierta', gesto: 'Abrir la boca', significa: 'Un ancho falso' },
  { id: 'cachetes', gesto: 'Inflar los cachetes', significa: 'Tengo flor' },
  { id: 'ojos_cerrados', gesto: 'Cerrar los ojos', significa: 'No tengo nada' },
];

export const SENA_PREFIX = '::sena:';
export const esSena = (body: string) => body.startsWith(SENA_PREFIX);
export const senaDe = (body: string): Gesto | null => {
  const id = body.slice(SENA_PREFIX.length) as Gesto;
  return SENAS.some((s) => s.id === id) ? id : null;
};

/** La mejor seña que corresponde a una mano (para el compañero máquina). */
export function senaParaMano(cards: string[], conFlor: boolean): Gesto {
  const has = (c: string) => cards.includes(c);
  if (has('1e')) return 'cejas';
  if (has('1b')) return 'guino';
  if (has('7e')) return 'boca_der';
  if (has('7o')) return 'boca_izq';
  if (conFlor && cards.length === 3 && cards.every((c) => c.slice(-1) === cards[0].slice(-1))) return 'cachetes';
  if (cards.some((c) => c.startsWith('3'))) return 'labio';
  if (cards.some((c) => c.startsWith('2'))) return 'trompa';
  if (has('1o') || has('1c')) return 'boca_abierta';
  return 'ojos_cerrados';
}
