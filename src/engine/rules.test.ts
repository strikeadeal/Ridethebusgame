import { describe, expect, it } from 'vitest';
import { evalHigherLower, evalInsideOutside, evalRedBlack, evalSuit, isRed } from './rules';
import type { Card, Suit } from './types';

const C = (rank: number, suit: Suit): Card => ({ rank, suit });

describe('isRed', () => {
  it('hearts and diamonds are red; clubs and spades are not', () => {
    expect(isRed(C(2, 'hearts'))).toBe(true);
    expect(isRed(C(2, 'diamonds'))).toBe(true);
    expect(isRed(C(2, 'clubs'))).toBe(false);
    expect(isRed(C(2, 'spades'))).toBe(false);
  });
});

describe('evalRedBlack', () => {
  it('matches answer to card color', () => {
    expect(evalRedBlack('red', C(5, 'hearts'))).toBe(true);
    expect(evalRedBlack('black', C(5, 'hearts'))).toBe(false);
    expect(evalRedBlack('black', C(5, 'spades'))).toBe(true);
    expect(evalRedBlack('red', C(5, 'spades'))).toBe(false);
  });
});

describe('evalHigherLower', () => {
  it('compares second card rank to first', () => {
    expect(evalHigherLower('higher', C(5, 'hearts'), C(9, 'clubs'))).toBe(true);
    expect(evalHigherLower('lower', C(5, 'hearts'), C(9, 'clubs'))).toBe(false);
    expect(evalHigherLower('lower', C(9, 'hearts'), C(5, 'clubs'))).toBe(true);
  });

  it('treats ace as high', () => {
    expect(evalHigherLower('higher', C(13, 'hearts'), C(14, 'clubs'))).toBe(true);
  });

  it('rank tie is wrong for both answers', () => {
    expect(evalHigherLower('higher', C(7, 'hearts'), C(7, 'clubs'))).toBe(false);
    expect(evalHigherLower('lower', C(7, 'hearts'), C(7, 'clubs'))).toBe(false);
  });
});

describe('evalInsideOutside', () => {
  const first = C(5, 'hearts');
  const second = C(10, 'clubs');

  it('inside means strictly between the two ranks (order-independent)', () => {
    expect(evalInsideOutside('inside', first, second, C(7, 'spades'))).toBe(true);
    expect(evalInsideOutside('outside', first, second, C(7, 'spades'))).toBe(false);
    expect(evalInsideOutside('inside', second, first, C(7, 'spades'))).toBe(true);
  });

  it('outside means strictly above or below the range', () => {
    expect(evalInsideOutside('outside', first, second, C(2, 'spades'))).toBe(true);
    expect(evalInsideOutside('outside', first, second, C(14, 'spades'))).toBe(true);
    expect(evalInsideOutside('inside', first, second, C(2, 'spades'))).toBe(false);
  });

  it('boundary tie is wrong for both answers', () => {
    for (const card of [C(5, 'spades'), C(10, 'spades')]) {
      expect(evalInsideOutside('inside', first, second, card)).toBe(false);
      expect(evalInsideOutside('outside', first, second, card)).toBe(false);
    }
  });
});

describe('evalSuit', () => {
  it('matches exact suit', () => {
    expect(evalSuit('diamonds', C(12, 'diamonds'))).toBe(true);
    expect(evalSuit('hearts', C(12, 'diamonds'))).toBe(false);
  });
});
