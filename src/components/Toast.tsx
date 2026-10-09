'use client';
import { Avatar } from './Avatar';
import type { AvatarConfig } from '@/lib/avatar';

export interface ToastData {
  id: number;
  text: string;
  avatar?: AvatarConfig | null;
  fuerte?: boolean;
}

export function Toast({ toast }: { toast: ToastData | null }) {
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div
        key={toast.id}
        role="alert"
        className={`toast-entra flex max-w-md items-center gap-3 rounded-2xl px-4 py-2.5 shadow-[0_6px_0_rgba(0,0,0,.35)] ${
          toast.fuerte ? 'bg-oro text-tinta' : 'bg-claro text-tinta'
        }`}
      >
        {toast.avatar !== undefined && <Avatar avatar={toast.avatar} size={44} shouting={toast.fuerte} className="shrink-0" />}
        <span className="font-mano text-lg font-bold leading-tight">{toast.text}</span>
      </div>
    </div>
  );
}
