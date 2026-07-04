import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '../engine/types';
import { clearSave, loadGame, saveGame } from './storage';

const store = new Map<string, string>();

vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
});

const inProgress: GameState = {
  seed: 7,
  rngState: 123,
  players: [
    { name: 'Amy', drinks: 2 },
    { name: 'Bob', drinks: 1 },
  ],
  stage: { kind: 'busReveal', riderIndex: 0 },
};

beforeEach(() => store.clear());

describe('storage', () => {
  it('round-trips an in-progress game', () => {
    saveGame(inProgress);
    expect(loadGame()).toEqual(inProgress);
  });

  it('removes the save when the game is idle or over', () => {
    saveGame(inProgress);
    saveGame({ ...inProgress, stage: { kind: 'gameOver', riderIndex: 0, attempts: 2 } });
    expect(loadGame()).toBeNull();
    saveGame(inProgress);
    saveGame({ ...inProgress, stage: { kind: 'idle' } });
    expect(loadGame()).toBeNull();
  });

  it('returns null for corrupt or invalid payloads', () => {
    store.set('ridethebus:save:v1', 'not json {');
    expect(loadGame()).toBeNull();
    store.set('ridethebus:save:v1', JSON.stringify({ hello: 'world' }));
    expect(loadGame()).toBeNull();
    store.set('ridethebus:save:v1', JSON.stringify({ ...inProgress, stage: { kind: 'bogus' } }));
    expect(loadGame()).toBeNull();
  });

  it('clearSave removes the save', () => {
    saveGame(inProgress);
    clearSave();
    expect(loadGame()).toBeNull();
  });
});
