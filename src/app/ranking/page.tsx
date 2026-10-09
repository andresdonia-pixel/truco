'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { sb } from '@/lib/supabase/browser';
import { useSession } from '@/lib/useSession';
import { Avatar } from '@/components/Avatar';
import { sanitizeAvatar } from '@/lib/avatar';

interface Row {
  user_id: string;
  nickname: string;
  avatar: unknown;
  played: number;
  won: number;
  points_for: number;
  points_against: number;
  win_pct: number | null;
}

export default function Ranking() {
  const { session } = useSession();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!session) return;
    sb()
      .from('leaderboard')
      .select('*')
      .order('won', { ascending: false })
      .order('win_pct', { ascending: false })
      .limit(50)
      .then(({ data }) => setRows((data as Row[]) ?? []));
  }, [session]);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="font-mano text-3xl font-bold">Truco</Link>
        <Link href="/" className="rounded-xl bg-oro px-4 py-2 font-bold text-tinta">Armar una mesa</Link>
      </header>

      <section
        className="rotate-[-0.6deg] rounded-sm bg-papel px-5 pb-6 pt-4 font-mano text-tinta shadow-[3px_5px_0_rgba(0,0,0,.35)]"
        style={{ backgroundImage: 'repeating-linear-gradient(transparent 0 31px, rgba(47,93,138,.18) 31px 32px)' }}
      >
        <h1 className="mb-3 text-4xl font-bold">Ranking</h1>
        {rows === null && <p className="text-xl">Contando palitos…</p>}
        {rows?.length === 0 && <p className="text-xl">Todavía no terminó ninguna partida. Armá la primera.</p>}
        {rows && rows.length > 0 && (
          <table className="w-full text-left text-lg">
            <thead>
              <tr className="border-b-2 border-tinta/60">
                <th className="py-1 pr-2 font-bold">#</th>
                <th className="py-1 pr-2 font-bold">Jugador</th>
                <th className="py-1 pr-2 text-right font-bold">Ganadas</th>
                <th className="py-1 pr-2 text-right font-bold">Jugadas</th>
                <th className="py-1 text-right font-bold">Efectividad</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.user_id} className={`border-b border-tinta/15 ${r.user_id === session?.userId ? 'bg-oro/30' : ''}`}>
                  <td className="py-1 pr-2">{i + 1}</td>
                  <td className="py-1 pr-2 font-bold">
                    <span className="flex items-center gap-2">
                      <Avatar avatar={r.avatar ? sanitizeAvatar(r.avatar) : null} size={30} />
                      {r.nickname}
                    </span>
                  </td>
                  <td className="py-1 pr-2 text-right">{r.won}</td>
                  <td className="py-1 pr-2 text-right">{r.played}</td>
                  <td className="py-1 text-right">{r.win_pct ?? 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
