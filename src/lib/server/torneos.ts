import 'server-only';
import type { Admin } from '@/lib/supabase/admin';
import { HttpError } from './http';

export interface Tournament {
  id: string;
  code: string;
  name: string;
  host: string;
  size: 4 | 8;
  target: 15 | 30;
  flor: boolean;
  status: 'waiting' | 'playing' | 'finished';
  champion: string | null;
}

export async function getTournament(db: Admin, code: string): Promise<Tournament> {
  const { data, error } = await db.from('tournaments').select('*').eq('code', code.toUpperCase()).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'No existe un torneo con ese código.');
  return data as Tournament;
}

const rounds = (size: number) => Math.log2(size); // 4 → 2 rondas, 8 → 3

/** Crea la sala de un partido del torneo, con los dos ya sentados. */
async function createMatchRoom(db: Admin, t: Tournament, a: string, b: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: room, error } = await db
      .from('rooms')
      .insert({ host: a, players: 2, target: t.target, flor: t.flor, tournament_id: t.id })
      .select('id')
      .single();
    if (error?.code === '23505') continue;
    if (error) throw error;
    const { error: e2 } = await db.from('room_players').insert([
      { room_id: room.id, seat: 0, user_id: a },
      { room_id: room.id, seat: 1, user_id: b },
    ]);
    if (e2) throw e2;
    return room.id;
  }
  throw new HttpError(500, 'No se pudo crear la sala del partido.');
}

/** Si el partido ya tiene a los dos jugadores y todavía no tiene sala, se la arma (una sola vez). */
async function ensureRoom(db: Admin, t: Tournament, round: number, idx: number) {
  const { data: m } = await db
    .from('tournament_matches')
    .select('a,b,room_id')
    .eq('tournament_id', t.id)
    .eq('round', round)
    .eq('idx', idx)
    .single();
  if (!m || !m.a || !m.b || m.room_id) return;
  const roomId = await createMatchRoom(db, t, m.a, m.b);
  const { data: claimed } = await db
    .from('tournament_matches')
    .update({ room_id: roomId })
    .eq('tournament_id', t.id)
    .eq('round', round)
    .eq('idx', idx)
    .is('room_id', null)
    .select('idx');
  if (!claimed?.length) await db.from('rooms').delete().eq('id', roomId); // otro proceso llegó primero
}

/** Sortea las llaves y arma las salas de la primera ronda. */
export async function startTournament(db: Admin, t: Tournament, players: string[]) {
  const shuffled = [...players];
  const rnd = crypto.getRandomValues(new Uint32Array(shuffled.length));
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = rnd[i] % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const rows = [];
  for (let r = 0; r < rounds(t.size); r++) {
    const count = t.size / 2 ** (r + 1);
    for (let i = 0; i < count; i++) {
      rows.push({
        tournament_id: t.id,
        round: r,
        idx: i,
        a: r === 0 ? shuffled[i * 2] : null,
        b: r === 0 ? shuffled[i * 2 + 1] : null,
      });
    }
  }
  // primero se reclama el arranque, así un doble clic no sortea dos veces
  const { data: ok } = await db.from('tournaments').update({ status: 'playing' }).eq('id', t.id).eq('status', 'waiting').select('id');
  if (!ok?.length) throw new HttpError(409, 'El torneo ya empezó.');
  const { error } = await db.from('tournament_matches').insert(rows);
  if (error) throw error;
  for (let i = 0; i < t.size / 2; i++) await ensureRoom(db, t, 0, i);
}

/** Lo llama el servidor cuando termina una partida que pertenece a un torneo. */
export async function onTournamentMatchEnd(db: Admin, tournamentId: string, roomId: string, winner: string) {
  const { data: t } = await db.from('tournaments').select('*').eq('id', tournamentId).single();
  if (!t) return;
  const { data: m } = await db
    .from('tournament_matches')
    .update({ winner })
    .eq('tournament_id', tournamentId)
    .eq('room_id', roomId)
    .is('winner', null)
    .select('round,idx')
    .maybeSingle();
  if (!m) return; // ya estaba registrado
  const last = rounds(t.size) - 1;
  if (m.round === last) {
    await db.from('tournaments').update({ status: 'finished', champion: winner }).eq('id', tournamentId);
    return;
  }
  const next = { round: m.round + 1, idx: Math.floor(m.idx / 2) };
  await db
    .from('tournament_matches')
    .update(m.idx % 2 === 0 ? { a: winner } : { b: winner })
    .eq('tournament_id', tournamentId)
    .eq('round', next.round)
    .eq('idx', next.idx);
  await ensureRoom(db, t as Tournament, next.round, next.idx);
}
