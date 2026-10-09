import { test } from 'node:test';
import assert from 'node:assert/strict';
import { botAction } from './bot.ts';
import { applyAction, createGame, legalActions, viewFor } from './engine.ts';
import type { Config, GameState } from './engine.ts';

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Quién tiene que decidir ahora (el primero con jugadas legales). */
function actor(s: GameState): number | null {
  for (let seat = 0; seat < s.config.players; seat++) if (legalActions(s, seat).length) return seat;
  return null;
}

function botVsBot(config: Config, games: number) {
  const wins = [0, 0];
  for (let g = 0; g < games; g++) {
    let s = createGame(config, g * 104729 + 7);
    const rnd = seeded(g + 1);
    let steps = 0;
    while (s.winner === null) {
      assert.ok(++steps < 4000, 'la partida entre bots no termina');
      const seat = actor(s);
      assert.notEqual(seat, null);
      const a = botAction(viewFor(s, seat!), rnd);
      s = applyAction(s, seat!, a); // tira IllegalMove si el bot elige algo inválido
    }
    wins[s.winner]++;
  }
  return wins;
}

test('bot vs bot 1v1 con flor: siempre juega algo legal y las partidas terminan', () => {
  const w = botVsBot({ players: 2, target: 30, flor: true }, 300);
  assert.equal(w[0] + w[1], 300);
});

test('bot vs bot 2v2 sin flor a 15', () => {
  const w = botVsBot({ players: 4, target: 15, flor: false }, 300);
  assert.equal(w[0] + w[1], 300);
});

test('el bot mata con la carta más baja que alcanza', () => {
  let s = createGame({ players: 2, target: 30, flor: false }, 1, { hands: [['5c', '6c', '4o'], ['1e', '3c', '4b']] });
  s = applyAction(s, 0, { type: 'play', card: '6c' });
  const a = botAction(viewFor(s, 1), () => 0.99);
  assert.deepEqual(a, { type: 'play', card: '3c' });
});

test('el bot canta envido con 33 y no quiere con 4', () => {
  const s = createGame({ players: 2, target: 30, flor: false }, 1, { hands: [['7o', '6o', '1e'], ['4c', '5b', '12e']] });
  assert.deepEqual(botAction(viewFor(s, 0), () => 0.99), { type: 'envido', call: 'envido' });
  const t = applyAction(s, 0, { type: 'envido', call: 'envido' });
  assert.deepEqual(botAction(viewFor(t, 1), () => 0.99), { type: 'no_quiero' });
});

test('un bot más agresivo no le gana siempre al azar: el juego es parejo entre bots iguales', () => {
  const w = botVsBot({ players: 2, target: 15, flor: false }, 200);
  assert.ok(w[0] > 40 && w[1] > 40, `muy desparejo: ${w}`);
});
