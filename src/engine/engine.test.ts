import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DECK, envidoPoints, florPoints, hasFlor, rank } from './cards.ts';
import { IllegalMove, applyAction, createGame, legalActions, viewFor } from './engine.ts';
import type { Action, Config, GameState } from './engine.ts';

const C1v1: Config = { players: 2, target: 30, flor: false };
const act = (s: GameState, seat: number, a: Action) => applyAction(s, seat, a);
const play = (card: string): Action => ({ type: 'play', card });

test('jerarquía de cartas', () => {
  const order = ['1e', '1b', '7e', '7o', '3c', '2c', '1c', '12c', '11c', '10c', '7c', '6c', '5c', '4c'];
  for (let i = 0; i < order.length - 1; i++) assert.ok(rank(order[i]) > rank(order[i + 1]), order[i]);
  assert.equal(rank('1o'), rank('1c'));
  assert.equal(DECK.length, 40);
});

test('puntos de envido y flor', () => {
  assert.equal(envidoPoints(['7o', '6o', '1e']), 33);
  assert.equal(envidoPoints(['12e', '11e', '1c']), 20);
  assert.equal(envidoPoints(['4b', '5c', '6o']), 6);
  assert.equal(envidoPoints(['10e', '11b', '12c']), 0);
  assert.equal(envidoPoints(['7c', '5c', '3c']), 32);
  assert.ok(hasFlor(['7c', '5c', '3c']));
  assert.equal(florPoints(['7c', '5c', '12c']), 32);
});

test('mano simple: gana dos bazas y suma 1', () => {
  let s = createGame(C1v1, 1, { hands: [['1e', '1b', '4c'], ['5c', '6c', '4o']] });
  s = act(s, 0, play('1e'));
  s = act(s, 1, play('5c'));
  s = act(s, 0, play('1b'));
  s = act(s, 1, play('6c'));
  assert.deepEqual(s.score, [1, 0]);
  assert.equal(s.hand.number, 2);
  assert.equal(s.hand.mano, 1);
});

test('no se puede jugar fuera de turno', () => {
  const s = createGame(C1v1, 1, { hands: [['1e', '1b', '4c'], ['5c', '6c', '4o']] });
  assert.throws(() => act(s, 1, play('5c')), IllegalMove);
  assert.throws(() => act(s, 0, play('5c')), IllegalMove);
});

test('parda en primera: define la segunda', () => {
  let s = createGame(C1v1, 1, { hands: [['3e', '4c', '5c'], ['3o', '1e', '6c']] });
  s = act(s, 0, play('3e'));
  s = act(s, 1, play('3o'));
  assert.equal(s.hand.bazas[0].winner, 'parda');
  assert.equal(s.hand.turn, 0); // sale de nuevo quien abrió
  s = act(s, 0, play('4c'));
  s = act(s, 1, play('1e'));
  assert.deepEqual(s.score, [0, 1]);
});

test('gana primera y empata segunda: gana el de primera', () => {
  let s = createGame(C1v1, 1, { hands: [['1e', '3c', '4c'], ['5c', '3o', '6c']] });
  s = act(s, 0, play('1e'));
  s = act(s, 1, play('5c'));
  s = act(s, 0, play('3c'));
  s = act(s, 1, play('3o'));
  assert.deepEqual(s.score, [1, 0]);
});

test('truco querido vale 2; retruco no querido vale 2 para quien subió', () => {
  let s = createGame(C1v1, 1, { hands: [['1e', '1b', '4c'], ['5c', '6c', '4o']] });
  s = act(s, 0, { type: 'truco' });
  assert.deepEqual(legalActions(s, 0), []);
  s = act(s, 1, { type: 'quiero' });
  s = act(s, 0, play('1e'));
  s = act(s, 1, play('5c'));
  s = act(s, 0, play('1b'));
  s = act(s, 1, play('6c'));
  assert.deepEqual(s.score, [2, 0]);

  let t = createGame(C1v1, 1, { hands: [['1e', '1b', '4c'], ['5c', '6c', '4o']] });
  t = act(t, 0, { type: 'truco' });
  t = act(t, 1, { type: 'truco' }); // retruco
  t = act(t, 0, { type: 'no_quiero' });
  assert.deepEqual(t.score, [0, 2]);
});

test('sólo sube quien tiene el quiero', () => {
  let s = createGame(C1v1, 1, { hands: [['1e', '1b', '4c'], ['5c', '6c', '4o']] });
  s = act(s, 0, { type: 'truco' });
  s = act(s, 1, { type: 'quiero' });
  assert.ok(!legalActions(s, 0).some((a) => a.type === 'truco'));
  s = act(s, 0, play('4c'));
  assert.ok(legalActions(s, 1).some((a) => a.type === 'truco'));
});

test('el envido está primero', () => {
  // mano 0 tiene 33, pie 1 tiene 7
  let s = createGame(C1v1, 1, { hands: [['7o', '6o', '1e'], ['7c', '4e', '5b']] });
  s = act(s, 0, { type: 'truco' });
  s = act(s, 1, { type: 'envido', call: 'envido' });
  assert.equal(s.hand.suspended?.kind, 'truco');
  s = act(s, 0, { type: 'quiero' });
  assert.deepEqual(s.score, [2, 0]);
  assert.equal(s.hand.pending?.kind, 'truco'); // vuelve el truco
  assert.ok(legalActions(s, 1).some((a) => a.type === 'quiero'));
});

test('envido-envido-real no querido: 4 para quien cantó último', () => {
  let s = createGame(C1v1, 1, { hands: [['7o', '6o', '1e'], ['7c', '4e', '5b']] });
  s = act(s, 0, { type: 'envido', call: 'envido' });
  s = act(s, 1, { type: 'envido', call: 'envido' });
  s = act(s, 0, { type: 'envido', call: 'real' });
  assert.ok(!legalActions(s, 1).some((a) => a.type === 'envido' && a.call === 'real'));
  s = act(s, 1, { type: 'no_quiero' });
  assert.deepEqual(s.score, [4, 0]);
  assert.ok(!legalActions(s, 0).some((a) => a.type === 'envido'));
});

test('empate de envido gana la mano', () => {
  let s = createGame(C1v1, 1, { hands: [['7o', '6o', '1e'], ['7c', '6c', '1b']] });
  s = act(s, 0, play('1e'));
  s = act(s, 1, { type: 'envido', call: 'real' });
  s = act(s, 0, { type: 'quiero' });
  assert.deepEqual(s.score, [3, 0]);
});

test('falta envido: en las malas a 30 gana el partido', () => {
  let s = createGame(C1v1, 1, { hands: [['7o', '6o', '1e'], ['7c', '4e', '5b']] });
  s.score = [10, 12];
  s = act(s, 0, { type: 'envido', call: 'falta' });
  s = act(s, 1, { type: 'quiero' });
  assert.equal(s.winner, 0);
  assert.equal(s.score[0], 30);
  assert.deepEqual(legalActions(s, 0), []);
});

test('falta envido en las buenas: lo que le falta al que va ganando', () => {
  let s = createGame(C1v1, 1, { hands: [['7o', '6o', '1e'], ['7c', '4e', '5b']] });
  s.score = [10, 20];
  s = act(s, 0, { type: 'envido', call: 'falta' });
  s = act(s, 1, { type: 'quiero' });
  assert.deepEqual(s.score, [20, 20]);
});

test('flor sin rival con flor: +3 y anula el envido', () => {
  let s = createGame({ ...C1v1, flor: true }, 1, { hands: [['7o', '6o', '1o'], ['7c', '4e', '5b']] });
  s = act(s, 0, { type: 'envido', call: 'envido' });
  assert.ok(!legalActions(s, 1).some((a) => a.type === 'flor'));
  let t = createGame({ ...C1v1, flor: true }, 1, { hands: [['7c', '4e', '5b'], ['7o', '6o', '1o']] });
  t = act(t, 0, { type: 'envido', call: 'envido' });
  t = act(t, 1, { type: 'flor' });
  assert.deepEqual(t.score, [0, 3]);
  assert.equal(t.hand.pending, null);
  assert.ok(!legalActions(t, 0).some((a) => a.type === 'envido'));
});

test('contraflor: compara flores, 6 al ganador', () => {
  let s = createGame({ ...C1v1, flor: true }, 1, { hands: [['7o', '6o', '1o'], ['3c', '2c', '12c']] });
  s = act(s, 0, { type: 'flor' });
  assert.equal(s.hand.pending?.kind, 'flor');
  assert.deepEqual(legalActions(s, 1).map((a) => a.type), ['achico', 'contraflor', 'contraflor_resto']);
  s = act(s, 1, { type: 'contraflor' });
  assert.deepEqual(s.score, [6, 0]); // 34 vs 25
});

test('flor ante truco en primera: el truco sigue pendiente', () => {
  let s = createGame({ ...C1v1, flor: true }, 1, { hands: [['7c', '4e', '5b'], ['7o', '6o', '1o']] });
  s = act(s, 0, { type: 'truco' });
  s = act(s, 1, { type: 'flor' });
  assert.deepEqual(s.score, [0, 3]);
  assert.equal(s.hand.pending?.kind, 'truco');
});

test('irse al mazo en primera sin envido: 2 puntos', () => {
  let s = createGame(C1v1, 1, { hands: [['1e', '1b', '4c'], ['5c', '6c', '4o']] });
  s = act(s, 0, { type: 'mazo' });
  assert.deepEqual(s.score, [0, 2]);
  let t = createGame(C1v1, 1, { hands: [['1e', '1b', '4c'], ['5c', '6c', '4o']] });
  t = act(t, 0, play('1e'));
  t = act(t, 1, play('5c'));
  t = act(t, 0, { type: 'truco' });
  t = act(t, 1, { type: 'mazo' });
  assert.deepEqual(t.score, [1, 0]);
});

test('2v2: equipos alternados, el compañero gana la baza', () => {
  const C2v2: Config = { players: 4, target: 15, flor: false };
  let s = createGame(C2v2, 1, { hands: [['4c', '4o', '5c'], ['3e', '5o', '6c'], ['1e', '6o', '7c'], ['2e', '10c', '11c']] });
  s = act(s, 0, play('4c'));
  s = act(s, 1, play('3e'));
  s = act(s, 2, play('1e'));
  s = act(s, 3, play('2e'));
  assert.equal(s.hand.bazas[0].winner, 0);
  assert.equal(s.hand.turn, 2);
  // cualquiera del equipo rival puede responder un truco
  s = act(s, 2, { type: 'truco' });
  assert.ok(legalActions(s, 1).some((a) => a.type === 'quiero'));
  assert.ok(legalActions(s, 3).some((a) => a.type === 'quiero'));
  assert.deepEqual(legalActions(s, 0), []);
});

// ---------- simulación ----------

function simulate(config: Config, games: number) {
  let hands = 0;
  for (let g = 0; g < games; g++) {
    let s = createGame(config, g * 7919 + 13);
    let r = g + 1;
    let steps = 0;
    while (s.winner === null) {
      assert.ok(++steps < 5000, 'la partida no termina');
      const h = s.hand;
      // invariantes del reparto: 40 cartas distintas, nada duplicado
      const dealt = h.dealt.flat();
      assert.equal(new Set(dealt).size, config.players * 3);
      const options: [number, Action][] = [];
      for (let seat = 0; seat < config.players; seat++) {
        for (const a of legalActions(s, seat)) options.push([seat, a]);
        if (steps % 4 !== 0) continue;
        // la vista nunca expone cartas ajenas sin jugar
        const { lastHand: _prev, ...current } = viewFor(s, seat); // la mano anterior es pública
        const view = JSON.stringify(current);
        for (let other = 0; other < config.players; other++) {
          if (other === seat) continue;
          for (const c of h.cards[other]) assert.ok(!view.includes(`"${c}"`), `fuga de ${c}`);
        }
      }
      assert.ok(options.length > 0, 'nadie puede jugar');
      // sesgo a jugar cartas para que las partidas avancen
      r = (r * 1103515245 + 12345) % 2147483648;
      const plays = options.filter(([, a]) => a.type === 'play');
      const pool = plays.length && r % 10 < 7 ? plays : options;
      const [seat, a] = pool[r % pool.length];
      const before = s.hand.number;
      s = applyAction(s, seat, a);
      if (s.hand.number !== before) hands++;
    }
    assert.ok(s.score[s.winner] >= config.target);
    for (let seat = 0; seat < config.players; seat++) assert.deepEqual(legalActions(s, seat), []);
  }
  return hands;
}

test('simulación: 600 partidas 1v1 con flor a 30', () => {
  assert.ok(simulate({ players: 2, target: 30, flor: true }, 600) > 600);
});

test('simulación: 600 partidas 2v2 sin flor a 15', () => {
  assert.ok(simulate({ players: 4, target: 15, flor: false }, 600) > 600);
});

test('simulación: 400 partidas 2v2 con flor a 30', () => {
  assert.ok(simulate({ players: 4, target: 30, flor: true }, 400) > 400);
});

test('3v3: pares contra impares, gana la baza el equipo de la carta más alta', () => {
  const C3v3: Config = { players: 6, target: 30, flor: false };
  let s = createGame(C3v3, 1, {
    hands: [['4c', '4o', '5c'], ['3e', '5o', '6c'], ['6o', '7c', '10c'], ['2e', '11c', '12c'], ['1e', '10o', '11o'], ['5b', '6b', '10b']],
  });
  for (const [seat, card] of [[0, '4c'], [1, '3e'], [2, '6o'], [3, '2e'], [4, '1e'], [5, '5b']] as const) s = act(s, seat, play(card));
  assert.equal(s.hand.bazas[0].winner, 0);
  assert.equal(s.hand.bazas[0].winnerSeat, 4);
  assert.equal(s.hand.turn, 4);
  // un truco de un equipo lo puede responder cualquiera de los tres rivales
  s = act(s, 4, { type: 'truco' });
  for (const seat of [1, 3, 5]) assert.ok(legalActions(s, seat).some((a) => a.type === 'quiero'));
  for (const seat of [0, 2, 4]) assert.deepEqual(legalActions(s, seat), []);
});

test('3v3: envido entre seis, gana el más alto y empata el más cercano a la mano', () => {
  let s = createGame({ players: 6, target: 30, flor: false }, 1, {
    hands: [['4c', '4o', '5b'], ['7o', '6o', '1e'], ['6c', '5c', '10e'], ['7c', '6e', '1b'], ['4e', '5e', '12b'], ['7b', '6b', '2o']],
  });
  // seat 1 (equipo 1) tiene 33; seats 3 y 5 tienen 7 y 33 respectivamente → gana el 1 por cercanía a la mano
  s = act(s, 0, { type: 'envido', call: 'envido' });
  s = act(s, 1, { type: 'quiero' });
  assert.deepEqual(s.score, [0, 2]);
  const tanto = s.hand.events.find((e) => e.t === 'tanto');
  assert.deepEqual(tanto, { t: 'tanto', kind: 'envido', seat: 1, value: 33 });
});

test('simulación: 300 partidas 3v3 con flor a 30', () => {
  assert.ok(simulate({ players: 6, target: 30, flor: true }, 300) > 300);
});
