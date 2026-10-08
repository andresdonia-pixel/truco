import 'server-only';
import { viewFor } from '@/engine/engine.ts';
import type { GameState } from '@/engine/engine.ts';
import type { Admin } from '@/lib/supabase/admin';
import { HttpError } from './http';

export interface Room {
  id: string;
  code: string;
  host: string;
  players: 2 | 4;
  target: 15 | 30;
  flor: boolean;
  status: 'waiting' | 'playing' | 'finished' | 'abandoned';
}

export interface SeatRow {
  seat: number;
  user_id: string;
}

export async function getRoom(db: Admin, code: string): Promise<Room> {
  const { data, error } = await db.from('rooms').select('*').eq('code', code.toUpperCase()).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, 'No existe una sala con ese código.');
  return data as Room;
}

export async function getSeats(db: Admin, roomId: string): Promise<SeatRow[]> {
  const { data, error } = await db.from('room_players').select('seat,user_id').eq('room_id', roomId).order('seat');
  if (error) throw error;
  return data as SeatRow[];
}

async function writeViews(db: Admin, room: Room, seats: SeatRow[], state: GameState, version: number) {
  const rows = seats.map((s) => ({
    room_id: room.id,
    seat: s.seat,
    user_id: s.user_id,
    view: viewFor(state, s.seat),
    version,
  }));
  const { error } = await db.from('game_views').upsert(rows);
  if (error) throw error;
}

/** Partida nueva (o revancha) en la sala. */
export async function startGame(db: Admin, room: Room, seats: SeatRow[], state: GameState) {
  const { data: existing } = await db.from('games').select('version').eq('room_id', room.id).maybeSingle();
  const version = (existing?.version ?? 0) + 1;
  const { error } = await db.from('games').upsert({ room_id: room.id, state, version, updated_at: new Date().toISOString() });
  if (error) throw error;
  await db.from('game_views').delete().eq('room_id', room.id);
  await writeViews(db, room, seats, state, version);
  await db.from('rooms').update({ status: 'playing' }).eq('id', room.id);
}

/** Guarda una jugada con control optimista. Devuelve false si otro llegó primero. */
export async function commitMove(
  db: Admin,
  room: Room,
  seats: SeatRow[],
  prev: GameState,
  next: GameState,
  prevVersion: number,
): Promise<boolean> {
  const version = prevVersion + 1;
  const { data, error } = await db
    .from('games')
    .update({ state: next, version, updated_at: new Date().toISOString() })
    .eq('room_id', room.id)
    .eq('version', prevVersion)
    .select('version');
  if (error) throw error;
  if (!data?.length) return false;
  await writeViews(db, room, seats, next, version);
  if (prev.winner === null && next.winner !== null) await recordMatch(db, room, seats, next);
  return true;
}

async function recordMatch(db: Admin, room: Room, seats: SeatRow[], state: GameState) {
  const winner = state.winner!;
  const { data: match, error } = await db
    .from('matches')
    .insert({
      room_id: room.id,
      players: room.players,
      target: room.target,
      flor: room.flor,
      winner_team: winner,
      score: state.score,
      hands_played: state.hand.number,
    })
    .select('id')
    .single();
  if (error) throw error;
  const rows = seats.map((s) => {
    const team = s.seat % 2;
    return {
      match_id: match.id,
      user_id: s.user_id,
      seat: s.seat,
      team,
      won: team === winner,
      points_for: state.score[team],
      points_against: state.score[1 - team],
    };
  });
  const { error: e2 } = await db.from('match_players').insert(rows);
  if (e2) throw e2;
  await db.from('rooms').update({ status: 'finished' }).eq('id', room.id);
}
