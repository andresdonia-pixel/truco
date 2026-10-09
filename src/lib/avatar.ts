// Configuración del personaje. Se guarda como JSON chico en profiles.avatar.
// Cualquier valor desconocido se reemplaza por el default (sanitize), así un JSON viejo o manipulado no rompe nada.

export const AVATAR_OPTIONS = {
  cara: { ovalada: 'Ovalada', redonda: 'Redonda', cuadrada: 'Cuadrada', alargada: 'Alargada' },
  piel: { p1: '#f6d7c3', p2: '#eab991', p3: '#d49a6a', p4: '#a86b44', p5: '#7a4a2c', p6: '#4e2f1d' },
  pelo: {
    pelado: 'Pelado',
    corto: 'Corto',
    jopo: 'Jopo',
    rulos: 'Rulos',
    largo: 'Largo',
    rodete: 'Rodete',
    mohicano: 'Cresta',
    boina: 'Boina',
  },
  colorPelo: { negro: '#231a14', castano: '#5b3a22', rubio: '#d9b45a', colorado: '#b24a1f', canoso: '#c9c4bc', azul: '#2f5d8a' },
  barba: { ninguna: 'Sin barba', bigote: 'Bigote', manubrio: 'Manubrio', candado: 'Candado', corta: 'Barba corta', larga: 'Barba larga' },
  ojos: { normales: 'Normales', felices: 'Felices', canchero: 'Cancheros', sospecha: 'Desconfiado', guino: 'Guiño', anteojos: 'Anteojos' },
  labios: { sonrisa: 'Sonrisa', serio: 'Serio', picaro: 'Pícaro', rojos: 'Labios rojos', grito: 'Grito' },
  fondo: { pano: '#2b6a50', oro: '#c9a227', rojo: '#a8322a', azul: '#2f5d8a', papel: '#ede3cb', violeta: '#6b4a8a' },
} as const;

type Opts = typeof AVATAR_OPTIONS;
export type AvatarConfig = { [K in keyof Opts]: keyof Opts[K] & string };
export type AvatarPart = keyof Opts;

export const AVATAR_PART_LABELS: Record<AvatarPart, string> = {
  cara: 'Cara',
  piel: 'Piel',
  pelo: 'Pelo',
  colorPelo: 'Color de pelo',
  barba: 'Barba',
  ojos: 'Ojos',
  labios: 'Labios',
  fondo: 'Fondo',
};

/** Partes que se eligen por color (muestras) y no por forma. */
export const COLOR_PARTS: AvatarPart[] = ['piel', 'colorPelo', 'fondo'];

export const DEFAULT_AVATAR: AvatarConfig = {
  cara: 'ovalada',
  piel: 'p2',
  pelo: 'corto',
  colorPelo: 'castano',
  barba: 'ninguna',
  ojos: 'normales',
  labios: 'sonrisa',
  fondo: 'pano',
};

export function sanitizeAvatar(raw: unknown): AvatarConfig {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_AVATAR } as Record<string, string>;
  for (const part of Object.keys(AVATAR_OPTIONS) as AvatarPart[]) {
    const v = src[part];
    if (typeof v === 'string' && v in AVATAR_OPTIONS[part]) out[part] = v;
  }
  return out as AvatarConfig;
}

export function randomAvatar(rnd: () => number = Math.random): AvatarConfig {
  const out = {} as Record<string, string>;
  for (const part of Object.keys(AVATAR_OPTIONS) as AvatarPart[]) {
    const keys = Object.keys(AVATAR_OPTIONS[part]);
    out[part] = keys[Math.floor(rnd() * keys.length)];
  }
  // la "grito" queda para cuando canta; de base, una cara más tranquila
  if (out.labios === 'grito') out.labios = 'picaro';
  return out as AvatarConfig;
}

/** Personajes fijos para la máquina, uno por asiento. */
export const BOT_AVATARS: AvatarConfig[] = [
  DEFAULT_AVATAR,
  { cara: 'alargada', piel: 'p3', pelo: 'boina', colorPelo: 'canoso', barba: 'manubrio', ojos: 'sospecha', labios: 'serio', fondo: 'rojo' }, // El Mago
  { cara: 'redonda', piel: 'p2', pelo: 'rulos', colorPelo: 'colorado', barba: 'ninguna', ojos: 'felices', labios: 'sonrisa', fondo: 'oro' }, // Coco
  { cara: 'ovalada', piel: 'p1', pelo: 'rodete', colorPelo: 'negro', barba: 'ninguna', ojos: 'canchero', labios: 'rojos', fondo: 'violeta' }, // La Viuda
  { cara: 'ovalada', piel: 'p4', pelo: 'largo', colorPelo: 'rubio', barba: 'ninguna', ojos: 'guino', labios: 'picaro', fondo: 'azul' }, // Pepa
  { cara: 'cuadrada', piel: 'p5', pelo: 'pelado', colorPelo: 'negro', barba: 'larga', ojos: 'anteojos', labios: 'serio', fondo: 'papel' }, // Tito
];

const STORAGE_KEY = 'truco.avatar';

export function loadLocalAvatar(): AvatarConfig | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeAvatar(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveLocalAvatar(a: AvatarConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
  } catch {
    /* sin almacenamiento local: no pasa nada */
  }
}
