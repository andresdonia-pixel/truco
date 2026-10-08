/** El anotador de papel: palitos agrupados de a cinco (cuadrado + diagonal), como en cualquier mesa. */

function Grupo({ count, seed }: { count: number; seed: number }) {
  // leve temblor de mano para que no parezca dibujado con regla
  const j = (k: number) => (((seed * 31 + k * 17) % 7) - 3) * 0.35;
  const lines = [
    [4 + j(1), 4, 30 + j(2), 4 + j(3)], // arriba
    [30 + j(4), 4, 30 + j(5), 30], // derecha
    [30, 30 + j(6), 4, 30 + j(7)], // abajo
    [4 + j(8), 30, 4, 4 + j(9)], // izquierda
    [4, 30, 30, 4], // diagonal
  ];
  return (
    <svg viewBox="0 0 34 34" className="h-7 w-7" aria-hidden>
      {lines.slice(0, count).map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--color-tinta)" strokeWidth="2.6" strokeLinecap="round" />
      ))}
    </svg>
  );
}

function Palitos({ points, max, seed }: { points: number; max: number; seed: number }) {
  const shown = Math.min(points, max);
  const groups = Array.from({ length: Math.ceil(max / 5) }, (_, g) => Math.max(0, Math.min(5, shown - g * 5)));
  return (
    <div className="grid grid-cols-3 gap-x-1 gap-y-1 justify-items-center">
      {groups.map((c, g) => (
        <span key={g} className="flex h-7 w-7 items-center justify-center">
          {c > 0 && <Grupo count={c} seed={seed + g} />}
        </span>
      ))}
    </div>
  );
}

interface Props {
  nosotros: number;
  ellos: number;
  target: 15 | 30;
  labels?: [string, string];
}

export function Anotador({ nosotros, ellos, target, labels = ['Nosotros', 'Ellos'] }: Props) {
  const half = target === 30 ? 15 : target;
  const col = (pts: number, seed: number) => (
    <div className="flex flex-col items-center gap-1">
      <Palitos points={pts} max={half} seed={seed} />
      {target === 30 && (
        <>
          <div className="my-1 w-full border-t-2 border-dashed border-tinta/60" aria-hidden />
          <Palitos points={Math.max(0, pts - 15)} max={15} seed={seed + 9} />
        </>
      )}
    </div>
  );
  return (
    <section
      aria-label={`Anotador: ${labels[0]} ${nosotros}, ${labels[1]} ${ellos}, a ${target}`}
      className="rotate-[-1.2deg] rounded-sm bg-papel px-3 pb-3 pt-2 font-mano text-tinta shadow-[2px_4px_0_rgba(0,0,0,.35)]"
      style={{
        backgroundImage: 'repeating-linear-gradient(transparent 0 23px, rgba(47,93,138,.18) 23px 24px)',
      }}
    >
      <div className="grid grid-cols-2 divide-x-2 divide-tinta/70">
        {[
          [labels[0], nosotros, 1],
          [labels[1], ellos, 5],
        ].map(([label, pts, seed]) => (
          <div key={String(label)} className="flex flex-col items-center px-2">
            <span className="text-lg font-bold leading-tight">{label}</span>
            <span className="mb-1 text-sm leading-none">{pts}</span>
            {col(Number(pts), Number(seed))}
          </div>
        ))}
      </div>
      {target === 30 && <p className="mt-1 text-center text-xs leading-none">Arriba las malas, abajo las buenas</p>}
    </section>
  );
}
