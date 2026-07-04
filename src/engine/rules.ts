import type { Card, Suit } from './types';

export function isRed(card: Card): boolean {
  return card.suit === 'hearts' || card.suit === 'diamonds';
}

export function evalRedBlack(answer: 'red' | 'black', card: Card): boolean {
  return (answer === 'red') === isRed(card);
}

/** Rank tie = wrong, whatever the answer. */
export function evalHigherLower(answer: 'higher' | 'lower', first: Card, second: Card): boolean {
  if (second.rank === first.rank) return false;
  return answer === 'higher' ? second.rank > first.rank : second.rank < first.rank;
}

/** Equal to either boundary = wrong, whatever the answer. */
export function evalInsideOutside(
  answer: 'inside' | 'outside',
  first: Card,
  second: Card,
  third: Card,
): boolean {
  const lo = Math.min(first.rank, second.rank);
  const hi = Math.max(first.rank, second.rank);
  if (third.rank === lo || third.rank === hi) return false;
  const inside = third.rank > lo && third.rank < hi;
  return answer === 'inside' ? inside : !inside;
}

export function evalSuit(answer: Suit, card: Card): boolean {
  return answer === card.suit;
}
