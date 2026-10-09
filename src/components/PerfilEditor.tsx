'use client';
import { useState } from 'react';
import { Avatar } from './Avatar';
import { AVATAR_OPTIONS, AVATAR_PART_LABELS, COLOR_PARTS, DEFAULT_AVATAR, randomAvatar } from '@/lib/avatar';
import type { AvatarConfig, AvatarPart } from '@/lib/avatar';

interface Props {
  initialNickname?: string;
  initialAvatar?: AvatarConfig | null;
  onSave: (nickname: string, avatar: AvatarConfig) => Promise<void>;
  onCancel?: () => void;
}

const PARTS = Object.keys(AVATAR_OPTIONS) as AvatarPart[];

/** Apodo + personaje. Se usa la primera vez y cada vez que alguien quiere cambiarlo. */
export function PerfilEditor({ initialNickname = '', initialAvatar, onSave, onCancel }: Props) {
  const [nickname, setNickname] = useState(initialNickname);
  const [avatar, setAvatar] = useState<AvatarConfig>(initialAvatar ?? (initialNickname ? DEFAULT_AVATAR : randomAvatar()));
  const [part, setPart] = useState<AvatarPart>('pelo');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = nickname.trim();
    if (clean.length < 2) return setError('El apodo tiene que tener al menos 2 letras.');
    setSaving(true);
    setError(null);
    try {
      await onSave(clean, avatar);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar');
    } finally {
      setSaving(false);
    }
  }

  const options = Object.entries(AVATAR_OPTIONS[part]) as [string, string][];
  const isColor = COLOR_PARTS.includes(part);

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-end">
        <div className="relative">
          <Avatar avatar={avatar} size={128} title="Tu personaje" />
          <button
            type="button"
            onClick={() => setAvatar(randomAvatar())}
            className="absolute -bottom-1 -right-2 rounded-full bg-oro px-3 py-1 text-sm font-bold text-tinta shadow-[0_2px_0_rgba(0,0,0,.35)]"
          >
            Al azar
          </button>
        </div>
        <div className="flex w-full flex-1 flex-col gap-2">
          <label htmlFor="apodo" className="text-lg font-semibold">
            ¿Cómo te llaman en la mesa?
          </label>
          <input
            id="apodo"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={20}
            placeholder="Tu apodo"
            className="rounded-xl bg-claro px-4 py-2.5 text-lg text-tinta placeholder:text-tinta/50"
          />
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Partes del personaje">
          {PARTS.map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={part === p}
              onClick={() => setPart(p)}
              className={`rounded-full px-3 py-1 text-sm font-semibold ${part === p ? 'bg-claro text-pano-osc' : 'bg-pano-osc/60 text-claro/80'}`}
            >
              {AVATAR_PART_LABELS[p]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={AVATAR_PART_LABELS[part]}>
          {options.map(([key, value]) => {
            const selected = avatar[part] === key;
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={isColor ? `${AVATAR_PART_LABELS[part]} ${key}` : value}
                title={isColor ? undefined : value}
                onClick={() => setAvatar({ ...avatar, [part]: key })}
                className={`flex flex-col items-center gap-1 rounded-2xl p-1.5 transition ${
                  selected ? 'bg-claro/90 ring-2 ring-oro' : 'bg-pano-osc/50 hover:bg-pano-osc/80'
                }`}
              >
                {isColor ? (
                  <span className="block h-10 w-10 rounded-full border-2 border-claro/40" style={{ background: value }} />
                ) : (
                  <>
                    <Avatar avatar={{ ...avatar, [part]: key }} size={52} />
                    <span className={`text-xs ${selected ? 'text-tinta' : 'text-claro/80'}`}>{value}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button disabled={saving} className="rounded-xl bg-oro px-6 py-2.5 text-lg font-bold text-tinta disabled:opacity-60">
          {saving ? 'Guardando…' : 'Listo'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-claro/80 underline underline-offset-4">
            Cancelar
          </button>
        )}
        <p className="text-sm text-claro/70">Así te van a ver en la mesa y en el ranking.</p>
      </div>
      {error && <p className="text-sm text-[#ffb4a8]">{error}</p>}
    </form>
  );
}
