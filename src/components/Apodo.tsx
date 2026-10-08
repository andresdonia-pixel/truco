'use client';
import { useState } from 'react';

export function Apodo({ onSave, initial = '' }: { onSave: (n: string) => Promise<void>; initial?: string }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = value.trim();
    if (clean.length < 2) return setError('El apodo tiene que tener al menos 2 letras.');
    setSaving(true);
    setError(null);
    try {
      await onSave(clean);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <label htmlFor="apodo" className="text-lg font-semibold">
        ¿Cómo te llaman en la mesa?
      </label>
      <div className="flex gap-2">
        <input
          id="apodo"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={20}
          placeholder="Tu apodo"
          className="min-w-0 flex-1 rounded-xl bg-claro px-4 py-2.5 text-lg text-tinta placeholder:text-tinta/50"
        />
        <button disabled={saving} className="rounded-xl bg-oro px-5 py-2.5 text-lg font-bold text-tinta disabled:opacity-60">
          Listo
        </button>
      </div>
      <p className="text-sm text-claro/70">Con este nombre vas a aparecer en la mesa y en el ranking.</p>
      {error && <p className="text-sm text-[#ffb4a8]">{error}</p>}
    </form>
  );
}
