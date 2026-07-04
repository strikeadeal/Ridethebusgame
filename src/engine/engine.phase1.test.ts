import { describe, expect, it } from 'vitest';
import { createInitialState, MAX_PLAYERS, MIN_PLAYERS, reduce } from './engine';
import type { Card, GameState, Phase1Stage, Phase2Stage, Player, Suit } from './types';

const C = (rank: number, suit: Suit): Card => ({ rank, suit });
const players = (...names: string[]): Player[] => names.map((name) => ({ name, drinks: 0 }));

function phase1(partial?: Partial<Phase1Stage>): GameState {
  return {
    seed: 1,
    rngState: 1,
    players: players('Amy', 'Bob'),
    stage: {
      kind: 'phase1',
      hands: [
        [C(5, 'hearts'), C(9, 'spades'), C(7, 'clubs'), C(12, 'diamonds')],
        [C(3, 'clubs'), C(3, 'diamonds'), C(10, 'hearts'), C(14, 'spades')],
      ],
      questionIndex: 0,
      playerIndex: 0,
      feedback: null,
      ...partial,
    },
  };
}

describe('createInitialState', () => {
  it('starts idle with no players', () => {
    expect(createInitialState()).toEqual({ seed: 0, rngState: 0, players: [], stage: { kind: 'idle' } });
  });
});

describe('START_GAME', () => {
  it('deals 4 unique face-down cards per player, deterministically by seed', () => {
    const a = reduce(createInitialState(), { type: 'START_GAME', names: ['Amy', 'Bob', 'Cat'], seed: 42 });
    const b = reduce(createInitialState(), { type: 'START_GAME', names: ['Amy', 'Bob', 'Cat'], seed: 42 });
    expect(a).toEqual(b);
    expect(a.players.map((p) => p.name)).toEqual(['Amy', 'Bob', 'Cat']);
    expect(a.players.every((p) => p.drinks === 0)).toBe(true);
    const stage = a.stage as Phase1Stage;
    expect(stage.kind).toBe('phase1');
    expect(stage.questionIndex).toBe(0);
    expect(stage.playerIndex).toBe(0);
    expect(stage.hands).toHaveLength(3);
    const all = stage.hands.flat();
    expect(all).toHaveLength(12);
    expect(new Set(all.map((c) => `${c.rank}-${c.suit}`)).size).toBe(12);
  });

  it('different seeds deal different hands', () => {
    const a = reduce(createInitialState(), { type: 'START_GAME', names: ['Amy', 'Bob'], seed: 1 });
    const b = reduce(createInitialState(), { type: 'START_GAME', names: ['Amy', 'Bob'], seed: 2 });
    expect((a.stage as Phase1Stage).hands).not.toEqual((b.stage as Phase1Stage).hands);
  });

  it('rejects invalid player counts and blank names', () => {
    const s = createInitialState();
    expect(reduce(s, { type: 'START_GAME', names: ['Solo'], seed: 1 })).toBe(s);
    expect(
      reduce(s, { type: 'START_GAME', names: Array.from({ length: MAX_PLAYERS + 1 }, (_, i) => `P${i}`), seed: 1 }),
    ).toBe(s);
    expect(reduce(s, { type: 'START_GAME', names: ['Amy', '   '], seed: 1 })).toBe(s);
    expect(MIN_PLAYERS).toBe(2);
  });

  it('is allowed mid-game (starts a fresh game)', () => {
    const mid = phase1();
    const fresh = reduce(mid, { type: 'START_GAME', names: ['Zoe', 'Yan'], seed: 9 });
    expect(fresh.stage.kind).toBe('phase1');
    expect(fresh.players.map((p) => p.name)).toEqual(['Zoe', 'Yan']);
  });
});

describe('phase 1 guessing', () => {
  it('wrong guess adds a drink to the guesser and sets feedback', () => {
    const s = reduce(phase1(), { type: 'GUESS', answer: 'black' }); // card is 5♥ (red)
    expect(s.players[0].drinks).toBe(1);
    const stage = s.stage as Phase1Stage;
    expect(stage.feedback).toEqual({ correct: false, card: C(5, 'hearts') });
  });

  it('correct guess sets feedback and waits for drink assignment', () => {
    const s = reduce(phase1(), { type: 'GUESS', answer: 'red' });
    expect(s.players[0].drinks).toBe(0);
    expect((s.stage as Phase1Stage).feedback?.correct).toBe(true);
    expect(reduce(s, { type: 'ADVANCE' })).toBe(s); // must assign, not advance
    expect(reduce(s, { type: 'ASSIGN_DRINKS', toPlayer: 0 })).toBe(s); // not to self
  });

  it('assignment gives a drink and moves to the next player', () => {
    const s0 = reduce(phase1(), { type: 'GUESS', answer: 'red' });
    const s1 = reduce(s0, { type: 'ASSIGN_DRINKS', toPlayer: 1 });
    expect(s1.players[1].drinks).toBe(1);
    const stage = s1.stage as Phase1Stage;
    expect(stage.playerIndex).toBe(1);
    expect(stage.questionIndex).toBe(0);
    expect(stage.feedback).toBeNull();
  });

  it('wrong guess then ADVANCE moves to the next player', () => {
    const s0 = reduce(phase1(), { type: 'GUESS', answer: 'black' });
    const s1 = reduce(s0, { type: 'ADVANCE' });
    const stage = s1.stage as Phase1Stage;
    expect(stage.playerIndex).toBe(1);
    expect(stage.feedback).toBeNull();
  });

  it('last player finishing a question starts the next round', () => {
    const s0 = phase1({ playerIndex: 1 }); // Bob's card 0 is 3♣ (black)
    const s1 = reduce(s0, { type: 'GUESS', answer: 'black' });
    const s2 = reduce(s1, { type: 'ASSIGN_DRINKS', toPlayer: 0 });
    const stage = s2.stage as Phase1Stage;
    expect(stage.questionIndex).toBe(1);
    expect(stage.playerIndex).toBe(0);
  });

  it('evaluates questions 2-4 against the right cards', () => {
    // Amy: 5♥ 9♠ 7♣ 12♦ — 9 is higher than 5; 7 is inside 5..9; suit is diamonds
    const q2 = reduce(phase1({ questionIndex: 1 }), { type: 'GUESS', answer: 'higher' });
    expect((q2.stage as Phase1Stage).feedback?.correct).toBe(true);
    const q3 = reduce(phase1({ questionIndex: 2 }), { type: 'GUESS', answer: 'inside' });
    expect((q3.stage as Phase1Stage).feedback?.correct).toBe(true);
    const q4 = reduce(phase1({ questionIndex: 3 }), { type: 'GUESS', answer: 'diamonds' });
    expect((q4.stage as Phase1Stage).feedback?.correct).toBe(true);
  });

  it('rejects answers that do not fit the question and double guesses', () => {
    const s = phase1();
    expect(reduce(s, { type: 'GUESS', answer: 'hearts' })).toBe(s);
    expect(reduce(s, { type: 'GUESS', answer: 'higher' })).toBe(s);
    const guessed = reduce(s, { type: 'GUESS', answer: 'red' });
    expect(reduce(guessed, { type: 'GUESS', answer: 'red' })).toBe(guessed);
  });

  it('rejects out-of-range assignment targets', () => {
    const s = reduce(phase1(), { type: 'GUESS', answer: 'red' });
    expect(reduce(s, { type: 'ASSIGN_DRINKS', toPlayer: 5 })).toBe(s);
    expect(reduce(s, { type: 'ASSIGN_DRINKS', toPlayer: -1 })).toBe(s);
  });
});

describe('transition to phase 2', () => {
  it('after the last player answers question 4, the pyramid is dealt', () => {
    const s0 = phase1({ questionIndex: 3, playerIndex: 1 }); // Bob's 4th card is 14♠
    const s1 = reduce(s0, { type: 'GUESS', answer: 'spades' });
    const s2 = reduce(s1, { type: 'ASSIGN_DRINKS', toPlayer: 0 });
    const stage = s2.stage as Phase2Stage;
    expect(stage.kind).toBe('phase2');
    expect(stage.pyramid).toHaveLength(10);
    expect(stage.flipped).toBe(0);
    expect(stage.matchQueue).toEqual([]);
    expect(stage.hands).toHaveLength(2);
    expect(stage.hands[0]).toHaveLength(5); // 2 players -> 5 cards each
    expect(stage.hands[1]).toHaveLength(5);
    const all = [...stage.pyramid, ...stage.hands.flat()];
    expect(new Set(all.map((c) => `${c.rank}-${c.suit}`)).size).toBe(20); // fresh deck, no dupes
    expect(s2.rngState).not.toBe(s0.rngState); // shuffle consumed rng
  });
});

describe('invalid actions in idle', () => {
  it('rejects everything except START_GAME', () => {
    const s = createInitialState();
    expect(reduce(s, { type: 'GUESS', answer: 'red' })).toBe(s);
    expect(reduce(s, { type: 'ASSIGN_DRINKS', toPlayer: 0 })).toBe(s);
    expect(reduce(s, { type: 'FLIP_PYRAMID_CARD' })).toBe(s);
    expect(reduce(s, { type: 'ADVANCE' })).toBe(s);
  });
});
