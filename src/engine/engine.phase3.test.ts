import { describe, expect, it } from 'vitest';
import { reduce } from './engine';
import { fullDeck } from './deck';
import type { Card, GameState, Phase3Stage, Player, Suit } from './types';

const C = (rank: number, suit: Suit): Card => ({ rank, suit });
const players = (...names: string[]): Player[] => names.map((name) => ({ name, drinks: 0 }));

function busReveal(): GameState {
  return { seed: 1, rngState: 1, players: players('Amy', 'Bob'), stage: { kind: 'busReveal', riderIndex: 1 } };
}

function phase3(partial?: Partial<Phase3Stage>): GameState {
  return {
    seed: 1,
    rngState: 1,
    players: players('Amy', 'Bob'),
    stage: {
      kind: 'phase3',
      riderIndex: 1,
      cards: [C(5, 'hearts'), C(9, 'spades'), C(7, 'clubs'), C(12, 'diamonds')],
      position: 0,
      attempts: 1,
      deck: fullDeck().slice(0, 20), // arbitrary draw pile for redeals
      feedback: null,
      ...partial,
    },
  };
}

describe('dealing the bus', () => {
  it('ADVANCE from busReveal deals 4 cards and keeps the rest as draw pile', () => {
    const s = reduce(busReveal(), { type: 'ADVANCE' });
    const stage = s.stage as Phase3Stage;
    expect(stage.kind).toBe('phase3');
    expect(stage.riderIndex).toBe(1);
    expect(stage.cards).toHaveLength(4);
    expect(stage.deck).toHaveLength(48);
    expect(stage.position).toBe(0);
    expect(stage.attempts).toBe(1);
    expect(stage.feedback).toBeNull();
    const all = [...stage.cards, ...stage.deck];
    expect(new Set(all.map((c) => `${c.rank}-${c.suit}`)).size).toBe(52);
  });
});

describe('riding the bus', () => {
  it('four correct guesses end the game', () => {
    // cards: 5♥ (red), 9♠ (higher), 7♣ (inside 5..9), 12♦ (diamonds)
    let s = phase3();
    for (const answer of ['red', 'higher', 'inside', 'diamonds'] as const) {
      s = reduce(s, { type: 'GUESS', answer });
      expect((s.stage as Phase3Stage).feedback?.correct).toBe(true);
      s = reduce(s, { type: 'ADVANCE' });
    }
    expect(s.stage).toEqual({ kind: 'gameOver', riderIndex: 1, attempts: 1 });
    expect(s.players[1].drinks).toBe(0);
  });

  it('a wrong guess drinks, then ADVANCE redeals fresh cards from position 0', () => {
    const s0 = phase3();
    const s1 = reduce(s0, { type: 'GUESS', answer: 'black' }); // 5♥ is red
    expect(s1.players[1].drinks).toBe(1);
    expect((s1.stage as Phase3Stage).feedback).toEqual({ correct: false, card: C(5, 'hearts') });
    const s2 = reduce(s1, { type: 'ADVANCE' });
    const stage = s2.stage as Phase3Stage;
    expect(stage.position).toBe(0);
    expect(stage.attempts).toBe(2);
    expect(stage.feedback).toBeNull();
    expect(stage.cards).toEqual((s0.stage as Phase3Stage).deck.slice(0, 4));
    expect(stage.deck).toHaveLength(16);
  });

  it('a wrong guess mid-row also resets to the start', () => {
    const s0 = phase3({ position: 2 });
    const s1 = reduce(s0, { type: 'GUESS', answer: 'outside' }); // 7 is inside 5..9
    const s2 = reduce(s1, { type: 'ADVANCE' });
    expect((s2.stage as Phase3Stage).position).toBe(0);
    expect((s2.stage as Phase3Stage).attempts).toBe(2);
  });

  it('reshuffles a fresh 52-card deck when fewer than 4 cards remain', () => {
    const s0 = phase3({ deck: fullDeck().slice(0, 3) });
    const s1 = reduce(s0, { type: 'GUESS', answer: 'black' });
    const s2 = reduce(s1, { type: 'ADVANCE' });
    const stage = s2.stage as Phase3Stage;
    expect(stage.cards).toHaveLength(4);
    expect(stage.deck).toHaveLength(48);
    expect(s2.rngState).not.toBe(s0.rngState); // reshuffle consumed rng
  });

  it('rejects double guesses and premature ADVANCE', () => {
    const s = phase3();
    expect(reduce(s, { type: 'ADVANCE' })).toBe(s); // no feedback yet
    const guessed = reduce(s, { type: 'GUESS', answer: 'red' });
    expect(reduce(guessed, { type: 'GUESS', answer: 'red' })).toBe(guessed);
  });
});

describe('game over', () => {
  it('rejects everything except START_GAME', () => {
    const s: GameState = {
      seed: 1,
      rngState: 1,
      players: players('Amy', 'Bob'),
      stage: { kind: 'gameOver', riderIndex: 0, attempts: 3 },
    };
    expect(reduce(s, { type: 'GUESS', answer: 'red' })).toBe(s);
    expect(reduce(s, { type: 'ADVANCE' })).toBe(s);
    const fresh = reduce(s, { type: 'START_GAME', names: ['Amy', 'Bob'], seed: 5 });
    expect(fresh.stage.kind).toBe('phase1');
    expect(fresh.players.every((p) => p.drinks === 0)).toBe(true);
  });
});
