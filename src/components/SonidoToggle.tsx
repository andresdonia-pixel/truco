'use client';
import { useEffect, useState } from 'react';
import { audio, onSonidoChange, setSonido, sonidoActivo } from '@/lib/sonidos';

export function SonidoToggle() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(sonidoActivo());
    const off = onSonidoChange(setOn);
    return () => {
      off();
    };
  }, []);
  return (
    <button
      type="button"
      onClick={() => {
        audio();
        setSonido(!on);
      }}
      aria-pressed={on}
      title={on ? 'Silenciar la mesa' : 'Activar el sonido'}
      className="flex items-center gap-1.5 rounded-full bg-pano-osc/70 px-3 py-1 text-sm"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
        {on ? <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" /> : <path d="M17 9l5 6M22 9l-5 6" />}
      </svg>
      {on ? 'Sonido' : 'Silencio'}
    </button>
  );
}
