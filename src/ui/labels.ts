import type { GuessAnswer, Suit } from '../engine/types';

export const QUESTION_TEXT = [
  'Red or Black?',
  'Higher or Lower?',
  'Inside or Outside?',
  'Guess the Suit',
];

export const ANSWER_LABELS: Record<GuessAnswer, string> = {
  red: '🔴 Red',
  black: '⚫ Black',
  higher: '⬆️ Higher',
  lower: '⬇️ Lower',
  inside: '↔️ Inside',
  outside: '↕️ Outside',
  hearts: '♥ Hearts',
  diamonds: '♦ Diamonds',
  clubs: '♣ Clubs',
  spades: '♠ Spades',
};

export const SUIT_GLYPH: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
};

const FACE_RANKS: Record<number, string> = { 11: 'J', 12: 'Q', 13: 'K', 14: 'A' };

export function rankLabel(rank: number): string {
  return FACE_RANKS[rank] ?? String(rank);
}
