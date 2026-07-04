export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

/** rank 2-14; 14 = Ace (high) */
export interface Card {
  rank: number;
  suit: Suit;
}

export interface Player {
  name: string;
  drinks: number;
}

export type GuessAnswer =
  | 'red'
  | 'black'
  | 'higher'
  | 'lower'
  | 'inside'
  | 'outside'
  | Suit;

export interface Feedback {
  correct: boolean;
  card: Card;
}

export interface PendingMatch {
  playerIndex: number;
  drinks: number;
}

export type Stage =
  | { kind: 'idle' }
  | {
      kind: 'phase1';
      hands: Card[][]; // [player][4], face-down in dealt order
      questionIndex: number; // 0-3, rounds: all players answer q before q+1
      playerIndex: number;
      feedback: Feedback | null; // set after GUESS until ASSIGN_DRINKS/ADVANCE
    }
  | {
      kind: 'phase2';
      pyramid: Card[]; // 10 cards; 0-3 bottom row, 4-6, 7-8, 9 top
      flipped: number; // 0-10; pyramid[i] is face-up iff i < flipped
      hands: Card[][]; // remaining hand cards per player (public)
      matchQueue: PendingMatch[]; // pending drink assignments, head first
    }
  | { kind: 'busReveal'; riderIndex: number }
  | {
      kind: 'phase3';
      riderIndex: number;
      cards: Card[]; // current row of 4
      position: number; // 0-3 current question
      attempts: number; // starts at 1
      deck: Card[]; // remaining draw pile for redeals
      feedback: Feedback | null;
    }
  | { kind: 'gameOver'; riderIndex: number; attempts: number };

export type Phase1Stage = Extract<Stage, { kind: 'phase1' }>;
export type Phase2Stage = Extract<Stage, { kind: 'phase2' }>;
export type BusRevealStage = Extract<Stage, { kind: 'busReveal' }>;
export type Phase3Stage = Extract<Stage, { kind: 'phase3' }>;
export type GameOverStage = Extract<Stage, { kind: 'gameOver' }>;

export interface GameState {
  seed: number;
  rngState: number;
  players: Player[];
  stage: Stage;
}

export type Action =
  | { type: 'START_GAME'; names: string[]; seed: number }
  | { type: 'GUESS'; answer: GuessAnswer }
  | { type: 'ASSIGN_DRINKS'; toPlayer: number }
  | { type: 'FLIP_PYRAMID_CARD' }
  | { type: 'ADVANCE' };
