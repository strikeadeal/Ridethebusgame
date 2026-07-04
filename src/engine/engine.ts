import { fullDeck, handSizeFor } from './deck';
import { shuffle } from './rng';
import { evalHigherLower, evalInsideOutside, evalRedBlack, evalSuit } from './rules';
import type { Action, Card, GameState, GuessAnswer, Phase1Stage, Suit } from './types';

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 8;

export const QUESTION_ANSWERS: readonly GuessAnswer[][] = [
  ['red', 'black'],
  ['higher', 'lower'],
  ['inside', 'outside'],
  ['hearts', 'diamonds', 'clubs', 'spades'],
];

/** Pyramid drink value by card index: 0-3 bottom row (1) ... 9 top (4). */
export function rowValue(index: number): number {
  if (index < 4) return 1;
  if (index < 7) return 2;
  if (index < 9) return 3;
  return 4;
}

export function createInitialState(): GameState {
  return { seed: 0, rngState: 0, players: [], stage: { kind: 'idle' } };
}

export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'START_GAME':
      return startGame(state, action.names, action.seed);
    case 'GUESS':
      return guess(state, action.answer);
    case 'ASSIGN_DRINKS':
      return assignDrinks(state, action.toPlayer);
    case 'FLIP_PYRAMID_CARD':
      return flipPyramid(state);
    case 'ADVANCE':
      return advance(state);
  }
}

function startGame(state: GameState, names: string[], seed: number): GameState {
  const trimmed = names.map((n) => n.trim());
  if (trimmed.length < MIN_PLAYERS || trimmed.length > MAX_PLAYERS) return state;
  if (trimmed.some((n) => n.length === 0)) return state;
  const players = trimmed.map((name) => ({ name, drinks: 0 }));
  const { items: deck, rngState } = shuffle(fullDeck(), seed >>> 0);
  const hands = players.map((_, i) => deck.slice(i * 4, i * 4 + 4));
  return {
    seed: seed >>> 0,
    rngState,
    players,
    stage: { kind: 'phase1', hands, questionIndex: 0, playerIndex: 0, feedback: null },
  };
}

/** Returns null when the answer does not belong to the question. */
function evaluate(questionIndex: number, answer: GuessAnswer, cards: Card[]): boolean | null {
  if (!QUESTION_ANSWERS[questionIndex]?.includes(answer)) return null;
  switch (questionIndex) {
    case 0:
      return evalRedBlack(answer as 'red' | 'black', cards[0]);
    case 1:
      return evalHigherLower(answer as 'higher' | 'lower', cards[0], cards[1]);
    case 2:
      return evalInsideOutside(answer as 'inside' | 'outside', cards[0], cards[1], cards[2]);
    case 3:
      return evalSuit(answer as Suit, cards[3]);
    default:
      return null;
  }
}

function addDrinks(state: GameState, playerIndex: number, amount: number): GameState {
  return {
    ...state,
    players: state.players.map((p, i) => (i === playerIndex ? { ...p, drinks: p.drinks + amount } : p)),
  };
}

function guess(state: GameState, answer: GuessAnswer): GameState {
  const { stage } = state;
  if (stage.kind === 'phase1') {
    if (stage.feedback) return state;
    const cards = stage.hands[stage.playerIndex];
    const correct = evaluate(stage.questionIndex, answer, cards);
    if (correct === null) return state;
    const card = cards[stage.questionIndex];
    const next = correct ? state : addDrinks(state, stage.playerIndex, 1);
    return { ...next, stage: { ...stage, feedback: { correct, card } } };
  }
  // Task 7: phase3 branch
  return state;
}

function assignDrinks(state: GameState, toPlayer: number): GameState {
  if (toPlayer < 0 || toPlayer >= state.players.length) return state;
  const { stage } = state;
  if (stage.kind === 'phase1') {
    if (!stage.feedback?.correct) return state;
    if (toPlayer === stage.playerIndex) return state;
    return advancePhase1(addDrinks(state, toPlayer, 1));
  }
  // Task 6: phase2 branch
  return state;
}

function flipPyramid(state: GameState): GameState {
  // Task 6
  return state;
}

function advance(state: GameState): GameState {
  const { stage } = state;
  if (stage.kind === 'phase1') {
    if (!stage.feedback || stage.feedback.correct) return state; // correct requires ASSIGN_DRINKS
    return advancePhase1(state);
  }
  // Task 6: phase2 -> busReveal; Task 7: busReveal -> phase3, phase3 progress
  return state;
}

/** Clear feedback and rotate: next player, next question, or deal Phase 2. */
function advancePhase1(state: GameState): GameState {
  const stage = state.stage as Phase1Stage;
  if (stage.playerIndex < state.players.length - 1) {
    return { ...state, stage: { ...stage, playerIndex: stage.playerIndex + 1, feedback: null } };
  }
  if (stage.questionIndex < 3) {
    return { ...state, stage: { ...stage, playerIndex: 0, questionIndex: stage.questionIndex + 1, feedback: null } };
  }
  return dealPhase2(state);
}

function dealPhase2(state: GameState): GameState {
  const { items: deck, rngState } = shuffle(fullDeck(), state.rngState);
  const pyramid = deck.slice(0, 10);
  const size = handSizeFor(state.players.length);
  const hands = state.players.map((_, i) => deck.slice(10 + i * size, 10 + (i + 1) * size));
  return { ...state, rngState, stage: { kind: 'phase2', pyramid, flipped: 0, hands, matchQueue: [] } };
}
