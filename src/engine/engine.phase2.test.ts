import { describe, expect, it } from 'vitest';
import { reduce, rowValue } from './engine';
import type { Card, GameState, Phase2Stage, Player, Suit } from './types';

const C = (rank: number, suit: Suit): Card => ({ rank, suit });
const players = (...names: string[]): Player[] => names.map((name) => ({ name, drinks: 0 }));

const PYRAMID: Card[] = [
  C(2, 'hearts'), C(5, 'clubs'), C(9, 'diamonds'), C(11, 'spades'), // bottom row, 1 drink
  C(4, 'hearts'), C(6, 'clubs'), C(8, 'diamonds'),                  // 2 drinks
  C(10, 'hearts'), C(12, 'clubs'),                                  // 3 drinks
  C(14, 'spades'),                                                  // top, 4 drinks
];

function phase2(partial?: Partial<Phase2Stage>, drinks: number[] = [0, 0]): GameState {
  return {
    seed: 1,
    rngState: 1,
    players: players('Amy', 'Bob').map((p, i) => ({ ...p, drinks: drinks[i] ?? 0 })),
    stage: {
      kind: 'phase2',
      pyramid: PYRAMID,
      flipped: 0,
      hands: [
        [C(2, 'spades'), C(7, 'hearts')],
        [C(2, 'diamonds'), C(14, 'hearts')],
      ],
      matchQueue: [],
      ...partial,
    },
  };
}

describe('rowValue', () => {
  it('maps indexes to 1/2/3/4 drinks', () => {
    expect([0, 1, 2, 3].map(rowValue)).toEqual([1, 1, 1, 1]);
    expect([4, 5, 6].map(rowValue)).toEqual([2, 2, 2]);
    expect([7, 8].map(rowValue)).toEqual([3, 3]);
    expect(rowValue(9)).toBe(4);
  });
});

describe('FLIP_PYRAMID_CARD', () => {
  it('flips the next card, removes matching cards, queues one entry per matched card', () => {
    const s = reduce(phase2(), { type: 'FLIP_PYRAMID_CARD' }); // flips 2♥
    const stage = s.stage as Phase2Stage;
    expect(stage.flipped).toBe(1);
    expect(stage.matchQueue).toEqual([
      { playerIndex: 0, drinks: 1 },
      { playerIndex: 1, drinks: 1 },
    ]);
    expect(stage.hands).toEqual([[C(7, 'hearts')], [C(14, 'hearts')]]);
  });

  it('a hand with two copies queues two entries', () => {
    const s0 = phase2({ hands: [[C(2, 'spades'), C(2, 'clubs')], [C(7, 'hearts')]] });
    const s1 = reduce(s0, { type: 'FLIP_PYRAMID_CARD' });
    expect((s1.stage as Phase2Stage).matchQueue).toEqual([
      { playerIndex: 0, drinks: 1 },
      { playerIndex: 0, drinks: 1 },
    ]);
  });

  it('uses the row drink value for higher rows', () => {
    const s0 = phase2({ flipped: 9, hands: [[C(14, 'hearts')], []] });
    const s1 = reduce(s0, { type: 'FLIP_PYRAMID_CARD' }); // top card 14♠, 4 drinks
    expect((s1.stage as Phase2Stage).matchQueue).toEqual([{ playerIndex: 0, drinks: 4 }]);
  });

  it('is rejected while assignments are pending or after the last card', () => {
    const pending = reduce(phase2(), { type: 'FLIP_PYRAMID_CARD' });
    expect(reduce(pending, { type: 'FLIP_PYRAMID_CARD' })).toBe(pending);
    const done = phase2({ flipped: 10, hands: [[], []] });
    expect(reduce(done, { type: 'FLIP_PYRAMID_CARD' })).toBe(done);
  });
});

describe('phase 2 ASSIGN_DRINKS', () => {
  it('pops the queue head, adds its drinks to the target, and blocks self-assign', () => {
    const s0 = reduce(phase2(), { type: 'FLIP_PYRAMID_CARD' }); // queue: Amy(1), Bob(1)
    expect(reduce(s0, { type: 'ASSIGN_DRINKS', toPlayer: 0 })).toBe(s0); // Amy at head, no self
    const s1 = reduce(s0, { type: 'ASSIGN_DRINKS', toPlayer: 1 }); // Amy -> Bob
    expect(s1.players[1].drinks).toBe(1);
    expect((s1.stage as Phase2Stage).matchQueue).toEqual([{ playerIndex: 1, drinks: 1 }]);
    const s2 = reduce(s1, { type: 'ASSIGN_DRINKS', toPlayer: 0 }); // Bob -> Amy
    expect(s2.players[0].drinks).toBe(1);
    expect((s2.stage as Phase2Stage).matchQueue).toEqual([]);
  });

  it('is rejected when the queue is empty', () => {
    const s = phase2();
    expect(reduce(s, { type: 'ASSIGN_DRINKS', toPlayer: 1 })).toBe(s);
  });
});

describe('ADVANCE to bus reveal', () => {
  it('is rejected until all 10 cards are flipped and the queue is empty', () => {
    const early = phase2({ flipped: 9, hands: [[], []] });
    expect(reduce(early, { type: 'ADVANCE' })).toBe(early);
    const pending = reduce(phase2({ flipped: 9, hands: [[C(14, 'hearts')], []] }), { type: 'FLIP_PYRAMID_CARD' });
    expect(reduce(pending, { type: 'ADVANCE' })).toBe(pending);
  });

  it('picks the player with the most drinks as rider', () => {
    const s = reduce(phase2({ flipped: 10, hands: [[], []] }, [3, 1]), { type: 'ADVANCE' });
    expect(s.stage).toEqual({ kind: 'busReveal', riderIndex: 0 });
  });

  it('breaks ties deterministically via the seeded rng', () => {
    const tied = phase2({ flipped: 10, hands: [[], []] }, [2, 2]);
    const a = reduce(tied, { type: 'ADVANCE' });
    const b = reduce(tied, { type: 'ADVANCE' });
    expect(a).toEqual(b);
    const stage = a.stage as { kind: string; riderIndex: number };
    expect(stage.kind).toBe('busReveal');
    expect([0, 1]).toContain(stage.riderIndex);
    expect(a.rngState).not.toBe(tied.rngState); // tie-break consumed rng
  });
});
