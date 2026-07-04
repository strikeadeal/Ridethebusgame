import type { GameState } from '../engine/types';

const KEY = 'ridethebus:save:v1';
const STAGE_KINDS = ['idle', 'phase1', 'phase2', 'busReveal', 'phase3', 'gameOver'];

/** Persist in-progress games; drop the save once the game is idle or over. */
export function saveGame(state: GameState): void {
  const inProgress = state.stage.kind !== 'idle' && state.stage.kind !== 'gameOver';
  try {
    if (inProgress) {
      localStorage.setItem(KEY, JSON.stringify(state));
    } else {
      localStorage.removeItem(KEY);
    }
  } catch {
    // Storage unavailable or full — resume is best-effort.
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed || typeof parsed !== 'object') return null;
    if (!Array.isArray(parsed.players)) return null;
    if (!parsed.stage || !STAGE_KINDS.includes(parsed.stage.kind)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
