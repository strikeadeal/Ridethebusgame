import { beforeEach, describe, expect, it, vi } from 'vitest';

const plays: string[] = [];
vi.mock('howler', () => ({
  Howl: class {
    private src: string;
    constructor({ src }: { src: string[] }) {
      this.src = src[0];
    }
    play() {
      plays.push(this.src);
    }
  },
}));

const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, String(v)),
  removeItem: (k: string) => void store.delete(k),
});

import { isMuted, play, setMuted, toggleMuted } from './sound';

beforeEach(() => {
  store.clear();
  plays.length = 0;
});

describe('sound', () => {
  it('plays the named sound file', () => {
    play('correct');
    expect(plays).toHaveLength(1);
    expect(plays[0]).toContain('sounds/correct.wav');
  });

  it('does not play while muted', () => {
    setMuted(true);
    play('wrong');
    expect(plays).toHaveLength(0);
  });

  it('toggleMuted flips and persists the preference', () => {
    expect(isMuted()).toBe(false);
    expect(toggleMuted()).toBe(true);
    expect(store.get('ridethebus:muted:v1')).toBe('1');
    expect(toggleMuted()).toBe(false);
    expect(isMuted()).toBe(false);
    expect(store.has('ridethebus:muted:v1')).toBe(false);
  });
});
