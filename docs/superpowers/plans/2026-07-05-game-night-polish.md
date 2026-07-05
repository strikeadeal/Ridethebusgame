# Game-Night Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the sensory polish layer — animated card flips, game sounds with a persistent mute, a confetti game-over celebration, and text-summary result sharing.

**Architecture:** All work lives in `src/ui/` and config; `src/engine/` stays untouched. Sounds are driven centrally by a pure stage-transition function (`soundForTransition`) called from one hook in `App.tsx`, so screens never call audio directly. Animations layer onto `CardView` without changing its props, CSS class names, or `data-testid`s.

**Tech Stack:** React 19, framer-motion, howler, canvas-confetti, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-05-game-night-polish-design.md`

## Global Constraints

- Target: iPhone Safari, installed PWA, offline-first — every new asset must be precached by `vite-plugin-pwa`.
- `src/engine/` must not change.
- All existing `data-testid` attributes must keep working (E2E suite depends on them).
- Respect `prefers-reduced-motion`: animations collapse to instant, confetti skipped.
- Vitest env is `node`: stub `localStorage` in tests exactly like `src/ui/storage.test.ts` does.
- Work on branch `feature/game-night-polish` (create from `main` before Task 1).
- Commands run from the repo root. Unit tests: `npx vitest run <file>`; full suites: `npm test`, `npm run test:e2e`, `npm run build`.

---

### Task 1: Dependencies + share text builder

**Files:**
- Modify: `package.json` (via npm install)
- Create: `src/ui/share.ts`
- Test: `src/ui/share.test.ts`

**Interfaces:**
- Produces: `buildShareText(state: GameState, stage: GameOverStage): string`, `shareResults(text: string): Promise<'shared' | 'copied' | 'idle'>` — Task 7 consumes both.

- [ ] **Step 1: Install dependencies**

```bash
npm install framer-motion howler canvas-confetti
npm install -D @types/howler @types/canvas-confetti
```

Expected: package.json gains the three runtime deps + two type packages.

- [ ] **Step 2: Write the failing test**

Create `src/ui/share.test.ts`:

```ts
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/ui/share.test.ts`
Expected: FAIL — cannot resolve `./share`.

- [ ] **Step 4: Implement `src/ui/share.ts`**

```ts
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
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/ui/share.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/ui/share.ts src/ui/share.test.ts
git commit -m "feat: share-text builder and polish dependencies"
```

---

### Task 2: Generated sound assets + offline precache

**Files:**
- Create: `scripts/generate-sounds.mjs`, `public/sounds/*.wav` (7 files, generated)
- Modify: `package.json` (add `sounds` script), `vite.config.ts` (workbox glob)

**Interfaces:**
- Produces: `public/sounds/{deal,flip,correct,wrong,rowAdvance,busStart,fanfare}.wav` — Task 3's `sound.ts` loads them by name.

- [ ] **Step 1: Write `scripts/generate-sounds.mjs`**

Offline synthesis (mono 16-bit PCM WAV @ 22050 Hz — license-free, small, mirrors `scripts/generate-icons.mjs`):

```js
// Synthesizes the game's sound effects as small mono WAVs into public/sounds/.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const RATE = 22050;
const OUT = path.resolve('public/sounds');

function wav(samples) {
  const pcm = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcm.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(RATE, 24);
  h.writeUInt32LE(RATE * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

const buffer = (duration) => new Float64Array(Math.floor(RATE * duration));

function addTone(buf, { freq, start = 0, dur, gain = 0.4, shape = 'sine' }) {
  const from = Math.floor(start * RATE);
  const n = Math.floor(dur * RATE);
  for (let i = 0; i < n && from + i < buf.length; i++) {
    const t = i / RATE;
    const env = Math.min(1, t * 200) * Math.exp(-4 * (t / dur)); // fast attack, exponential decay
    const phase = 2 * Math.PI * freq * t;
    const v = shape === 'triangle' ? (2 / Math.PI) * Math.asin(Math.sin(phase)) : Math.sin(phase);
    buf[from + i] += v * env * gain;
  }
}

function addNoise(buf, { start = 0, dur, gain = 0.3 }) {
  const from = Math.floor(start * RATE);
  const n = Math.floor(dur * RATE);
  let last = 0;
  for (let i = 0; i < n && from + i < buf.length; i++) {
    const env = Math.exp(-8 * (i / RATE / dur));
    last = 0.6 * last + 0.4 * (Math.random() * 2 - 1); // one-pole low-pass: paper, not static
    buf[from + i] += last * env * gain;
  }
}

const sounds = {
  // Card leaves the deck: soft paper swish.
  deal() { const b = buffer(0.12); addNoise(b, { dur: 0.12, gain: 0.5 }); return b; },
  // Pyramid card turn: short snap.
  flip() { const b = buffer(0.1); addNoise(b, { dur: 0.06, gain: 0.35 }); addTone(b, { freq: 1200, dur: 0.05, gain: 0.15 }); return b; },
  // Right guess: two-note upward chime.
  correct() { const b = buffer(0.35); addTone(b, { freq: 659, dur: 0.15, shape: 'triangle' }); addTone(b, { freq: 880, start: 0.09, dur: 0.25, shape: 'triangle' }); return b; },
  // Wrong guess: low thud.
  wrong() { const b = buffer(0.4); addTone(b, { freq: 147, dur: 0.35, gain: 0.55 }); addTone(b, { freq: 110, start: 0.02, dur: 0.35, gain: 0.35 }); return b; },
  // Entering the pyramid.
  rowAdvance() { const b = buffer(0.3); addTone(b, { freq: 523, dur: 0.22, shape: 'triangle' }); return b; },
  // The bus rider is revealed: three rising notes.
  busStart() { const b = buffer(0.55); addTone(b, { freq: 392, dur: 0.16 }); addTone(b, { freq: 494, start: 0.14, dur: 0.16 }); addTone(b, { freq: 587, start: 0.28, dur: 0.25 }); return b; },
  // Game over: short arpeggio.
  fanfare() { const b = buffer(1.0); [440, 554, 659, 880].forEach((f, i) => addTone(b, { freq: f, start: i * 0.13, dur: 0.5, gain: 0.35, shape: 'triangle' })); return b; },
};

mkdirSync(OUT, { recursive: true });
for (const [name, make] of Object.entries(sounds)) {
  writeFileSync(path.join(OUT, `${name}.wav`), wav(make()));
  console.log(`wrote public/sounds/${name}.wav`);
}
```

- [ ] **Step 2: Add npm script**

In `package.json` scripts, after `"icons"`:

```json
"sounds": "node scripts/generate-sounds.mjs"
```

- [ ] **Step 3: Generate and sanity-check**

Run: `npm run sounds && ls -la public/sounds`
Expected: 7 `.wav` files, each roughly 5–45 KB. Optional listen: `afplay public/sounds/correct.wav`.

- [ ] **Step 4: Precache WAVs offline**

In `vite.config.ts`, change the workbox line to:

```ts
workbox: { globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,wav}'] },
```

- [ ] **Step 5: Verify build picks them up**

Run: `npm run build`
Expected: build succeeds; `dist/sw.js` precache manifest references `sounds/…wav` (check with `grep -o 'sounds/[a-zA-Z]*' dist/sw.js | sort -u` → 7 names).

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-sounds.mjs public/sounds package.json vite.config.ts
git commit -m "feat: synthesized sound assets, precached offline"
```

---

### Task 3: Sound module with persistent mute

**Files:**
- Create: `src/ui/sound.ts`
- Test: `src/ui/sound.test.ts`

**Interfaces:**
- Consumes: `public/sounds/<name>.wav` from Task 2.
- Produces: `type SoundName = 'deal' | 'flip' | 'correct' | 'wrong' | 'rowAdvance' | 'busStart' | 'fanfare'`; `play(name: SoundName): void`; `isMuted(): boolean`; `toggleMuted(): boolean` (returns new muted state). Tasks 4, 5 consume these.

- [ ] **Step 1: Write the failing test**

Create `src/ui/sound.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/sound.test.ts`
Expected: FAIL — cannot resolve `./sound`.

- [ ] **Step 3: Implement `src/ui/sound.ts`**

```ts
import { Howl } from 'howler';

export type SoundName =
  | 'deal'
  | 'flip'
  | 'correct'
  | 'wrong'
  | 'rowAdvance'
  | 'busStart'
  | 'fanfare';

const KEY = 'ridethebus:muted:v1';
const howls = new Map<SoundName, Howl>();

export function isMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setMuted(muted: boolean): void {
  try {
    if (muted) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {
    // Preference is best-effort, like game saves.
  }
}

export function toggleMuted(): boolean {
  const next = !isMuted();
  setMuted(next);
  return next;
}

export function play(name: SoundName): void {
  if (isMuted()) return;
  let howl = howls.get(name);
  if (!howl) {
    howl = new Howl({ src: [`${import.meta.env.BASE_URL}sounds/${name}.wav`] });
    howls.set(name, howl);
  }
  howl.play();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/sound.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/sound.ts src/ui/sound.test.ts
git commit -m "feat: howler sound module with persistent mute"
```

---

### Task 4: Stage-transition sound mapping + hook

**Files:**
- Create: `src/ui/gameSounds.ts`
- Test: `src/ui/gameSounds.test.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `play`, `SoundName` from `src/ui/sound.ts` (Task 3); `Stage`, `GameState` from `src/engine/types.ts`.
- Produces: `soundForTransition(prev: Stage, next: Stage): SoundName | null` (pure); `useGameSounds(state: GameState): void` hook used by `App.tsx`.

- [ ] **Step 1: Write the failing test**

Create `src/ui/gameSounds.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Stage } from '../engine/types';
import { soundForTransition } from './gameSounds';

const idle: Stage = { kind: 'idle' };
const phase1 = (feedback: { correct: boolean } | null): Stage => ({
  kind: 'phase1',
  hands: [[]],
  questionIndex: 0,
  playerIndex: 0,
  feedback: feedback ? { correct: feedback.correct, card: { rank: 2, suit: 'hearts' } } : null,
});
const phase2 = (flipped: number): Stage => ({
  kind: 'phase2',
  pyramid: [],
  flipped,
  hands: [[]],
  matchQueue: [],
});
const phase3 = (attempts: number, feedback: { correct: boolean } | null): Stage => ({
  kind: 'phase3',
  riderIndex: 0,
  cards: [],
  position: 0,
  attempts,
  deck: [],
  feedback: feedback ? { correct: feedback.correct, card: { rank: 2, suit: 'hearts' } } : null,
});

describe('soundForTransition', () => {
  it('deals when a game starts', () => {
    expect(soundForTransition(idle, phase1(null))).toBe('deal');
  });
  it('chimes or thuds when phase1 feedback lands', () => {
    expect(soundForTransition(phase1(null), phase1({ correct: true }))).toBe('correct');
    expect(soundForTransition(phase1(null), phase1({ correct: false }))).toBe('wrong');
  });
  it('flips when a pyramid card turns', () => {
    expect(soundForTransition(phase2(3), phase2(4))).toBe('flip');
  });
  it('announces phase changes', () => {
    expect(soundForTransition(phase1(null), phase2(0))).toBe('rowAdvance');
    expect(soundForTransition(phase2(10), { kind: 'busReveal', riderIndex: 0 })).toBe('busStart');
    expect(soundForTransition({ kind: 'busReveal', riderIndex: 0 }, phase3(1, null))).toBe('deal');
    expect(soundForTransition(phase3(1, null), { kind: 'gameOver', riderIndex: 0, attempts: 1 })).toBe('fanfare');
  });
  it('deals again on a failed bus attempt redeal', () => {
    expect(soundForTransition(phase3(1, { correct: false }), phase3(2, null))).toBe('deal');
  });
  it('is silent when nothing notable changed', () => {
    expect(soundForTransition(phase2(4), phase2(4))).toBeNull();
    expect(soundForTransition(idle, idle)).toBeNull();
    expect(soundForTransition(phase1({ correct: true }), phase1(null))).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/gameSounds.test.ts`
Expected: FAIL — cannot resolve `./gameSounds`.

- [ ] **Step 3: Implement `src/ui/gameSounds.ts`**

```ts
import { useEffect, useRef } from 'react';
import type { GameState, Stage } from '../engine/types';
import { play, type SoundName } from './sound';

/** Pure mapping from a stage transition to the sound it should make. */
export function soundForTransition(prev: Stage, next: Stage): SoundName | null {
  if (prev.kind !== next.kind) {
    switch (next.kind) {
      case 'phase1':
      case 'phase3':
        return 'deal';
      case 'phase2':
        return 'rowAdvance';
      case 'busReveal':
        return 'busStart';
      case 'gameOver':
        return 'fanfare';
      default:
        return null;
    }
  }
  if (prev.kind === 'phase1' && next.kind === 'phase1' && !prev.feedback && next.feedback) {
    return next.feedback.correct ? 'correct' : 'wrong';
  }
  if (prev.kind === 'phase3' && next.kind === 'phase3') {
    if (next.attempts > prev.attempts) return 'deal';
    if (!prev.feedback && next.feedback) return next.feedback.correct ? 'correct' : 'wrong';
  }
  if (prev.kind === 'phase2' && next.kind === 'phase2' && next.flipped > prev.flipped) {
    return 'flip';
  }
  return null;
}

/** Watches stage transitions and plays the matching sound. Mount once, in App. */
export function useGameSounds(state: GameState): void {
  const prev = useRef(state.stage);
  useEffect(() => {
    const sound = soundForTransition(prev.current, state.stage);
    prev.current = state.stage;
    if (sound) play(sound);
  }, [state.stage]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/gameSounds.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Wire into App**

In `src/App.tsx`: add `import { useGameSounds } from './ui/gameSounds';` and call `useGameSounds(state);` directly after the `useWakeLock(...)` line.

- [ ] **Step 6: Full unit suite + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all tests pass, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/ui/gameSounds.ts src/ui/gameSounds.test.ts src/App.tsx
git commit -m "feat: stage-transition game sounds"
```

---

### Task 5: Mute toggle UI

**Files:**
- Create: `src/ui/components/SoundToggle.tsx`
- Modify: `src/ui/components/Scoreboard.tsx`, `src/ui/screens/HomeScreen.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `isMuted`, `toggleMuted` from `src/ui/sound.ts` (Task 3).
- Produces: `<SoundToggle />` with `data-testid="sound-toggle"` and `aria-label` of `Mute sounds` / `Unmute sounds` — Task 8's E2E test depends on both.

- [ ] **Step 1: Create `src/ui/components/SoundToggle.tsx`**

```tsx
import { useState } from 'react';
import { isMuted, toggleMuted } from '../sound';

const SpeakerOn = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" />
  </svg>
);

const SpeakerOff = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" />
    <path d="m16 9 5 6M21 9l-5 6" />
  </svg>
);

export function SoundToggle() {
  const [muted, setMutedState] = useState(isMuted);
  return (
    <button
      className="btn-icon"
      data-testid="sound-toggle"
      aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
      onClick={() => setMutedState(toggleMuted())}
    >
      {muted ? SpeakerOff : SpeakerOn}
    </button>
  );
}
```

- [ ] **Step 2: Render it during play and on the home screen**

`src/ui/components/Scoreboard.tsx` — add the import and render after the player scores:

```tsx
import type { Player } from '../../engine/types';
import { SoundToggle } from './SoundToggle';

export function Scoreboard({ players }: { players: Player[] }) {
  return (
    <div className="scoreboard">
      {players.map((p, i) => (
        <div key={i} className="score">
          <span className="score-name">{p.name}</span>
          <span className="score-drinks" data-testid={`scoreboard-drinks-${i}`}>
            {p.drinks}
          </span>
        </div>
      ))}
      <SoundToggle />
    </div>
  );
}
```

`src/ui/screens/HomeScreen.tsx` — add `import { SoundToggle } from '../components/SoundToggle';` and render `<div className="home-corner"><SoundToggle /></div>` as the first child inside `<div className="screen center">`.

- [ ] **Step 3: Style it**

Append to `src/styles.css` (near `.btn-ghost`, line ~184):

```css
.btn-icon {
  appearance: none;
  background: none;
  border: 1px solid var(--card-edge);
  border-radius: 50%;
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: inherit;
  opacity: 0.75;
  padding: 0;
}
.home-corner {
  position: absolute;
  top: calc(env(safe-area-inset-top, 0px) + 14px);
  right: 14px;
}
```

(If `.screen.center` is not `position: relative`, add `position: relative;` to it.)

- [ ] **Step 4: Verify by hand**

Run: `npm run dev`, open `http://localhost:5173/Ridethebusgame/`.
Expected: speaker icon top-right on home; toggling flips the icon; reload keeps the choice; during a game the icon sits in the scoreboard row and sounds actually stop when muted.

- [ ] **Step 5: Commit**

```bash
git add src/ui/components/SoundToggle.tsx src/ui/components/Scoreboard.tsx src/ui/screens/HomeScreen.tsx src/styles.css
git commit -m "feat: mute toggle in scoreboard and home screen"
```

---

### Task 6: Animated card flips (framer-motion)

**Files:**
- Modify: `src/ui/components/CardView.tsx`, `src/styles.css`, `playwright.config.ts`, `src/ui/screens/Phase1Screen.tsx`, `src/ui/screens/BusScreen.tsx`, `src/ui/screens/PyramidScreen.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `CardView` keeps all existing props (`card`, `faceDown`, `small`, `glow`, `onClick`, `testId`) and gains optional `dealDelay?: number` (seconds; staggers the mount deal-in). `data-testid` stays on the `<button>`.

- [ ] **Step 1: Rewrite `src/ui/components/CardView.tsx`**

Two-faced 3D flip. The button becomes a transparent "scene"; the ivory card styling moves to inner face spans that keep the existing class names:

```tsx
import { motion, useReducedMotion } from 'framer-motion';
import { isRed } from '../../engine/rules';
import type { Card } from '../../engine/types';
import { rankLabel, SUIT_GLYPH } from '../labels';

interface Props {
  card?: Card;
  faceDown?: boolean;
  small?: boolean;
  glow?: boolean;
  onClick?: () => void;
  testId?: string;
  /** Seconds to delay the mount deal-in; pass index * 0.05 to stagger a row. */
  dealDelay?: number;
}

export function CardView({
  card,
  faceDown = false,
  small = false,
  glow = false,
  onClick,
  testId,
  dealDelay = 0,
}: Props) {
  const reduced = useReducedMotion();
  const face = !faceDown && card !== undefined ? card : null;
  const faceCls = (...extra: (string | false | null)[]) =>
    ['card', small && 'card-small', glow && 'card-glow', ...extra].filter(Boolean).join(' ');
  return (
    <motion.button
      className={small ? 'card-scene card-scene-small' : 'card-scene'}
      onClick={onClick}
      disabled={!onClick}
      data-testid={testId}
      initial={reduced ? false : { y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 26, delay: dealDelay }}
      whileTap={onClick && !reduced ? { scale: 0.94 } : undefined}
    >
      <motion.span
        className="card-flipper"
        initial={false}
        animate={{ rotateY: face ? 0 : 180 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 24 }}
      >
        <span className={faceCls(face && (isRed(face) ? 'card-red' : 'card-black'))}>
          {face && (
            <>
              <span className="card-index">
                {rankLabel(face.rank)}
                <span className="card-index-suit">{SUIT_GLYPH[face.suit]}</span>
              </span>
              <span className="card-pip">{SUIT_GLYPH[face.suit]}</span>
              <span className="card-index card-index-br" aria-hidden="true">
                {rankLabel(face.rank)}
                <span className="card-index-suit">{SUIT_GLYPH[face.suit]}</span>
              </span>
            </>
          )}
        </span>
        <span className={faceCls('card-down', 'card-back-face')} />
      </motion.span>
    </motion.button>
  );
}
```

Face content still renders only when face-up, so hidden cards never leak into the DOM (same as today).

- [ ] **Step 2: Stagger the deal-in where cards mount as a row**

Pass `dealDelay={i * 0.05}` to the `CardView`s rendered in a loop:
- `src/ui/screens/Phase1Screen.tsx` — the `hand.map((card, i) => …)` inside `.card-row`.
- `src/ui/screens/BusScreen.tsx` — the `stage.cards.map((card, i) => …)` inside `.card-row` (the `key={`${stage.attempts}-${i}`}` already remounts the row on redeals, so each new attempt re-deals visually).
- `src/ui/screens/PyramidScreen.tsx` — in the `ROWS.map` loop, pass `dealDelay={i * 0.05}` on the pyramid `CardView` (uses the pyramid index `i` already in scope).

No other changes to those files.

- [ ] **Step 3: Update `src/styles.css`**

Add the scene/flipper rules right above the existing `.card {` block (~line 210):

```css
.card-scene {
  appearance: none;
  background: none;
  border: none;
  padding: 0;
  width: 72px;
  height: 104px;
  perspective: 600px;
}
.card-scene:disabled { opacity: 1; }
.card-scene-small { width: 44px; height: 64px; }
.card-flipper {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
}
.card-flipper .card {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}
.card-back-face { transform: rotateY(180deg); }
```

Then three small edits to existing rules:
1. `.card-red` and `.card-black` (~lines 253–254): delete `animation: flip 0.4s ease;` from both (framer-motion replaces the CSS flip). Delete the now-unused `@keyframes flip` block if nothing else references it (`grep -n "flip" src/styles.css` to confirm).
2. Delete the obsolete `.card:disabled { opacity: 1; }` rule (~line 227) — `.card` is no longer a button.
3. `.card-small` keeps its size rule (the face span still uses it), no change needed.

- [ ] **Step 4: Stabilize E2E under animation**

In `playwright.config.ts`, add reduced motion to shared options so tests stay instant and deterministic:

```ts
use: {
  baseURL: 'http://localhost:4173/Ridethebusgame/',
  contextOptions: { reducedMotion: 'reduce' },
},
```

- [ ] **Step 5: Verify visually and with the full suites**

Run: `npm run dev` — play a hand: cards should 3D-flip on reveal (phase 1, pyramid taps, bus), tappable pyramid cards shrink on press, glow ring shows on the next pyramid card while face-down.
Run: `npx tsc --noEmit && npm test && npm run test:e2e`
Expected: everything passes — the E2E suite is the regression gate for the CardView restructure.

- [ ] **Step 6: Commit**

```bash
git add src/ui/components/CardView.tsx src/styles.css playwright.config.ts src/ui/screens/Phase1Screen.tsx src/ui/screens/BusScreen.tsx src/ui/screens/PyramidScreen.tsx
git commit -m "feat: 3D card flip, deal-in stagger, and tap animations"
```

---

### Task 7: Game-over celebration + share button

**Files:**
- Modify: `src/ui/screens/GameOverScreen.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `buildShareText`, `shareResults`, `ShareOutcome` from `src/ui/share.ts` (Task 1); `canvas-confetti`; framer-motion. Fanfare sound already fires via `useGameSounds` (Task 4) — do not play it here.
- Produces: `data-testid="gameover-share"` button — Task 8's E2E depends on it and on its `Copied!` label after fallback.

- [ ] **Step 1: Rewrite `src/ui/screens/GameOverScreen.tsx`**

```tsx
import confetti from 'canvas-confetti';
import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { GameOverStage, GameState } from '../../engine/types';
import { buildShareText, shareResults, type ShareOutcome } from '../share';
import { DrinkIcon } from '../components/icons';

// Felt-table palette: gold, ivory, brass — never rainbow.
const CONFETTI_COLORS = ['#d4af5f', '#f3e9d2', '#8c6a2f', '#f6f1e3'];

const row = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

interface Props {
  state: GameState;
  stage: GameOverStage;
  onPlayAgain: () => void;
  onNewGame: () => void;
}

export function GameOverScreen({ state, stage, onPlayAgain, onNewGame }: Props) {
  const reduced = useReducedMotion();
  const [shared, setShared] = useState<ShareOutcome>('idle');
  useEffect(() => {
    if (reduced) return;
    confetti({
      particleCount: 120,
      spread: 75,
      origin: { y: 0.35 },
      colors: CONFETTI_COLORS,
      disableForReducedMotion: true,
    });
  }, [reduced]);

  const sorted = state.players
    .map((p, i) => ({ ...p, i }))
    .sort((a, b) => b.drinks - a.drinks);
  return (
    <div className="screen center">
      <h1 className="logo">GAME OVER</h1>
      <p className="question">
        {state.players[stage.riderIndex].name} escaped the bus after {stage.attempts} attempt
        {stage.attempts === 1 ? '' : 's'}
      </p>
      <motion.div
        className="final-board"
        data-testid="gameover-scoreboard"
        initial={reduced ? false : 'hidden'}
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.08 } } }}
      >
        {sorted.map((p, rank) => (
          <motion.div key={p.i} className={rank === 0 ? 'score score-top' : 'score'} variants={row}>
            <span className="score-name">{p.name}</span>
            <span className="score-drinks">
              {p.drinks} <DrinkIcon />
            </span>
          </motion.div>
        ))}
      </motion.div>
      <button
        className="btn"
        data-testid="gameover-share"
        onClick={async () => setShared(await shareResults(buildShareText(state, stage)))}
      >
        {shared === 'copied' ? 'Copied!' : shared === 'shared' ? 'Shared!' : 'Share results'}
      </button>
      <button className="btn btn-primary" data-testid="gameover-again" onClick={onPlayAgain}>
        Play again
      </button>
      <button className="btn" data-testid="gameover-new" onClick={onNewGame}>
        New game
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify by hand**

Run: `npm run dev`, finish a quick 2-player game (or temporarily jump there by pasting a `gameOver` save into localStorage key `ridethebus:save:v1` — see the shape in `src/ui/storage.test.ts` — then Resume).
Expected: gold/ivory confetti burst once on entry, scoreboard rows stagger in, top row highlighted, Share opens the sheet (Safari) or flips to “Copied!” (desktop Chrome without `navigator.share`).

- [ ] **Step 3: Typecheck + unit tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/ui/screens/GameOverScreen.tsx
git commit -m "feat: confetti game-over with staggered board and share button"
```

---

### Task 8: E2E coverage + full verification

**Files:**
- Create: `e2e/polish.spec.ts`
- Modify: `e2e/fullGame.spec.ts` (share assertion at game over)

**Interfaces:**
- Consumes: `data-testid="sound-toggle"` + aria-labels (Task 5), `data-testid="gameover-share"` + `Copied!` label (Task 7).

- [ ] **Step 1: Write `e2e/polish.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

test('mute preference persists across reload', async ({ page }) => {
  await page.goto('./');
  const toggle = page.getByTestId('sound-toggle');
  await expect(toggle).toHaveAttribute('aria-label', 'Mute sounds');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-label', 'Unmute sounds');
  await page.reload();
  await expect(page.getByTestId('sound-toggle')).toHaveAttribute('aria-label', 'Unmute sounds');
});
```

- [ ] **Step 2: Add the share assertion to the full-game spec**

In `e2e/fullGame.spec.ts`, at the top of the full-game test (before the first `page.goto`), force the clipboard fallback so the share sheet never opens headlessly:

```ts
await page.addInitScript(() => {
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: async () => {} },
    configurable: true,
  });
});
```

Then, after the existing game-over assertions (where `gameover-scoreboard` is checked), append:

```ts
await page.getByTestId('gameover-share').click();
await expect(page.getByTestId('gameover-share')).toHaveText('Copied!');
```

- [ ] **Step 3: Run the E2E suite**

Run: `npm run test:e2e`
Expected: all specs pass on both projects (iphone-webkit and chromium-pwa @offline).

- [ ] **Step 4: Full verification**

Run: `npm test && npx tsc --noEmit && npm run build && npm run test:e2e`
Expected: everything green. This is the deploy gate — the Pages workflow runs the same suites.

- [ ] **Step 5: Commit**

```bash
git add e2e/polish.spec.ts e2e/fullGame.spec.ts
git commit -m "test: e2e for mute persistence and share fallback"
```

---

## Final step

Use superpowers:finishing-a-development-branch — verify the full suite one more time, then merge `feature/game-night-polish` (or open a PR; pushing to `main` triggers the test-gated Pages deploy).
