'use client';
import { useEffect } from 'react';
import { sonar } from '@/lib/sonidos';
import type { MatchStats, Team } from '@/engine/engine.ts';
import { Avatar } from './Avatar';
import type { Jugador } from './Mesa';

const FILAS: { key: keyof MatchStats['teams'][0]; label: string }[] = [
  { key: 'manos', label: 'Manos ganadas' },
  { key: 'bazas', label: 'Bazas ganadas' },
  { key: 'trucos', label: 'Trucos ganados' },
  { key: 'puntosTruco', label: 'Puntos de truco' },
  { key: 'envidos', label: 'Envidos ganados' },
  { key: 'puntosEnvido', label: 'Puntos de envido' },
  { key: 'flores', label: 'Flores' },
  { key: 'mazos', label: 'Idas al mazo' },
];

/** Resumen de la partida terminada, en el papel del anotador. */
export function Resumen({ stats, team, ganador, players, racha }: { stats: MatchStats; team: Team; ganador: Team | null; players: Jugador[]; racha?: number | null }) {
  const nos = stats.teams[team];
  const ganamos = ganador === team;
  useEffect(() => {
    sonar(ganamos ? 'victoria' : 'derrota');
  }, [ganamos]);
  const ellos = stats.teams[1 - team];
  const mejores = Object.entries(stats.mejorEnvido)
    .map(([seat, value]) => ({ seat: Number(seat), value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
  const nombre = (seat: number) => players.find((p) => p.seat === seat);

  return (
    <div className="w-full max-w-sm text-left">
      <table className="w-full font-mano text-lg">
        <thead>
          <tr className="border-b-2 border-tinta/60">
            <th className="py-0.5 text-left font-bold" />
            <th className="py-0.5 text-right font-bold">Nosotros</th>
            <th className="py-0.5 text-right font-bold">Ellos</th>
          </tr>
        </thead>
        <tbody>
          {FILAS.filter((f) => f.key !== 'flores' || nos.flores + ellos.flores > 0).map((f) => (
            <tr key={f.key} className="border-b border-tinta/15">
              <td className="py-0.5">{f.label}</td>
              <td className={`py-0.5 text-right ${nos[f.key] > ellos[f.key] ? 'font-bold' : ''}`}>{nos[f.key]}</td>
              <td className={`py-0.5 text-right ${ellos[f.key] > nos[f.key] ? 'font-bold' : ''}`}>{ellos[f.key]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {mejores.length > 0 && (
        <div className="mt-3">
          <p className="font-mano text-lg font-bold">Mejores envidos</p>
          <ul className="mt-1 flex flex-wrap gap-3">
            {mejores.map(({ seat, value }) => (
              <li key={seat} className="flex items-center gap-1.5">
                <Avatar avatar={nombre(seat)?.avatar} size={28} />
                <span>
                  {nombre(seat)?.nickname ?? `Asiento ${seat + 1}`}: <strong>{value}</strong>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {racha != null && racha >= 2 && (
        <p className="mt-3 font-mano text-xl font-bold">Venís con {racha} partidas ganadas seguidas.</p>
      )}
    </div>
  );
}
