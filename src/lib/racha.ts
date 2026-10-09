'use client';
import { sb } from '@/lib/supabase/browser';

/** Partidas ganadas seguidas, contando desde la última. */
export async function fetchRacha(userId: string): Promise<number> {
  const { data } = await sb().from('match_players').select('won, matches(finished_at)').eq('user_id', userId).limit(200);
  const rows = ((data ?? []) as unknown as { won: boolean; matches: { finished_at: string } | null }[])
    .filter((r) => r.matches)
    .sort((a, b) => b.matches!.finished_at.localeCompare(a.matches!.finished_at));
  let n = 0;
  for (const r of rows) {
    if (!r.won) break;
    n++;
  }
  return n;
}
