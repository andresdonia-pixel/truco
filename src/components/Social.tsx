'use client';
import { useEffect, useRef, useState } from 'react';
import { Avatar } from './Avatar';
import { FRASES, SENAS } from '@/lib/social';
import type { Gesto } from '@/lib/social';
import type { AvatarConfig } from '@/lib/avatar';

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const PILL = 'rounded-full border-2 border-claro/40 px-3 py-1 text-sm font-semibold text-claro transition hover:border-claro';

export function Frases({ onPick }: { onPick: (f: string) => void }) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={PILL}>
        Frases
      </button>
      {open && (
        <ul className="absolute bottom-full left-1/2 z-30 mb-2 grid w-72 -translate-x-1/2 grid-cols-2 gap-1.5 rounded-2xl bg-papel p-2 text-tinta shadow-[0_6px_0_rgba(0,0,0,.35)]">
          {FRASES.map((f) => (
            <li key={f}>
              <button
                type="button"
                onClick={() => {
                  onPick(f);
                  setOpen(false);
                }}
                className="w-full rounded-xl px-2 py-1.5 text-left font-mano text-base font-bold leading-tight hover:bg-oro/40"
              >
                {f}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Senas({ avatar, onPick }: { avatar: AvatarConfig | null | undefined; onPick: (g: Gesto) => void }) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={PILL}>
        Señas
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 z-30 mb-2 w-80 -translate-x-1/2 rounded-2xl bg-papel p-2 text-tinta shadow-[0_6px_0_rgba(0,0,0,.35)]">
          <p className="px-1 pb-1.5 text-xs">Sólo las ve tu compañero.</p>
          <ul className="grid grid-cols-3 gap-1.5">
            {SENAS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    onPick(s.id);
                    setOpen(false);
                  }}
                  title={s.gesto}
                  className="flex w-full flex-col items-center gap-0.5 rounded-xl p-1 hover:bg-oro/40"
                >
                  <Avatar avatar={avatar} gesto={s.id} size={44} />
                  <span className="text-center text-xs font-semibold leading-tight">{s.significa}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
