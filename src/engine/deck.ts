import type { Card, Suit } from './types';

export const SUITS: readonly Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

export function fullDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/** 2-4 players: 5 cards; 5-6: 4; 7-8: 3. Always fits: 10 + 8*3 = 34 <= 52. */
export function handSizeFor(playerCount: number): number {
  if (playerCount <= 4) return 5;
  if (playerCount <= 6) return 4;
  return 3;
}
