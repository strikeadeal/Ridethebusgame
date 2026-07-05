import { describe, expect, it } from 'vitest';
import type { Stage } from '../engine/types';
import { soundForTransition } from './gameSounds';

const idle: Stage = { kind: 'idle' };
const phase1 = (feedback: { correct: boolean } | null): Stage => ({
  kind: 'phase1',
  hands: [[]],
  questionIndex: 0,
  playerIndex: 0,
  feedback: feedback ? { correct: feedback.correct, card: { rank: 2, suit: 'hearts' } } : null,
});
const phase2 = (flipped: number): Stage => ({
  kind: 'phase2',
  pyramid: [],
  flipped,
  hands: [[]],
  matchQueue: [],
});
const phase3 = (attempts: number, feedback: { correct: boolean } | null): Stage => ({
  kind: 'phase3',
  riderIndex: 0,
  cards: [],
  position: 0,
  attempts,
  deck: [],
  feedback: feedback ? { correct: feedback.correct, card: { rank: 2, suit: 'hearts' } } : null,
});

describe('soundForTransition', () => {
  it('deals when a game starts', () => {
    expect(soundForTransition(idle, phase1(null))).toBe('deal');
  });
  it('chimes or thuds when phase1 feedback lands', () => {
    expect(soundForTransition(phase1(null), phase1({ correct: true }))).toBe('correct');
    expect(soundForTransition(phase1(null), phase1({ correct: false }))).toBe('wrong');
  });
  it('flips when a pyramid card turns', () => {
    expect(soundForTransition(phase2(3), phase2(4))).toBe('flip');
  });
  it('announces phase changes', () => {
    expect(soundForTransition(phase1(null), phase2(0))).toBe('rowAdvance');
    expect(soundForTransition(phase2(10), { kind: 'busReveal', riderIndex: 0 })).toBe('busStart');
    expect(soundForTransition({ kind: 'busReveal', riderIndex: 0 }, phase3(1, null))).toBe('deal');
    expect(soundForTransition(phase3(1, null), { kind: 'gameOver', riderIndex: 0, attempts: 1 })).toBe('fanfare');
  });
  it('deals again on a failed bus attempt redeal', () => {
    expect(soundForTransition(phase3(1, { correct: false }), phase3(2, null))).toBe('deal');
  });
  it('is silent when nothing notable changed', () => {
    expect(soundForTransition(phase2(4), phase2(4))).toBeNull();
    expect(soundForTransition(idle, idle)).toBeNull();
    expect(soundForTransition(phase1({ correct: true }), phase1(null))).toBeNull();
  });
});
