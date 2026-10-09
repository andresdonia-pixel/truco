import { parseCard } from '@/engine/cards.ts';
import type { Suit } from '@/engine/cards.ts';

const SUIT_COLOR: Record<Suit, string> = {
  o: 'var(--color-oro)',
  c: 'var(--color-rojo)',
  e: 'var(--color-espada)',
  b: 'var(--color-basto)',
};
const SUIT_LABEL: Record<Suit, string> = { o: 'oro', c: 'copa', e: 'espada', b: 'basto' };
const FIGURE: Record<number, string> = { 10: 'sota', 11: 'caballo', 12: 'rey' };

/** Íconos de palo propios, dibujados en un cuadro de 40x40. */
export function Palo({ suit, size = 40 }: { suit: Suit; size?: number }) {
  const c = SUIT_COLOR[suit];
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden>
      {suit === 'o' && (
        <g>
          <circle cx="20" cy="20" r="15" fill={c} />
          <circle cx="20" cy="20" r="10" fill="none" stroke="#7a5e0f" strokeWidth="1.6" />
          <circle cx="20" cy="20" r="3.2" fill="#7a5e0f" />
        </g>
      )}
      {suit === 'c' && (
        <g fill={c}>
          <path d="M8 6 h24 c0 10 -5 16 -12 17 c-7 -1 -12 -7 -12 -17z" />
          <rect x="18" y="22" width="4" height="9" />
          <path d="M11 35 c2 -4 16 -4 18 0z" />
        </g>
      )}
      {suit === 'e' && (
        <g fill={c}>
          <path d="M20 2 l3.5 6 v20 h-7 v-20z" />
          <rect x="10" y="27" width="20" height="3.5" rx="1.5" />
          <rect x="18.2" y="30" width="3.6" height="6" />
          <circle cx="20" cy="37.5" r="2.4" />
        </g>
      )}
      {suit === 'b' && (
        <g fill={c}>
          <path d="M16 37 l3 -31 c1 -4 9 -4 9 1 l-6 30z" />
          <circle cx="24" cy="13" r="2.2" fill="#6b4a1d" />
          <circle cx="21" cy="22" r="2" fill="#6b4a1d" />
          <circle cx="22.5" cy="30" r="1.6" fill="#6b4a1d" />
        </g>
      )}
    </svg>
  );
}

interface CartaProps {
  id: string;
  size?: 'mesa' | 'sm' | 'md' | 'lg';
  onClick?: () => void;
  disabled?: boolean;
  highlight?: boolean;
  dim?: boolean;
}

const SIZES = {
  xs: 'w-3 h-[18px] sm:w-3.5 sm:h-5',
  mesa: 'w-9 h-[54px] sm:w-12 sm:h-[72px]',
  sm: 'w-11 h-[66px]',
  md: 'w-16 h-24',
  lg: 'w-[86px] h-[129px] sm:w-24 sm:h-36',
};

export function Carta({ id, size = 'md', onClick, disabled, highlight, dim }: CartaProps) {
  const { n, s } = parseCard(id);
  const label = `${n} de ${SUIT_LABEL[s]}${FIGURE[n] ? ` (${FIGURE[n]})` : ''}`;
  const color = SUIT_COLOR[s];
  const big = size !== 'sm' && size !== 'mesa';
  const body = (
    <span
      className={`relative flex ${SIZES[size]} flex-col justify-between rounded-[10px] border bg-hueso ${size === 'mesa' ? 'p-1' : 'p-1.5'} text-tinta shadow-[0_3px_0_rgba(0,0,0,.35)] ${
        highlight ? 'border-oro ring-2 ring-oro' : 'border-[#cfc4a8]'
      } ${dim ? 'opacity-55' : ''}`}
    >
      <span className={`text-left font-bold leading-none ${size === 'mesa' ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'}`} style={{ color }}>
        {n}
      </span>
      <span className="flex justify-center">
        <Palo suit={s} size={size === 'lg' ? 46 : size === 'md' ? 34 : size === 'sm' ? 22 : 20} />
      </span>
      {big && (
        <span className="rotate-180 text-left text-sm font-bold leading-none sm:text-base" style={{ color }}>
          {n}
        </span>
      )}
    </span>
  );
  if (!onClick) return <span aria-label={label} title={label} className="inline-block">{body}</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Jugar ${label}`}
      className="carta-entra rounded-[10px] transition-transform enabled:hover:-translate-y-2 disabled:cursor-not-allowed"
    >
      {body}
    </button>
  );
}

export function Dorso({ size = 'sm' }: { size?: 'xs' | 'sm' | 'md' }) {
  return (
    <span
      aria-hidden
      className={`inline-block ${SIZES[size]} ${size === 'xs' ? 'rounded-[3px]' : 'rounded-[10px]'} border border-[#3b1f12]`}
      style={{
        background:
          'repeating-linear-gradient(45deg, #7a2a22 0 6px, #8f352b 6px 12px), #7a2a22',
        boxShadow: size === 'xs' ? 'inset 0 0 0 1.5px #f6f1e4' : 'inset 0 0 0 3px #f6f1e4, 0 3px 0 rgba(0,0,0,.35)',
      }}
    />
  );
}
