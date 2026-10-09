import { useId } from 'react';
import { AVATAR_OPTIONS, sanitizeAvatar } from '@/lib/avatar';
import type { AvatarConfig } from '@/lib/avatar';

const INK = '#1f1b16';
const SHIRT = '#26323a';

interface Props {
  avatar: AvatarConfig | null | undefined;
  size?: number;
  /** Abre la boca, como cuando canta truco. */
  shouting?: boolean;
  title?: string;
  className?: string;
}

/** Personaje dibujado en SVG, todo con formas propias. */
export function Avatar({ avatar, size = 40, shouting, title, className }: Props) {
  const a = sanitizeAvatar(avatar);
  const clip = useId();
  const skin = AVATAR_OPTIONS.piel[a.piel];
  const hair = AVATAR_OPTIONS.colorPelo[a.colorPelo];
  const bg = AVATAR_OPTIONS.fondo[a.fondo];
  const mouth = shouting ? 'grito' : a.labios;

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={className}
    >
      <defs>
        <clipPath id={clip}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="100" height="100" fill={bg} />
        <HairBack style={a.pelo} color={hair} />
        {/* hombros y cuello */}
        <path d="M12 100 C16 80 34 73 50 73 C66 73 84 80 88 100Z" fill={SHIRT} />
        <rect x="42" y="60" width="16" height="17" fill={skin} />
        <rect x="42" y="60" width="16" height="17" fill="#000" opacity="0.13" />
        {/* orejas */}
        <circle cx="27" cy="49" r="5.5" fill={skin} />
        <circle cx="73" cy="49" r="5.5" fill={skin} />
        <Face shape={a.cara} skin={skin} />
        <Beard style={a.barba} color={hair} />
        <path d="M50 46 Q47.5 53 51 54" fill="none" stroke="#000" strokeOpacity="0.25" strokeWidth="1.8" strokeLinecap="round" />
        <Eyes style={a.ojos} sclera={a.piel === 'p5' || a.piel === 'p6'} />
        <Mouth style={mouth} />
        <HairFront style={a.pelo} color={hair} />
      </g>
    </svg>
  );
}

function Face({ shape, skin }: { shape: AvatarConfig['cara']; skin: string }) {
  switch (shape) {
    case 'redonda':
      return <circle cx="50" cy="47" r="24.5" fill={skin} />;
    case 'cuadrada':
      return <rect x="27" y="21" width="46" height="51" rx="13" fill={skin} />;
    case 'alargada':
      return <ellipse cx="50" cy="46" rx="20" ry="28.5" fill={skin} />;
    default:
      return <ellipse cx="50" cy="46" rx="22.5" ry="26.5" fill={skin} />;
  }
}

function HairBack({ style, color }: { style: AvatarConfig['pelo']; color: string }) {
  switch (style) {
    case 'largo':
      return <path d="M23 42 Q21 16 50 14 Q79 16 77 42 L82 88 Q68 92 66 72 L34 72 Q32 92 18 88Z" fill={color} />;
    case 'rodete':
      return <circle cx="50" cy="13" r="10" fill={color} />;
    case 'rulos':
      return (
        <g fill={color}>
          <circle cx="26" cy="42" r="10" />
          <circle cx="74" cy="42" r="10" />
          <circle cx="24" cy="56" r="8" />
          <circle cx="76" cy="56" r="8" />
        </g>
      );
    default:
      return null;
  }
}

function HairFront({ style, color }: { style: AvatarConfig['pelo']; color: string }) {
  switch (style) {
    case 'corto':
      return <path d="M25 44 Q24 17 50 17 Q76 17 75 44 Q71 30 58 28 Q50 32 41 28 Q29 30 25 44Z" fill={color} />;
    case 'jopo':
      return (
        <g fill={color}>
          <path d="M25 44 Q24 18 50 18 Q76 18 75 44 Q71 31 58 29 Q50 31 41 29 Q29 31 25 44Z" />
          <path d="M32 27 Q36 6 60 9 Q73 12 68 27 Q58 18 32 27Z" />
        </g>
      );
    case 'rulos':
      return (
        <g fill={color}>
          {[
            [28, 33],
            [34, 24],
            [43, 19],
            [53, 18],
            [63, 21],
            [71, 29],
            [74, 38],
            [26, 41],
          ].map(([cx, cy]) => (
            <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="8.5" />
          ))}
        </g>
      );
    case 'largo':
      return <path d="M25 46 Q23 17 50 16 Q77 17 75 46 Q69 28 50 27 Q31 28 25 46Z" fill={color} />;
    case 'rodete':
      return <path d="M26 41 Q26 19 50 19 Q74 19 74 41 Q67 26 50 26 Q33 26 26 41Z" fill={color} />;
    case 'mohicano':
      return (
        <g fill={color}>
          <path d="M43 30 Q40 6 50 1 Q60 6 57 30 Q50 26 43 30Z" />
          <path d="M27 42 Q27 30 33 26 L33 40Z" opacity="0.45" />
          <path d="M73 42 Q73 30 67 26 L67 40Z" opacity="0.45" />
        </g>
      );
    case 'boina':
      return (
        <g>
          <path d="M27 44 Q26 36 30 31 L33 42Z" fill={color} />
          <path d="M73 44 Q74 36 70 31 L67 42Z" fill={color} />
          <path d="M22 30 Q24 9 50 8 Q78 9 79 27 Q80 33 70 31 Q50 25 30 32 Q21 35 22 30Z" fill={INK} />
          <rect x="48" y="3" width="4" height="7" rx="2" fill={INK} />
        </g>
      );
    default:
      // pelado: un brillo
      return <path d="M36 25 Q44 20 52 21" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" />;
  }
}

const MUSTACHE = 'M39 58 Q45 53 50 56.5 Q55 53 61 58 Q55 60.5 50 59 Q45 60.5 39 58Z';

function Beard({ style, color }: { style: AvatarConfig['barba']; color: string }) {
  switch (style) {
    case 'bigote':
      return <path d={MUSTACHE} fill={color} />;
    case 'manubrio':
      return (
        <path
          d="M34 52 Q35 59 41 58 Q46 55 50 57 Q54 55 59 58 Q65 59 66 52"
          fill="none"
          stroke={color}
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case 'candado':
      return (
        <g fill={color}>
          <path d={MUSTACHE} />
          <path d="M40 60 Q50 58 60 60 L59 68 Q50 76 41 68Z" />
        </g>
      );
    case 'corta':
      return (
        <g fill={color}>
          <path d="M27 48 Q27 75 50 77 Q73 75 73 48 L67 51 Q65 66 50 67 Q35 66 33 51Z" />
          <path d={MUSTACHE} />
        </g>
      );
    case 'larga':
      return (
        <g fill={color}>
          <path d="M27 48 Q25 88 50 92 Q75 88 73 48 L67 51 Q65 66 50 67 Q35 66 33 51Z" />
          <path d={MUSTACHE} />
        </g>
      );
    default:
      return null;
  }
}

function Eyes({ style, sclera }: { style: AvatarConfig['ojos']; sclera?: boolean }) {
  const brows = (
    <g fill="none" stroke={sclera ? '#120c08' : INK} strokeWidth="2.2" strokeLinecap="round">
      <path d="M36 38 Q41 35.5 45 37.5" />
      <path d="M55 37.5 Q59 35.5 64 38" />
    </g>
  );
  const dot = (cx: number, r = 2.8) => (
    <g>
      {sclera && <circle cx={cx} cy="45" r={r + 1.6} fill="#f6f1e4" />}
      <circle cx={cx} cy="45" r={r} fill={INK} />
    </g>
  );
  switch (style) {
    case 'felices':
      return (
        <g fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round">
          {brows}
          <path d="M37 46 Q41 41.5 45 46" />
          <path d="M55 46 Q59 41.5 63 46" />
        </g>
      );
    case 'canchero':
      return (
        <g>
          {brows}
          {dot(41, 2.4)}
          {dot(59, 2.4)}
          <g stroke={INK} strokeWidth="2.4" strokeLinecap="round">
            <path d="M36.5 43.5 L45.5 43.5" />
            <path d="M54.5 43.5 L63.5 43.5" />
          </g>
        </g>
      );
    case 'sospecha':
      return (
        <g>
          <g fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round">
            <path d="M35 36 L45 40" />
            <path d="M65 36 L55 40" />
          </g>
          {dot(41, 2.2)}
          {dot(59, 2.2)}
        </g>
      );
    case 'guino':
      return (
        <g>
          {brows}
          {dot(41)}
          <path d="M55 46 Q59 42.5 63 46" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
        </g>
      );
    case 'anteojos':
      return (
        <g>
          {brows}
          {dot(41, 2.3)}
          {dot(59, 2.3)}
          <g fill="#ffffff" fillOpacity="0.18" stroke={INK} strokeWidth="2">
            <circle cx="41" cy="45" r="6.5" />
            <circle cx="59" cy="45" r="6.5" />
          </g>
          <path d="M47.5 45 L52.5 45 M34.5 44 L28 42 M65.5 44 L72 42" stroke={INK} strokeWidth="2" />
        </g>
      );
    default:
      return (
        <g>
          {brows}
          {dot(41)}
          {dot(59)}
        </g>
      );
  }
}

function Mouth({ style }: { style: AvatarConfig['labios'] }) {
  const line = { fill: 'none', stroke: INK, strokeWidth: 2.4, strokeLinecap: 'round' as const };
  switch (style) {
    case 'serio':
      return <path d="M44 62.5 L56 62.5" {...line} />;
    case 'picaro':
      return <path d="M43.5 61.5 Q51 66 57.5 59" {...line} />;
    case 'rojos':
      return <path d="M42.5 61.5 Q46.5 58 50 60 Q53.5 58 57.5 61.5 Q50 68 42.5 61.5Z" fill="#b8322f" />;
    case 'grito':
      return (
        <g>
          <ellipse cx="50" cy="63" rx="5.5" ry="6" fill="#4a1714" />
          <ellipse cx="50" cy="66.5" rx="3.5" ry="2" fill="#d4605a" />
        </g>
      );
    default:
      return <path d="M43 60.5 Q50 67 57 60.5" {...line} />;
  }
}
