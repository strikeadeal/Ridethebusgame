import { describe, expect, it } from 'vitest';
import { next, randomInt, shuffle } from './rng';

describe('next', () => {
  it('is deterministic for a given state', () => {
    expect(next(42)).toEqual(next(42));
  });

  it('returns values in [0, 1) and advances state', () => {
    let state = 1;
    for (let i = 0; i < 1000; i++) {
      const r = next(state);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(1);
      expect(r.state).not.toBe(state);
      state = r.state;
    }
  });
});

describe('shuffle', () => {
  const input = Array.from({ length: 52 }, (_, i) => i);

  it('returns a permutation of the input', () => {
    const { items } = shuffle(input, 7);
    expect([...items].sort((a, b) => a - b)).toEqual(input);
    expect(items).not.toEqual(input);
  });

  it('is reproducible and does not mutate the input', () => {
    const copy = input.slice();
    const a = shuffle(input, 7);
    const b = shuffle(input, 7);
    expect(a).toEqual(b);
    expect(input).toEqual(copy);
  });

  it('advances the rng state', () => {
    expect(shuffle(input, 7).rngState).not.toBe(7);
  });

  it('produces different orders for different states', () => {
    expect(shuffle(input, 1).items).not.toEqual(shuffle(input, 2).items);
  });
});

describe('randomInt', () => {
  it('stays within [0, maxExclusive)', () => {
    let state = 3;
    for (let i = 0; i < 200; i++) {
      const r = randomInt(5, state);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(5);
      state = r.rngState;
    }
  });
});
