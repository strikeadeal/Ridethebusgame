import { describe, expect, it } from 'vitest';
import type { GameOverStage, GameState } from '../engine/types';
import { buildShareText } from './share';

const stage: GameOverStage = { kind: 'gameOver', riderIndex: 1, attempts: 3 };
const state: GameState = {
  seed: 1,
  rngState: 1,
  players: [
    { name: 'Amy', drinks: 4 },
    { name: 'Dave', drinks: 14 },
    { name: 'Bob', drinks: 1 },
  ],
  stage,
};

describe('buildShareText', () => {
  it('leads with the rider and attempts', () => {
    const text = buildShareText(state, stage);
    expect(text.split('\n')[0]).toBe('🚌 Ride the Bus — Dave escaped after 3 attempts');
  });

  it('lists players by drinks, descending, with singular/plural', () => {
    const lines = buildShareText(state, stage).split('\n');
    expect(lines.slice(1)).toEqual([
      '🍺 Dave: 14 drinks',
      '🍺 Amy: 4 drinks',
      '🍺 Bob: 1 drink',
    ]);
  });

  it('uses singular attempt when attempts is 1', () => {
    const text = buildShareText(state, { ...stage, attempts: 1 });
    expect(text).toContain('escaped after 1 attempt\n');
  });
});
