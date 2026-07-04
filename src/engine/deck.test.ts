import { describe, expect, it } from 'vitest';
import { fullDeck, handSizeFor, SUITS } from './deck';

describe('fullDeck', () => {
  it('has 52 unique cards', () => {
    const deck = fullDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((c) => `${c.rank}-${c.suit}`)).size).toBe(52);
  });

  it('has 13 ranks (2-14) in each of 4 suits', () => {
    const deck = fullDeck();
    for (const suit of SUITS) {
      const ranks = deck.filter((c) => c.suit === suit).map((c) => c.rank);
      expect([...ranks].sort((a, b) => a - b)).toEqual(
        Array.from({ length: 13 }, (_, i) => i + 2),
      );
    }
  });
});

describe('handSizeFor', () => {
  it('follows the spec table', () => {
    expect(handSizeFor(2)).toBe(5);
    expect(handSizeFor(3)).toBe(5);
    expect(handSizeFor(4)).toBe(5);
    expect(handSizeFor(5)).toBe(4);
    expect(handSizeFor(6)).toBe(4);
    expect(handSizeFor(7)).toBe(3);
    expect(handSizeFor(8)).toBe(3);
  });
});
