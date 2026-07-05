import type { GameOverStage, GameState } from '../engine/types';

export type ShareOutcome = 'shared' | 'copied' | 'idle';

export function buildShareText(state: GameState, stage: GameOverStage): string {
  const rider = state.players[stage.riderIndex].name;
  const lines = [
    `🚌 Ride the Bus — ${rider} escaped after ${stage.attempts} attempt${stage.attempts === 1 ? '' : 's'}`,
  ];
  const sorted = [...state.players].sort((a, b) => b.drinks - a.drinks);
  for (const p of sorted) {
    lines.push(`🍺 ${p.name}: ${p.drinks} drink${p.drinks === 1 ? '' : 's'}`);
  }
  return lines.join('\n');
}

/** Native share sheet when available; clipboard fallback. 'idle' = user cancelled or nothing worked. */
export async function shareResults(text: string): Promise<ShareOutcome> {
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ text });
      return 'shared';
    } catch {
      return 'idle';
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'idle';
  }
}
