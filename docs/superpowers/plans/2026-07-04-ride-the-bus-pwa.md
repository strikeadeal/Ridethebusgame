# Ride the Bus PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pass-and-play Ride the Bus drinking-game PWA on GitHub Pages, verified by unit tests and Playwright WebKit E2E.

**Architecture:** A pure TypeScript rules engine (immutable `GameState` + `reduce(state, action)`, seeded PRNG) with a React 19 view layer that can only dispatch engine actions. State persists to localStorage after every action. Static build via Vite, offline via vite-plugin-pwa, deployed by GitHub Actions.

**Tech Stack:** React 19, TypeScript (strict), Vite 7, vite-plugin-pwa, Vitest, @playwright/test (WebKit + Chromium), sharp (icon generation only).

**Spec:** `docs/superpowers/specs/2026-07-04-ride-the-bus-pwa-design.md`

## Global Constraints

- Vite `base` is `'/Ridethebusgame/'` — the GitHub repo MUST be named `Ridethebusgame`.
- `src/engine/` must never import React, DOM APIs, `Date`, or `Math.random` — all randomness flows through the seeded PRNG in `src/engine/rng.ts`.
- 2–8 players. Ace is high (rank 14). Ties count as wrong guesses.
- Pyramid: 10 cards, rows of 4-3-2-1 flipped bottom-up; row drink values 1/2/3/4.
- Hand sizes: 2–4 players → 5 cards; 5–6 → 4; 7–8 → 3.
- Bus rider = most total drinks, ties broken via seeded RNG. Wrong bus guess = +1 drink, 4 fresh cards, back to question 1.
- Invalid actions return the state object unchanged (reference-equal) — this is the "rejected" signal.
- `?seed=` URL parameter fixes the seed in ALL builds (undocumented; E2E depends on it).
- Unit tests: `npm test` (Vitest, node env). E2E: `npm run test:e2e` (Playwright against the production build via `vite preview`). Build: `npm run build` (runs `tsc --noEmit` first).
- Node 22 in CI. Commit after every task.

## File Structure

```
package.json, tsconfig.json, vite.config.ts, index.html, playwright.config.ts, .gitignore
.github/workflows/deploy.yml         — test + build + deploy to Pages
scripts/generate-icons.mjs           — one-shot PNG icon generation (sharp)
public/                              — generated icons (committed)
src/main.tsx                         — React root + SW registration
src/App.tsx                          — screen routing, useReducer, persistence wiring
src/styles.css                       — neon theme (single stylesheet)
src/engine/types.ts                  — Card, Player, Stage, GameState, Action
src/engine/rng.ts                    — mulberry32 PRNG, shuffle, randomInt
src/engine/deck.ts                   — fullDeck, handSizeFor
src/engine/rules.ts                  — the four guess evaluators
src/engine/engine.ts                 — createInitialState, reduce (the whole game)
src/engine/*.test.ts                 — Vitest suites colocated with modules
src/ui/storage.ts                    — localStorage save/load/clear (+ test)
src/ui/seed.ts                       — newSeed() from URL param or random
src/ui/wakeLock.ts                   — useWakeLock hook
src/ui/labels.ts                     — answer/question/rank/suit display strings
src/ui/components/CardView.tsx       — one playing card (face up/down/glow)
src/ui/components/Scoreboard.tsx     — persistent drink-tally bar
src/ui/components/PlayerPicker.tsx   — "who drinks?" overlay
src/ui/screens/HomeScreen.tsx        — logo, New/Resume, rules cheatsheet
src/ui/screens/SetupScreen.tsx       — player name entry
src/ui/screens/Phase1Screen.tsx      — four questions
src/ui/screens/PyramidScreen.tsx     — pyramid + hands + match assignment
src/ui/screens/BusRevealScreen.tsx   — rider announcement
src/ui/screens/BusScreen.tsx         — ride the bus
src/ui/screens/GameOverScreen.tsx    — final board
e2e/helpers.ts                       — engine-mirror helper (bestAnswer)
e2e/fullGame.spec.ts                 — lockstep full-game verification
e2e/resume.spec.ts                   — reload + resume
e2e/pwa.spec.ts                      — manifest + offline
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `.gitignore`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/vite-env.d.ts`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: nothing.
- Produces: `App` (React component, placeholder); npm scripts `dev`, `build`, `preview`, `test`, `test:e2e`, `icons` that every later task uses.

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "ridethebusgame",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "icons": "node scripts/generate-icons.mjs"
  },
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.54.0",
    "@types/node": "^24.0.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^5.0.0",
    "sharp": "^0.34.0",
    "typescript": "^5.9.0",
    "vite": "^7.0.0",
    "vite-plugin-pwa": "^1.0.0",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 2: Write `.gitignore`**

```
node_modules/
dist/
dev-dist/
test-results/
playwright-report/
.DS_Store
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "e2e", "playwright.config.ts", "vite.config.ts"]
}
```

- [ ] **Step 4: Write `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Ridethebusgame/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 5: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover, user-scalable=no" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="theme-color" content="#0a0a14" />
    <link rel="apple-touch-icon" href="%BASE_URL%apple-touch-icon.png" />
    <title>Ride the Bus</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

(The `apple-touch-icon` file is generated in Task 15; a 404 until then is harmless.)

- [ ] **Step 6: Write `src/vite-env.d.ts`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`**

`src/vite-env.d.ts`:
```ts
/// <reference types="vite/client" />
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx` (placeholder, replaced in Task 14):
```tsx
export function App() {
  return <h1>Ride the Bus</h1>;
}
```

`src/styles.css` (placeholder, replaced in Task 9):
```css
body {
  background: #0a0a14;
  color: #f2f2fa;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

- [ ] **Step 7: Install and verify**

Run: `npm install`
Expected: completes without errors, creates `package-lock.json`.

Run: `npm test`
Expected: exits 0 with "No test files found" (passWithNoTests).

Run: `npm run build`
Expected: `tsc` clean, Vite writes `dist/index.html` and assets.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold React + Vite + TypeScript project"
```

---

### Task 2: Seeded RNG

**Files:**
- Create: `src/engine/rng.ts`
- Test: `src/engine/rng.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `next(state: number): { value: number; state: number }` — mulberry32 step, value in [0,1).
  - `shuffle<T>(items: readonly T[], rngState: number): { items: T[]; rngState: number }` — Fisher-Yates, does not mutate input.
  - `randomInt(maxExclusive: number, rngState: number): { value: number; rngState: number }`.

- [ ] **Step 1: Write the failing test `src/engine/rng.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { next, randomInt, shuffle } from './rng';

describe('next', () => {
  it('is deterministic for a given state', () => {
    expect(next(42)).toEqual(next(42));
  });

  it('returns values in [0, 1) and advances state', () => {
    let state = 1;
    for (let i = 0; i < 1000; i++) {
      const r = next(state);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(1);
      expect(r.state).not.toBe(state);
      state = r.state;
    }
  });
});

describe('shuffle', () => {
  const input = Array.from({ length: 52 }, (_, i) => i);

  it('returns a permutation of the input', () => {
    const { items } = shuffle(input, 7);
    expect([...items].sort((a, b) => a - b)).toEqual(input);
    expect(items).not.toEqual(input);
  });

  it('is reproducible and does not mutate the input', () => {
    const copy = input.slice();
    const a = shuffle(input, 7);
    const b = shuffle(input, 7);
    expect(a).toEqual(b);
    expect(input).toEqual(copy);
  });

  it('advances the rng state', () => {
    expect(shuffle(input, 7).rngState).not.toBe(7);
  });

  it('produces different orders for different states', () => {
    expect(shuffle(input, 1).items).not.toEqual(shuffle(input, 2).items);
  });
});

describe('randomInt', () => {
  it('stays within [0, maxExclusive)', () => {
    let state = 3;
    for (let i = 0; i < 200; i++) {
      const r = randomInt(5, state);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(5);
      state = r.rngState;
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/rng.test.ts`
Expected: FAIL — cannot resolve `./rng`.

- [ ] **Step 3: Write `src/engine/rng.ts`**

```ts
/** Mulberry32 PRNG. Pure: callers thread the returned state through. */
export function next(state: number): { value: number; state: number } {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: s };
}

export function shuffle<T>(items: readonly T[], rngState: number): { items: T[]; rngState: number } {
  const out = items.slice();
  let state = rngState;
  for (let i = out.length - 1; i > 0; i--) {
    const r = next(state);
    state = r.state;
    const j = Math.floor(r.value * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return { items: out, rngState: state };
}

export function randomInt(maxExclusive: number, rngState: number): { value: number; rngState: number } {
  const r = next(rngState);
  return { value: Math.floor(r.value * maxExclusive), rngState: r.state };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/rng.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/rng.ts src/engine/rng.test.ts
git commit -m "feat: seeded mulberry32 rng with pure shuffle and randomInt"
```

---

### Task 3: Types and deck

**Files:**
- Create: `src/engine/types.ts`, `src/engine/deck.ts`
- Test: `src/engine/deck.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces (types used by every later task):
  - `Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'`; `Card { rank: number; suit: Suit }` (rank 2–14, 14 = Ace); `Player { name: string; drinks: number }`.
  - `GuessAnswer = 'red'|'black'|'higher'|'lower'|'inside'|'outside'|Suit`.
  - `Feedback { correct: boolean; card: Card }`; `PendingMatch { playerIndex: number; drinks: number }`.
  - `Stage` discriminated union (`idle`/`phase1`/`phase2`/`busReveal`/`phase3`/`gameOver`) + per-kind aliases `Phase1Stage`, `Phase2Stage`, `BusRevealStage`, `Phase3Stage`, `GameOverStage`.
  - `GameState { seed: number; rngState: number; players: Player[]; stage: Stage }`; `Action` union.
  - `SUITS: readonly Suit[]`; `fullDeck(): Card[]`; `handSizeFor(playerCount: number): number`.

- [ ] **Step 1: Write `src/engine/types.ts`** (types only — no test of its own)

```ts
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
```

- [ ] **Step 2: Write the failing test `src/engine/deck.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { fullDeck, handSizeFor, SUITS } from './deck';

describe('fullDeck', () => {
  it('has 52 unique cards', () => {
    const deck = fullDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((c) => `${c.rank}-${c.suit}`)).size).toBe(52);
  });

  it('has 13 ranks (2-14) in each of 4 suits', () => {
    const deck = fullDeck();
    for (const suit of SUITS) {
      const ranks = deck.filter((c) => c.suit === suit).map((c) => c.rank);
      expect([...ranks].sort((a, b) => a - b)).toEqual(
        Array.from({ length: 13 }, (_, i) => i + 2),
      );
    }
  });
});

describe('handSizeFor', () => {
  it('follows the spec table', () => {
    expect(handSizeFor(2)).toBe(5);
    expect(handSizeFor(3)).toBe(5);
    expect(handSizeFor(4)).toBe(5);
    expect(handSizeFor(5)).toBe(4);
    expect(handSizeFor(6)).toBe(4);
    expect(handSizeFor(7)).toBe(3);
    expect(handSizeFor(8)).toBe(3);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/engine/deck.test.ts`
Expected: FAIL — cannot resolve `./deck`.

- [ ] **Step 4: Write `src/engine/deck.ts`**

```ts
import type { Card, Suit } from './types';

export const SUITS: readonly Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];

export function fullDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}

/** 2-4 players: 5 cards; 5-6: 4; 7-8: 3. Always fits: 10 + 8*3 = 34 <= 52. */
export function handSizeFor(playerCount: number): number {
  if (playerCount <= 4) return 5;
  if (playerCount <= 6) return 4;
  return 3;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/engine/deck.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts src/engine/deck.ts src/engine/deck.test.ts
git commit -m "feat: game types and 52-card deck with hand-size table"
```

---

### Task 4: Guess rules

**Files:**
- Create: `src/engine/rules.ts`
- Test: `src/engine/rules.test.ts`

**Interfaces:**
- Consumes: `Card`, `Suit` from `./types`.
- Produces:
  - `isRed(card: Card): boolean`
  - `evalRedBlack(answer: 'red' | 'black', card: Card): boolean`
  - `evalHigherLower(answer: 'higher' | 'lower', first: Card, second: Card): boolean` — rank tie is always wrong.
  - `evalInsideOutside(answer: 'inside' | 'outside', first: Card, second: Card, third: Card): boolean` — equal to either boundary is always wrong.
  - `evalSuit(answer: Suit, card: Card): boolean`

- [ ] **Step 1: Write the failing test `src/engine/rules.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { evalHigherLower, evalInsideOutside, evalRedBlack, evalSuit, isRed } from './rules';
import type { Card, Suit } from './types';

const C = (rank: number, suit: Suit): Card => ({ rank, suit });

describe('isRed', () => {
  it('hearts and diamonds are red; clubs and spades are not', () => {
    expect(isRed(C(2, 'hearts'))).toBe(true);
    expect(isRed(C(2, 'diamonds'))).toBe(true);
    expect(isRed(C(2, 'clubs'))).toBe(false);
    expect(isRed(C(2, 'spades'))).toBe(false);
  });
});

describe('evalRedBlack', () => {
  it('matches answer to card color', () => {
    expect(evalRedBlack('red', C(5, 'hearts'))).toBe(true);
    expect(evalRedBlack('black', C(5, 'hearts'))).toBe(false);
    expect(evalRedBlack('black', C(5, 'spades'))).toBe(true);
    expect(evalRedBlack('red', C(5, 'spades'))).toBe(false);
  });
});

describe('evalHigherLower', () => {
  it('compares second card rank to first', () => {
    expect(evalHigherLower('higher', C(5, 'hearts'), C(9, 'clubs'))).toBe(true);
    expect(evalHigherLower('lower', C(5, 'hearts'), C(9, 'clubs'))).toBe(false);
    expect(evalHigherLower('lower', C(9, 'hearts'), C(5, 'clubs'))).toBe(true);
  });

  it('treats ace as high', () => {
    expect(evalHigherLower('higher', C(13, 'hearts'), C(14, 'clubs'))).toBe(true);
  });

  it('rank tie is wrong for both answers', () => {
    expect(evalHigherLower('higher', C(7, 'hearts'), C(7, 'clubs'))).toBe(false);
    expect(evalHigherLower('lower', C(7, 'hearts'), C(7, 'clubs'))).toBe(false);
  });
});

describe('evalInsideOutside', () => {
  const first = C(5, 'hearts');
  const second = C(10, 'clubs');

  it('inside means strictly between the two ranks (order-independent)', () => {
    expect(evalInsideOutside('inside', first, second, C(7, 'spades'))).toBe(true);
    expect(evalInsideOutside('outside', first, second, C(7, 'spades'))).toBe(false);
    expect(evalInsideOutside('inside', second, first, C(7, 'spades'))).toBe(true);
  });

  it('outside means strictly above or below the range', () => {
    expect(evalInsideOutside('outside', first, second, C(2, 'spades'))).toBe(true);
    expect(evalInsideOutside('outside', first, second, C(14, 'spades'))).toBe(true);
    expect(evalInsideOutside('inside', first, second, C(2, 'spades'))).toBe(false);
  });

  it('boundary tie is wrong for both answers', () => {
    for (const card of [C(5, 'spades'), C(10, 'spades')]) {
      expect(evalInsideOutside('inside', first, second, card)).toBe(false);
      expect(evalInsideOutside('outside', first, second, card)).toBe(false);
    }
  });
});

describe('evalSuit', () => {
  it('matches exact suit', () => {
    expect(evalSuit('diamonds', C(12, 'diamonds'))).toBe(true);
    expect(evalSuit('hearts', C(12, 'diamonds'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/rules.test.ts`
Expected: FAIL — cannot resolve `./rules`.

- [ ] **Step 3: Write `src/engine/rules.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/rules.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/rules.ts src/engine/rules.test.ts
git commit -m "feat: guess evaluators with ties-are-wrong rules"
```

---

### Task 5: Engine — start game and Phase 1

**Files:**
- Create: `src/engine/engine.ts`
- Test: `src/engine/engine.phase1.test.ts`

**Interfaces:**
- Consumes: `rng.ts` (`shuffle`, `randomInt`), `deck.ts` (`fullDeck`, `handSizeFor`), `rules.ts` (evaluators), `types.ts`.
- Produces (used by all UI tasks and E2E):
  - `MIN_PLAYERS = 2`, `MAX_PLAYERS = 8`
  - `QUESTION_ANSWERS: readonly GuessAnswer[][]` — answer options per question index 0-3.
  - `rowValue(index: number): number` — pyramid drink value by card index.
  - `createInitialState(): GameState`
  - `reduce(state: GameState, action: Action): GameState` — returns the SAME object (reference-equal) for invalid actions.

This task implements `START_GAME` plus the `phase1` branches of `GUESS`, `ASSIGN_DRINKS`, `ADVANCE`, including the transition that deals Phase 2. The `phase2`/`phase3` branches are added in Tasks 6–7, but the full file skeleton (switch over all action types, helpers `evaluate`, `advancePhase1`, `dealPhase2`) lands here.

- [ ] **Step 1: Write the failing test `src/engine/engine.phase1.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { createInitialState, MAX_PLAYERS, MIN_PLAYERS, reduce } from './engine';
import type { Card, GameState, Phase1Stage, Phase2Stage, Player, Suit } from './types';

const C = (rank: number, suit: Suit): Card => ({ rank, suit });
const players = (...names: string[]): Player[] => names.map((name) => ({ name, drinks: 0 }));

function phase1(partial?: Partial<Phase1Stage>): GameState {
  return {
    seed: 1,
    rngState: 1,
    players: players('Amy', 'Bob'),
    stage: {
      kind: 'phase1',
      hands: [
        [C(5, 'hearts'), C(9, 'spades'), C(7, 'clubs'), C(12, 'diamonds')],
        [C(3, 'clubs'), C(3, 'diamonds'), C(10, 'hearts'), C(14, 'spades')],
      ],
      questionIndex: 0,
      playerIndex: 0,
      feedback: null,
      ...partial,
    },
  };
}

describe('createInitialState', () => {
  it('starts idle with no players', () => {
    expect(createInitialState()).toEqual({ seed: 0, rngState: 0, players: [], stage: { kind: 'idle' } });
  });
});

describe('START_GAME', () => {
  it('deals 4 unique face-down cards per player, deterministically by seed', () => {
    const a = reduce(createInitialState(), { type: 'START_GAME', names: ['Amy', 'Bob', 'Cat'], seed: 42 });
    const b = reduce(createInitialState(), { type: 'START_GAME', names: ['Amy', 'Bob', 'Cat'], seed: 42 });
    expect(a).toEqual(b);
    expect(a.players.map((p) => p.name)).toEqual(['Amy', 'Bob', 'Cat']);
    expect(a.players.every((p) => p.drinks === 0)).toBe(true);
    const stage = a.stage as Phase1Stage;
    expect(stage.kind).toBe('phase1');
    expect(stage.questionIndex).toBe(0);
    expect(stage.playerIndex).toBe(0);
    expect(stage.hands).toHaveLength(3);
    const all = stage.hands.flat();
    expect(all).toHaveLength(12);
    expect(new Set(all.map((c) => `${c.rank}-${c.suit}`)).size).toBe(12);
  });

  it('different seeds deal different hands', () => {
    const a = reduce(createInitialState(), { type: 'START_GAME', names: ['Amy', 'Bob'], seed: 1 });
    const b = reduce(createInitialState(), { type: 'START_GAME', names: ['Amy', 'Bob'], seed: 2 });
    expect((a.stage as Phase1Stage).hands).not.toEqual((b.stage as Phase1Stage).hands);
  });

  it('rejects invalid player counts and blank names', () => {
    const s = createInitialState();
    expect(reduce(s, { type: 'START_GAME', names: ['Solo'], seed: 1 })).toBe(s);
    expect(reduce(s, { type: 'START_GAME', names: Array.from({ length: MAX_PLAYERS + 1 }, (_, i) => `P${i}`), seed: 1 })).toBe(s);
    expect(reduce(s, { type: 'START_GAME', names: ['Amy', '   '], seed: 1 })).toBe(s);
    expect(MIN_PLAYERS).toBe(2);
  });

  it('is allowed mid-game (starts a fresh game)', () => {
    const mid = phase1();
    const fresh = reduce(mid, { type: 'START_GAME', names: ['Zoe', 'Yan'], seed: 9 });
    expect(fresh.stage.kind).toBe('phase1');
    expect(fresh.players.map((p) => p.name)).toEqual(['Zoe', 'Yan']);
  });
});

describe('phase 1 guessing', () => {
  it('wrong guess adds a drink to the guesser and sets feedback', () => {
    const s = reduce(phase1(), { type: 'GUESS', answer: 'black' }); // card is 5♥ (red)
    expect(s.players[0].drinks).toBe(1);
    const stage = s.stage as Phase1Stage;
    expect(stage.feedback).toEqual({ correct: false, card: C(5, 'hearts') });
  });

  it('correct guess sets feedback and waits for drink assignment', () => {
    const s = reduce(phase1(), { type: 'GUESS', answer: 'red' });
    expect(s.players[0].drinks).toBe(0);
    expect((s.stage as Phase1Stage).feedback?.correct).toBe(true);
    expect(reduce(s, { type: 'ADVANCE' })).toBe(s); // must assign, not advance
    expect(reduce(s, { type: 'ASSIGN_DRINKS', toPlayer: 0 })).toBe(s); // not to self
  });

  it('assignment gives a drink and moves to the next player', () => {
    const s0 = reduce(phase1(), { type: 'GUESS', answer: 'red' });
    const s1 = reduce(s0, { type: 'ASSIGN_DRINKS', toPlayer: 1 });
    expect(s1.players[1].drinks).toBe(1);
    const stage = s1.stage as Phase1Stage;
    expect(stage.playerIndex).toBe(1);
    expect(stage.questionIndex).toBe(0);
    expect(stage.feedback).toBeNull();
  });

  it('wrong guess then ADVANCE moves to the next player', () => {
    const s0 = reduce(phase1(), { type: 'GUESS', answer: 'black' });
    const s1 = reduce(s0, { type: 'ADVANCE' });
    const stage = s1.stage as Phase1Stage;
    expect(stage.playerIndex).toBe(1);
    expect(stage.feedback).toBeNull();
  });

  it('last player finishing a question starts the next round', () => {
    const s0 = phase1({ playerIndex: 1 }); // Bob's card 0 is 3♣ (black)
    const s1 = reduce(s0, { type: 'GUESS', answer: 'black' });
    const s2 = reduce(s1, { type: 'ASSIGN_DRINKS', toPlayer: 0 });
    const stage = s2.stage as Phase1Stage;
    expect(stage.questionIndex).toBe(1);
    expect(stage.playerIndex).toBe(0);
  });

  it('evaluates questions 2-4 against the right cards', () => {
    // Amy: 5♥ 9♠ 7♣ 12♦ — 9 is higher than 5; 7 is inside 5..9; suit is diamonds
    const q2 = reduce(phase1({ questionIndex: 1 }), { type: 'GUESS', answer: 'higher' });
    expect((q2.stage as Phase1Stage).feedback?.correct).toBe(true);
    const q3 = reduce(phase1({ questionIndex: 2 }), { type: 'GUESS', answer: 'inside' });
    expect((q3.stage as Phase1Stage).feedback?.correct).toBe(true);
    const q4 = reduce(phase1({ questionIndex: 3 }), { type: 'GUESS', answer: 'diamonds' });
    expect((q4.stage as Phase1Stage).feedback?.correct).toBe(true);
  });

  it('rejects answers that do not fit the question and double guesses', () => {
    const s = phase1();
    expect(reduce(s, { type: 'GUESS', answer: 'hearts' })).toBe(s);
    expect(reduce(s, { type: 'GUESS', answer: 'higher' })).toBe(s);
    const guessed = reduce(s, { type: 'GUESS', answer: 'red' });
    expect(reduce(guessed, { type: 'GUESS', answer: 'red' })).toBe(guessed);
  });

  it('rejects out-of-range assignment targets', () => {
    const s = reduce(phase1(), { type: 'GUESS', answer: 'red' });
    expect(reduce(s, { type: 'ASSIGN_DRINKS', toPlayer: 5 })).toBe(s);
    expect(reduce(s, { type: 'ASSIGN_DRINKS', toPlayer: -1 })).toBe(s);
  });
});

describe('transition to phase 2', () => {
  it('after the last player answers question 4, the pyramid is dealt', () => {
    const s0 = phase1({ questionIndex: 3, playerIndex: 1 }); // Bob's 4th card is 14♠
    const s1 = reduce(s0, { type: 'GUESS', answer: 'spades' });
    const s2 = reduce(s1, { type: 'ASSIGN_DRINKS', toPlayer: 0 });
    const stage = s2.stage as Phase2Stage;
    expect(stage.kind).toBe('phase2');
    expect(stage.pyramid).toHaveLength(10);
    expect(stage.flipped).toBe(0);
    expect(stage.matchQueue).toEqual([]);
    expect(stage.hands).toHaveLength(2);
    expect(stage.hands[0]).toHaveLength(5); // 2 players -> 5 cards each
    expect(stage.hands[1]).toHaveLength(5);
    const all = [...stage.pyramid, ...stage.hands.flat()];
    expect(new Set(all.map((c) => `${c.rank}-${c.suit}`)).size).toBe(20); // fresh deck, no dupes
    expect(s2.rngState).not.toBe(s0.rngState); // shuffle consumed rng
  });
});

describe('invalid actions in idle', () => {
  it('rejects everything except START_GAME', () => {
    const s = createInitialState();
    expect(reduce(s, { type: 'GUESS', answer: 'red' })).toBe(s);
    expect(reduce(s, { type: 'ASSIGN_DRINKS', toPlayer: 0 })).toBe(s);
    expect(reduce(s, { type: 'FLIP_PYRAMID_CARD' })).toBe(s);
    expect(reduce(s, { type: 'ADVANCE' })).toBe(s);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/engine.phase1.test.ts`
Expected: FAIL — cannot resolve `./engine`.

- [ ] **Step 3: Write `src/engine/engine.ts`**

The `phase2`/`phase3` branches below are left as rejections in this task (returning `state`), with `// Task 6` / `// Task 7` markers showing where the follow-up tasks extend the same functions.

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/engine.phase1.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 5: Run the full suite and commit**

Run: `npm test`
Expected: all suites pass.

```bash
git add src/engine/engine.ts src/engine/engine.phase1.test.ts
git commit -m "feat: engine start-game and phase 1 four-questions flow"
```

---

### Task 6: Engine — Pyramid and bus-rider selection

**Files:**
- Modify: `src/engine/engine.ts` (fill in the `flipPyramid` body, the `phase2` branch of `assignDrinks`, and the `phase2` branch of `advance`)
- Test: `src/engine/engine.phase2.test.ts`

**Interfaces:**
- Consumes: everything Task 5 produced; `randomInt` from `./rng` (add to the existing import).
- Produces: working `FLIP_PYRAMID_CARD`, phase2 `ASSIGN_DRINKS`, and `ADVANCE` → `busReveal` with `riderIndex` = most drinks (seeded random tie-break).

- [ ] **Step 1: Write the failing test `src/engine/engine.phase2.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { reduce, rowValue } from './engine';
import type { Card, GameState, Phase2Stage, Player, Suit } from './types';

const C = (rank: number, suit: Suit): Card => ({ rank, suit });
const players = (...names: string[]): Player[] => names.map((name) => ({ name, drinks: 0 }));

const PYRAMID: Card[] = [
  C(2, 'hearts'), C(5, 'clubs'), C(9, 'diamonds'), C(11, 'spades'), // bottom row, 1 drink
  C(4, 'hearts'), C(6, 'clubs'), C(8, 'diamonds'),                  // 2 drinks
  C(10, 'hearts'), C(12, 'clubs'),                                  // 3 drinks
  C(14, 'spades'),                                                  // top, 4 drinks
];

function phase2(partial?: Partial<Phase2Stage>, drinks: number[] = [0, 0]): GameState {
  return {
    seed: 1,
    rngState: 1,
    players: players('Amy', 'Bob').map((p, i) => ({ ...p, drinks: drinks[i] ?? 0 })),
    stage: {
      kind: 'phase2',
      pyramid: PYRAMID,
      flipped: 0,
      hands: [
        [C(2, 'spades'), C(7, 'hearts')],
        [C(2, 'diamonds'), C(14, 'hearts')],
      ],
      matchQueue: [],
      ...partial,
    },
  };
}

describe('rowValue', () => {
  it('maps indexes to 1/2/3/4 drinks', () => {
    expect([0, 1, 2, 3].map(rowValue)).toEqual([1, 1, 1, 1]);
    expect([4, 5, 6].map(rowValue)).toEqual([2, 2, 2]);
    expect([7, 8].map(rowValue)).toEqual([3, 3]);
    expect(rowValue(9)).toBe(4);
  });
});

describe('FLIP_PYRAMID_CARD', () => {
  it('flips the next card, removes matching cards, queues one entry per matched card', () => {
    const s = reduce(phase2(), { type: 'FLIP_PYRAMID_CARD' }); // flips 2♥
    const stage = s.stage as Phase2Stage;
    expect(stage.flipped).toBe(1);
    expect(stage.matchQueue).toEqual([
      { playerIndex: 0, drinks: 1 },
      { playerIndex: 1, drinks: 1 },
    ]);
    expect(stage.hands).toEqual([[C(7, 'hearts')], [C(14, 'hearts')]]);
  });

  it('a hand with two copies queues two entries', () => {
    const s0 = phase2({ hands: [[C(2, 'spades'), C(2, 'clubs')], [C(7, 'hearts')]] });
    const s1 = reduce(s0, { type: 'FLIP_PYRAMID_CARD' });
    expect((s1.stage as Phase2Stage).matchQueue).toEqual([
      { playerIndex: 0, drinks: 1 },
      { playerIndex: 0, drinks: 1 },
    ]);
  });

  it('uses the row drink value for higher rows', () => {
    const s0 = phase2({ flipped: 9, hands: [[C(14, 'hearts')], []] });
    const s1 = reduce(s0, { type: 'FLIP_PYRAMID_CARD' }); // top card 14♠, 4 drinks
    expect((s1.stage as Phase2Stage).matchQueue).toEqual([{ playerIndex: 0, drinks: 4 }]);
  });

  it('is rejected while assignments are pending or after the last card', () => {
    const pending = reduce(phase2(), { type: 'FLIP_PYRAMID_CARD' });
    expect(reduce(pending, { type: 'FLIP_PYRAMID_CARD' })).toBe(pending);
    const done = phase2({ flipped: 10, hands: [[], []] });
    expect(reduce(done, { type: 'FLIP_PYRAMID_CARD' })).toBe(done);
  });
});

describe('phase 2 ASSIGN_DRINKS', () => {
  it('pops the queue head, adds its drinks to the target, and blocks self-assign', () => {
    const s0 = reduce(phase2(), { type: 'FLIP_PYRAMID_CARD' }); // queue: Amy(1), Bob(1)
    expect(reduce(s0, { type: 'ASSIGN_DRINKS', toPlayer: 0 })).toBe(s0); // Amy at head, no self
    const s1 = reduce(s0, { type: 'ASSIGN_DRINKS', toPlayer: 1 }); // Amy -> Bob
    expect(s1.players[1].drinks).toBe(1);
    expect((s1.stage as Phase2Stage).matchQueue).toEqual([{ playerIndex: 1, drinks: 1 }]);
    const s2 = reduce(s1, { type: 'ASSIGN_DRINKS', toPlayer: 0 }); // Bob -> Amy
    expect(s2.players[0].drinks).toBe(1);
    expect((s2.stage as Phase2Stage).matchQueue).toEqual([]);
  });

  it('is rejected when the queue is empty', () => {
    const s = phase2();
    expect(reduce(s, { type: 'ASSIGN_DRINKS', toPlayer: 1 })).toBe(s);
  });
});

describe('ADVANCE to bus reveal', () => {
  it('is rejected until all 10 cards are flipped and the queue is empty', () => {
    const early = phase2({ flipped: 9, hands: [[], []] });
    expect(reduce(early, { type: 'ADVANCE' })).toBe(early);
    const pending = reduce(phase2({ flipped: 9, hands: [[C(14, 'hearts')], []] }), { type: 'FLIP_PYRAMID_CARD' });
    expect(reduce(pending, { type: 'ADVANCE' })).toBe(pending);
  });

  it('picks the player with the most drinks as rider', () => {
    const s = reduce(phase2({ flipped: 10, hands: [[], []] }, [3, 1]), { type: 'ADVANCE' });
    expect(s.stage).toEqual({ kind: 'busReveal', riderIndex: 0 });
  });

  it('breaks ties deterministically via the seeded rng', () => {
    const tied = phase2({ flipped: 10, hands: [[], []] }, [2, 2]);
    const a = reduce(tied, { type: 'ADVANCE' });
    const b = reduce(tied, { type: 'ADVANCE' });
    expect(a).toEqual(b);
    const stage = a.stage as { kind: string; riderIndex: number };
    expect(stage.kind).toBe('busReveal');
    expect([0, 1]).toContain(stage.riderIndex);
    expect(a.rngState).not.toBe(tied.rngState); // tie-break consumed rng
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/engine.phase2.test.ts`
Expected: FAIL — flips/assignments return unchanged state (skeleton rejects everything).

- [ ] **Step 3: Fill in the phase-2 logic in `src/engine/engine.ts`**

Change the rng import to include `randomInt`:

```ts
import { randomInt, shuffle } from './rng';
```

Replace the `flipPyramid` stub with:

```ts
function flipPyramid(state: GameState): GameState {
  const { stage } = state;
  if (stage.kind !== 'phase2') return state;
  if (stage.flipped >= 10 || stage.matchQueue.length > 0) return state;
  const card = stage.pyramid[stage.flipped];
  const drinks = rowValue(stage.flipped);
  const matchQueue: PendingMatch[] = [];
  const hands = stage.hands.map((hand, playerIndex) => {
    const matchCount = hand.filter((c) => c.rank === card.rank).length;
    for (let k = 0; k < matchCount; k++) matchQueue.push({ playerIndex, drinks });
    return hand.filter((c) => c.rank !== card.rank);
  });
  return { ...state, stage: { ...stage, flipped: stage.flipped + 1, hands, matchQueue } };
}
```

Add `PendingMatch` to the type imports from `./types`.

In `assignDrinks`, replace the `// Task 6: phase2 branch` comment with:

```ts
  if (stage.kind === 'phase2') {
    const head = stage.matchQueue[0];
    if (!head) return state;
    if (toPlayer === head.playerIndex) return state;
    const next = addDrinks(state, toPlayer, head.drinks);
    return { ...next, stage: { ...stage, matchQueue: stage.matchQueue.slice(1) } };
  }
```

In `advance`, replace the `// Task 6 ...` comment with:

```ts
  if (stage.kind === 'phase2') {
    if (stage.flipped < 10 || stage.matchQueue.length > 0) return state;
    return revealRider(state);
  }
```

And add the helper at the bottom of the file:

```ts
function revealRider(state: GameState): GameState {
  const max = Math.max(...state.players.map((p) => p.drinks));
  const tied = state.players.map((_, i) => i).filter((i) => state.players[i].drinks === max);
  const { value, rngState } = randomInt(tied.length, state.rngState);
  return { ...state, rngState, stage: { kind: 'busReveal', riderIndex: tied[value] } };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — all suites including the 10 new phase-2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/engine/engine.ts src/engine/engine.phase2.test.ts
git commit -m "feat: engine pyramid flips, drink assignment queue, rider selection"
```

---

### Task 7: Engine — Ride the Bus and game over

**Files:**
- Modify: `src/engine/engine.ts` (fill in `busReveal`/`phase3` branches of `advance` and the `phase3` branch of `guess`)
- Test: `src/engine/engine.phase3.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 5–6.
- Produces: `ADVANCE` from `busReveal` deals the bus; phase3 `GUESS`/`ADVANCE` implement drink-and-redeal; finishing question 4 yields `{ kind: 'gameOver', riderIndex, attempts }`; `START_GAME` from `gameOver` starts a fresh game (already works — `startGame` ignores stage).

- [ ] **Step 1: Write the failing test `src/engine/engine.phase3.test.ts`**

```ts
import { describe, expect, it } from 'vitest';
import { reduce } from './engine';
import { fullDeck } from './deck';
import type { Card, GameState, Phase3Stage, Player, Suit } from './types';

const C = (rank: number, suit: Suit): Card => ({ rank, suit });
const players = (...names: string[]): Player[] => names.map((name) => ({ name, drinks: 0 }));

function busReveal(): GameState {
  return { seed: 1, rngState: 1, players: players('Amy', 'Bob'), stage: { kind: 'busReveal', riderIndex: 1 } };
}

function phase3(partial?: Partial<Phase3Stage>): GameState {
  return {
    seed: 1,
    rngState: 1,
    players: players('Amy', 'Bob'),
    stage: {
      kind: 'phase3',
      riderIndex: 1,
      cards: [C(5, 'hearts'), C(9, 'spades'), C(7, 'clubs'), C(12, 'diamonds')],
      position: 0,
      attempts: 1,
      deck: fullDeck().slice(0, 20), // arbitrary draw pile for redeals
      feedback: null,
      ...partial,
    },
  };
}

describe('dealing the bus', () => {
  it('ADVANCE from busReveal deals 4 cards and keeps the rest as draw pile', () => {
    const s = reduce(busReveal(), { type: 'ADVANCE' });
    const stage = s.stage as Phase3Stage;
    expect(stage.kind).toBe('phase3');
    expect(stage.riderIndex).toBe(1);
    expect(stage.cards).toHaveLength(4);
    expect(stage.deck).toHaveLength(48);
    expect(stage.position).toBe(0);
    expect(stage.attempts).toBe(1);
    expect(stage.feedback).toBeNull();
    const all = [...stage.cards, ...stage.deck];
    expect(new Set(all.map((c) => `${c.rank}-${c.suit}`)).size).toBe(52);
  });
});

describe('riding the bus', () => {
  it('four correct guesses end the game', () => {
    // cards: 5♥ (red), 9♠ (higher), 7♣ (inside 5..9), 12♦ (diamonds)
    let s = phase3();
    for (const answer of ['red', 'higher', 'inside', 'diamonds'] as const) {
      s = reduce(s, { type: 'GUESS', answer });
      expect((s.stage as Phase3Stage).feedback?.correct).toBe(true);
      s = reduce(s, { type: 'ADVANCE' });
    }
    expect(s.stage).toEqual({ kind: 'gameOver', riderIndex: 1, attempts: 1 });
    expect(s.players[1].drinks).toBe(0);
  });

  it('a wrong guess drinks, then ADVANCE redeals fresh cards from position 0', () => {
    const s0 = phase3();
    const s1 = reduce(s0, { type: 'GUESS', answer: 'black' }); // 5♥ is red
    expect(s1.players[1].drinks).toBe(1);
    expect((s1.stage as Phase3Stage).feedback).toEqual({ correct: false, card: C(5, 'hearts') });
    const s2 = reduce(s1, { type: 'ADVANCE' });
    const stage = s2.stage as Phase3Stage;
    expect(stage.position).toBe(0);
    expect(stage.attempts).toBe(2);
    expect(stage.feedback).toBeNull();
    expect(stage.cards).toEqual((s0.stage as Phase3Stage).deck.slice(0, 4));
    expect(stage.deck).toHaveLength(16);
  });

  it('a wrong guess mid-row also resets to the start', () => {
    const s0 = phase3({ position: 2 });
    const s1 = reduce(s0, { type: 'GUESS', answer: 'outside' }); // 7 is inside 5..9
    const s2 = reduce(s1, { type: 'ADVANCE' });
    expect((s2.stage as Phase3Stage).position).toBe(0);
    expect((s2.stage as Phase3Stage).attempts).toBe(2);
  });

  it('reshuffles a fresh 52-card deck when fewer than 4 cards remain', () => {
    const s0 = phase3({ deck: fullDeck().slice(0, 3) });
    const s1 = reduce(s0, { type: 'GUESS', answer: 'black' });
    const s2 = reduce(s1, { type: 'ADVANCE' });
    const stage = s2.stage as Phase3Stage;
    expect(stage.cards).toHaveLength(4);
    expect(stage.deck).toHaveLength(48);
    expect(s2.rngState).not.toBe(s0.rngState); // reshuffle consumed rng
  });

  it('rejects double guesses and premature ADVANCE', () => {
    const s = phase3();
    expect(reduce(s, { type: 'ADVANCE' })).toBe(s); // no feedback yet
    const guessed = reduce(s, { type: 'GUESS', answer: 'red' });
    expect(reduce(guessed, { type: 'GUESS', answer: 'red' })).toBe(guessed);
  });
});

describe('game over', () => {
  it('rejects everything except START_GAME', () => {
    const s: GameState = { seed: 1, rngState: 1, players: players('Amy', 'Bob'), stage: { kind: 'gameOver', riderIndex: 0, attempts: 3 } };
    expect(reduce(s, { type: 'GUESS', answer: 'red' })).toBe(s);
    expect(reduce(s, { type: 'ADVANCE' })).toBe(s);
    const fresh = reduce(s, { type: 'START_GAME', names: ['Amy', 'Bob'], seed: 5 });
    expect(fresh.stage.kind).toBe('phase1');
    expect(fresh.players.every((p) => p.drinks === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/engine.phase3.test.ts`
Expected: FAIL — busReveal `ADVANCE` and phase3 branches still reject.

- [ ] **Step 3: Fill in the phase-3 logic in `src/engine/engine.ts`**

In `guess`, replace the `// Task 7: phase3 branch` comment with:

```ts
  if (stage.kind === 'phase3') {
    if (stage.feedback) return state;
    const correct = evaluate(stage.position, answer, stage.cards);
    if (correct === null) return state;
    const card = stage.cards[stage.position];
    const next = correct ? state : addDrinks(state, stage.riderIndex, 1);
    return { ...next, stage: { ...stage, feedback: { correct, card } } };
  }
```

In `advance`, replace the `// Task 7 ...` comment with:

```ts
  if (stage.kind === 'busReveal') {
    return dealBus(state, stage.riderIndex);
  }
  if (stage.kind === 'phase3') {
    if (!stage.feedback) return state;
    if (stage.feedback.correct) {
      if (stage.position === 3) {
        return { ...state, stage: { kind: 'gameOver', riderIndex: stage.riderIndex, attempts: stage.attempts } };
      }
      return { ...state, stage: { ...stage, position: stage.position + 1, feedback: null } };
    }
    return redealBus(state);
  }
```

Add the helpers at the bottom of the file (`Phase3Stage` joins the type imports):

```ts
function dealBus(state: GameState, riderIndex: number): GameState {
  const { items: deck, rngState } = shuffle(fullDeck(), state.rngState);
  return {
    ...state,
    rngState,
    stage: {
      kind: 'phase3',
      riderIndex,
      cards: deck.slice(0, 4),
      position: 0,
      attempts: 1,
      deck: deck.slice(4),
      feedback: null,
    },
  };
}

/** Discard the row, deal 4 fresh cards, back to question 1. */
function redealBus(state: GameState): GameState {
  const stage = state.stage as Phase3Stage;
  let deck = stage.deck;
  let rngState = state.rngState;
  if (deck.length < 4) {
    const r = shuffle(fullDeck(), rngState);
    deck = r.items;
    rngState = r.rngState;
  }
  return {
    ...state,
    rngState,
    stage: {
      ...stage,
      cards: deck.slice(0, 4),
      deck: deck.slice(4),
      position: 0,
      attempts: stage.attempts + 1,
      feedback: null,
    },
  };
}
```

- [ ] **Step 4: Run the full suite to verify it passes**

Run: `npm test`
Expected: PASS — every engine suite green. The engine is now complete.

- [ ] **Step 5: Commit**

```bash
git add src/engine/engine.ts src/engine/engine.phase3.test.ts
git commit -m "feat: engine bus ride with drink-and-redeal and game over"
```

---

### Task 8: localStorage persistence

**Files:**
- Create: `src/ui/storage.ts`
- Test: `src/ui/storage.test.ts`

**Interfaces:**
- Consumes: `GameState` from `../engine/types`.
- Produces:
  - `saveGame(state: GameState): void` — persists in-progress games; REMOVES the save when stage is `idle` or `gameOver`.
  - `loadGame(): GameState | null` — null on missing/corrupt data.
  - `clearSave(): void`
  - Storage key: `'ridethebus:save:v1'`.

- [ ] **Step 1: Write the failing test `src/ui/storage.test.ts`**

Vitest runs in node, so stub `localStorage` explicitly:

```ts
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
  players: [{ name: 'Amy', drinks: 2 }, { name: 'Bob', drinks: 1 }],
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/ui/storage.test.ts`
Expected: FAIL — cannot resolve `./storage`.

- [ ] **Step 3: Write `src/ui/storage.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/ui/storage.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/storage.ts src/ui/storage.test.ts
git commit -m "feat: localStorage save/load with validation"
```

---

### Task 9: UI foundation — labels, components, neon stylesheet

**Files:**
- Create: `src/ui/labels.ts`, `src/ui/components/CardView.tsx`, `src/ui/components/Scoreboard.tsx`, `src/ui/components/PlayerPicker.tsx`
- Modify: `src/styles.css` (replace placeholder with the full theme)

**Interfaces:**
- Consumes: `Card`, `Player`, `Suit`, `GuessAnswer` types; `isRed` from `../engine/rules`.
- Produces:
  - `ANSWER_LABELS: Record<GuessAnswer, string>`, `QUESTION_TEXT: string[]` (index = question), `rankLabel(rank: number): string`, `SUIT_GLYPH: Record<Suit, string>`.
  - `<CardView card? faceDown? small? glow? onClick? testId? />`
  - `<Scoreboard players />` — renders `data-testid="scoreboard-drinks-{i}"` per player.
  - `<PlayerPicker players exclude prompt card? onPick />` — overlay; renders `data-testid="pick-player-{i}"` buttons for every player except `exclude`.
- No unit tests: display-only components, verified by `npm run build` (strict tsc) here and behaviorally by the Task 16 E2E suite.

- [ ] **Step 1: Write `src/ui/labels.ts`**

```ts
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
```

- [ ] **Step 2: Write `src/ui/components/CardView.tsx`**

```tsx
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
}

export function CardView({ card, faceDown = false, small = false, glow = false, onClick, testId }: Props) {
  const showFace = !faceDown && card !== undefined;
  const cls = [
    'card',
    small && 'card-small',
    !showFace && 'card-down',
    glow && 'card-glow',
    showFace && (isRed(card) ? 'card-red' : 'card-black'),
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button className={cls} onClick={onClick} disabled={!onClick} data-testid={testId}>
      {showFace && (
        <>
          <span className="card-rank">{rankLabel(card.rank)}</span>
          <span className="card-suit">{SUIT_GLYPH[card.suit]}</span>
        </>
      )}
    </button>
  );
}
```

- [ ] **Step 3: Write `src/ui/components/Scoreboard.tsx` and `src/ui/components/PlayerPicker.tsx`**

`Scoreboard.tsx`:
```tsx
import type { Player } from '../../engine/types';

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
    </div>
  );
}
```

`PlayerPicker.tsx`:
```tsx
import type { Card, Player } from '../../engine/types';
import { CardView } from './CardView';

interface Props {
  players: Player[];
  exclude: number;
  prompt: string;
  card?: Card;
  onPick: (playerIndex: number) => void;
}

export function PlayerPicker({ players, exclude, prompt, card, onPick }: Props) {
  return (
    <div className="overlay">
      <div className="panel">
        {card && <CardView card={card} />}
        <h2 className="prompt">{prompt}</h2>
        <div className="picker-grid">
          {players.map((p, i) =>
            i === exclude ? null : (
              <button key={i} className="btn btn-pick" data-testid={`pick-player-${i}`} onClick={() => onPick(i)}>
                {p.name}
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Replace `src/styles.css` with the full neon theme**

```css
:root {
  --bg: #0a0a14;
  --panel: #16162c;
  --text: #f2f2fa;
  --muted: #8a8aa8;
  --pink: #ff2d78;
  --cyan: #22e6ff;
  --violet: #a26bff;
  --green: #3dff8f;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

html, body { height: 100%; }

body {
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  touch-action: manipulation;
  -webkit-user-select: none;
  user-select: none;
  overscroll-behavior: none;
}

#root { min-height: 100dvh; display: flex; flex-direction: column; }

.app { flex: 1; display: flex; flex-direction: column; }

.screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 16px;
  padding-top: calc(env(safe-area-inset-top) + 16px);
  padding-bottom: calc(env(safe-area-inset-bottom) + 24px);
  width: 100%;
}

.center { justify-content: center; }

.logo {
  font-size: 3rem;
  font-weight: 900;
  text-align: center;
  line-height: 1.05;
  background: linear-gradient(180deg, var(--pink), var(--violet));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 18px rgba(255, 45, 120, 0.5));
}

.phase-label {
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 2px;
  font-size: 0.75rem;
}

.turn-banner {
  font-size: 2rem;
  font-weight: 800;
  color: var(--cyan);
  text-shadow: 0 0 16px rgba(34, 230, 255, 0.6);
}

.question { font-size: 1.25rem; font-weight: 600; }
.attempts { color: var(--muted); }

.btn {
  appearance: none;
  border: 2px solid var(--violet);
  border-radius: 16px;
  background: var(--panel);
  color: var(--text);
  font-size: 1.15rem;
  font-weight: 700;
  padding: 16px 24px;
  min-height: 56px;
  min-width: 200px;
  cursor: pointer;
  box-shadow: 0 0 12px rgba(162, 107, 255, 0.35);
}
.btn:disabled { opacity: 0.4; box-shadow: none; }
.btn:active:not(:disabled) { transform: scale(0.97); }
.btn-primary { border-color: var(--pink); box-shadow: 0 0 16px rgba(255, 45, 120, 0.5); }
.btn-ghost { border-color: transparent; box-shadow: none; color: var(--muted); min-width: 0; }
.btn-answer { min-width: 0; flex: 1 1 40%; }
.btn-pick { min-width: 0; }

.answers {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  width: 100%;
  max-width: 420px;
  margin-top: auto;
}

.card {
  appearance: none;
  width: 72px;
  height: 104px;
  border-radius: 10px;
  border: 2px solid var(--violet);
  background: #181832;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  font-weight: 800;
  padding: 0;
  color: var(--text);
}
.card:disabled { opacity: 1; }
.card-small { width: 44px; height: 64px; border-radius: 8px; }
.card-rank { font-size: 1.5rem; }
.card-small .card-rank { font-size: 1rem; }
.card-suit { font-size: 1.25rem; }
.card-small .card-suit { font-size: 0.85rem; }
.card-red {
  color: var(--pink);
  border-color: var(--pink);
  box-shadow: 0 0 10px rgba(255, 45, 120, 0.35);
  animation: flip 0.4s ease;
}
.card-black {
  color: var(--cyan);
  border-color: var(--cyan);
  box-shadow: 0 0 10px rgba(34, 230, 255, 0.35);
  animation: flip 0.4s ease;
}
.card-down {
  background: repeating-linear-gradient(135deg, #181832 0 8px, #1f1f42 8px 16px);
  border-color: #34345c;
}
.card-glow {
  border-color: var(--green);
  box-shadow: 0 0 14px rgba(61, 255, 143, 0.6);
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes flip {
  from { transform: rotateY(90deg); }
  to { transform: rotateY(0); }
}
@keyframes pulse {
  50% { box-shadow: 0 0 22px rgba(61, 255, 143, 0.9); }
}

.card-row { display: flex; gap: 10px; }

.scoreboard {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 10px 12px;
  padding-top: calc(env(safe-area-inset-top) + 10px);
  background: rgba(10, 10, 20, 0.9);
  border-bottom: 1px solid #26264a;
}
.score {
  display: flex;
  gap: 6px;
  align-items: baseline;
  background: var(--panel);
  border-radius: 10px;
  padding: 6px 10px;
  white-space: nowrap;
}
.score-name { font-size: 0.85rem; color: var(--muted); }
.score-drinks { font-weight: 800; color: var(--pink); }

.overlay {
  position: fixed;
  inset: 0;
  z-index: 10;
  background: rgba(5, 5, 12, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.panel {
  background: var(--panel);
  border: 1px solid var(--violet);
  border-radius: 20px;
  box-shadow: 0 0 30px rgba(162, 107, 255, 0.4);
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  width: 100%;
  max-width: 380px;
  max-height: 85dvh;
  overflow-y: auto;
}
.verdict { font-size: 1.6rem; text-align: center; }
.verdict-wrong { color: var(--pink); text-shadow: 0 0 14px rgba(255, 45, 120, 0.7); }
.verdict-right { color: var(--green); text-shadow: 0 0 14px rgba(61, 255, 143, 0.7); }
.prompt { font-size: 1.2rem; text-align: center; }
.picker-grid { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }

.pyramid { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.pyramid-row { display: flex; gap: 8px; align-items: center; }
.row-value { color: var(--muted); font-size: 0.8rem; width: 34px; }
.hands { display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 420px; }
.hand-strip { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.hand-name { font-size: 0.85rem; color: var(--muted); width: 64px; }

.bus-rider {
  font-size: 2.6rem;
  font-weight: 900;
  color: var(--pink);
  text-shadow: 0 0 20px rgba(255, 45, 120, 0.8);
}
.reveal-pop { animation: pop 0.9s cubic-bezier(0.2, 1.6, 0.4, 1); }
@keyframes pop {
  0% { transform: scale(0.2); opacity: 0; filter: blur(8px); }
  60% { filter: blur(0); }
  100% { transform: scale(1); opacity: 1; }
}

.final-board { display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 320px; }
.final-board .score { justify-content: space-between; font-size: 1.1rem; }

.input {
  background: var(--panel);
  border: 2px solid #34345c;
  border-radius: 12px;
  color: var(--text);
  font-size: 1.1rem;
  padding: 14px;
  flex: 1;
  min-width: 0;
}
.input:focus { outline: none; border-color: var(--cyan); }
.setup-row { display: flex; gap: 8px; width: 100%; max-width: 380px; }
.setup-list { display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 380px; }
.setup-player {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--panel);
  border-radius: 12px;
  padding: 8px 8px 8px 16px;
  font-weight: 600;
}

.rules { text-align: left; align-items: stretch; }
.rules p { font-size: 0.95rem; line-height: 1.4; }
```

- [ ] **Step 5: Verify with build and commit**

Run: `npm run build`
Expected: tsc + Vite succeed (components are not imported yet — that's fine, they must simply compile).

Run: `npm test`
Expected: all suites still pass.

```bash
git add src/ui/labels.ts src/ui/components src/styles.css
git commit -m "feat: neon theme, card/scoreboard/player-picker components"
```

---

### Task 10: Home and Setup screens

**Files:**
- Create: `src/ui/screens/HomeScreen.tsx`, `src/ui/screens/SetupScreen.tsx`

**Interfaces:**
- Consumes: `MIN_PLAYERS`, `MAX_PLAYERS` from `../../engine/engine`.
- Produces:
  - `<HomeScreen canResume onResume onNewGame />` — testids `home-new-game`, `home-resume` (only when `canResume`).
  - `<SetupScreen onStart onBack />` where `onStart: (names: string[]) => void` — testids `setup-name-input`, `setup-add-player`, `setup-start`, `setup-player-{i}`.
- Verified by `npm run build` here, behaviorally in Task 16.

- [ ] **Step 1: Write `src/ui/screens/HomeScreen.tsx`**

```tsx
import { useState } from 'react';

interface Props {
  canResume: boolean;
  onResume: () => void;
  onNewGame: () => void;
}

export function HomeScreen({ canResume, onResume, onNewGame }: Props) {
  const [showRules, setShowRules] = useState(false);
  return (
    <div className="screen center">
      <h1 className="logo">RIDE THE<br />BUS</h1>
      <button className="btn btn-primary" data-testid="home-new-game" onClick={onNewGame}>
        New Game
      </button>
      {canResume && (
        <button className="btn" data-testid="home-resume" onClick={onResume}>
          Resume Game
        </button>
      )}
      <button className="btn btn-ghost" onClick={() => setShowRules(true)}>
        ⓘ How to play
      </button>
      {showRules && (
        <div className="overlay" onClick={() => setShowRules(false)}>
          <div className="panel rules">
            <h2>How to play</h2>
            <p>
              <strong>Phase 1 — Four Questions.</strong> Each player guesses their four cards in
              rounds: Red or Black, Higher or Lower, Inside or Outside, then the Suit. Ties are
              wrong. Wrong = drink. Right = give a drink to someone else.
            </p>
            <p>
              <strong>Phase 2 — Pyramid.</strong> Ten cards flip bottom row to top. Hold a matching
              rank and you hand out that row's drinks: 1, 2, 3, then 4 for the top card. Matches
              stack.
            </p>
            <p>
              <strong>Phase 3 — Ride the Bus.</strong> Whoever drank the most rides. Answer all four
              questions in a row — every miss is a drink, fresh cards, back to the start.
            </p>
            <button className="btn">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `src/ui/screens/SetupScreen.tsx`**

```tsx
import { useState } from 'react';
import { MAX_PLAYERS, MIN_PLAYERS } from '../../engine/engine';

interface Props {
  onStart: (names: string[]) => void;
  onBack: () => void;
}

export function SetupScreen({ onStart, onBack }: Props) {
  const [names, setNames] = useState<string[]>([]);
  const [draft, setDraft] = useState('');

  const add = () => {
    const name = draft.trim();
    if (!name || names.length >= MAX_PLAYERS) return;
    setNames([...names, name]);
    setDraft('');
  };

  return (
    <div className="screen center">
      <h2 className="turn-banner">Who's playing?</h2>
      <form
        className="setup-row"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          className="input"
          data-testid="setup-name-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Player name"
          maxLength={12}
          enterKeyHint="done"
        />
        <button type="submit" className="btn" data-testid="setup-add-player">
          Add
        </button>
      </form>
      <div className="setup-list">
        {names.map((n, i) => (
          <div key={i} className="setup-player" data-testid={`setup-player-${i}`}>
            <span>{n}</span>
            <button className="btn btn-ghost" onClick={() => setNames(names.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        className="btn btn-primary"
        data-testid="setup-start"
        disabled={names.length < MIN_PLAYERS}
        onClick={() => onStart(names)}
      >
        Start ({names.length} player{names.length === 1 ? '' : 's'})
      </button>
      <button className="btn btn-ghost" onClick={onBack}>
        ‹ Back
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Verify and commit**

Run: `npm run build`
Expected: clean.

```bash
git add src/ui/screens
git commit -m "feat: home and player-setup screens"
```

---

### Task 11: Phase 1 screen

**Files:**
- Create: `src/ui/screens/Phase1Screen.tsx`

**Interfaces:**
- Consumes: `QUESTION_ANSWERS` from engine; `Phase1Stage`, `GameState`, `Action` types; `CardView`, `PlayerPicker`; labels.
- Produces: `<Phase1Screen state stage dispatch />` — testids `turn-banner`, `question`, `p1-card-{i}`, `answer-{answer}`, `verdict`, `feedback-continue` (wrong path), player picker (correct path).

- [ ] **Step 1: Write `src/ui/screens/Phase1Screen.tsx`**

```tsx
import { QUESTION_ANSWERS } from '../../engine/engine';
import type { Action, GameState, Phase1Stage } from '../../engine/types';
import { CardView } from '../components/CardView';
import { PlayerPicker } from '../components/PlayerPicker';
import { ANSWER_LABELS, QUESTION_TEXT } from '../labels';

interface Props {
  state: GameState;
  stage: Phase1Stage;
  dispatch: (action: Action) => void;
}

export function Phase1Screen({ state, stage, dispatch }: Props) {
  const player = state.players[stage.playerIndex];
  const hand = stage.hands[stage.playerIndex];
  // Rounds reveal one card per question; the current card shows once feedback exists.
  const revealedCount = stage.questionIndex + (stage.feedback ? 1 : 0);

  return (
    <div className="screen">
      <p className="phase-label">Phase 1 — Four Questions</p>
      <h2 className="turn-banner" data-testid="turn-banner">{player.name}</h2>
      <p className="question" data-testid="question">{QUESTION_TEXT[stage.questionIndex]}</p>
      <div className="card-row">
        {hand.map((card, i) => (
          <CardView key={i} card={card} faceDown={i >= revealedCount} testId={`p1-card-${i}`} />
        ))}
      </div>
      {!stage.feedback && (
        <div className="answers">
          {QUESTION_ANSWERS[stage.questionIndex].map((answer) => (
            <button
              key={answer}
              className="btn btn-answer"
              data-testid={`answer-${answer}`}
              onClick={() => dispatch({ type: 'GUESS', answer })}
            >
              {ANSWER_LABELS[answer]}
            </button>
          ))}
        </div>
      )}
      {stage.feedback && !stage.feedback.correct && (
        <div className="overlay">
          <div className="panel">
            <h2 className="verdict verdict-wrong" data-testid="verdict">DRINK! 🍺</h2>
            <CardView card={stage.feedback.card} />
            <button
              className="btn btn-primary"
              data-testid="feedback-continue"
              onClick={() => dispatch({ type: 'ADVANCE' })}
            >
              Continue
            </button>
          </div>
        </div>
      )}
      {stage.feedback?.correct && (
        <PlayerPicker
          players={state.players}
          exclude={stage.playerIndex}
          prompt={`Correct! ${player.name} gives 1 drink to…`}
          card={stage.feedback.card}
          onPick={(toPlayer) => dispatch({ type: 'ASSIGN_DRINKS', toPlayer })}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify and commit**

Run: `npm run build`
Expected: clean.

```bash
git add src/ui/screens/Phase1Screen.tsx
git commit -m "feat: phase 1 four-questions screen"
```

---

### Task 12: Pyramid screen

**Files:**
- Create: `src/ui/screens/PyramidScreen.tsx`

**Interfaces:**
- Consumes: `rowValue` from engine; `Phase2Stage` type; `CardView`, `PlayerPicker`.
- Produces: `<PyramidScreen state stage dispatch />` — testids `pyramid-card-{i}` (0–9), `hand-strip-{i}`, `to-bus-button`, plus `pick-player-{i}` while a match is being assigned. The next flippable card is the only card with an `onClick`.

- [ ] **Step 1: Write `src/ui/screens/PyramidScreen.tsx`**

```tsx
import { rowValue } from '../../engine/engine';
import type { Action, GameState, Phase2Stage } from '../../engine/types';
import { CardView } from '../components/CardView';
import { PlayerPicker } from '../components/PlayerPicker';

// Render top row first; indexes into stage.pyramid (0-3 = bottom row).
const ROWS = [[9], [7, 8], [4, 5, 6], [0, 1, 2, 3]];

interface Props {
  state: GameState;
  stage: Phase2Stage;
  dispatch: (action: Action) => void;
}

export function PyramidScreen({ state, stage, dispatch }: Props) {
  const head = stage.matchQueue[0];
  const done = stage.flipped >= 10 && !head;

  return (
    <div className="screen">
      <p className="phase-label">Phase 2 — Pyramid</p>
      <div className="pyramid">
        {ROWS.map((row) => (
          <div key={row[0]} className="pyramid-row">
            {row.map((i) => (
              <CardView
                key={i}
                card={stage.pyramid[i]}
                faceDown={i >= stage.flipped}
                glow={i === stage.flipped && !head}
                small
                onClick={i === stage.flipped && !head ? () => dispatch({ type: 'FLIP_PYRAMID_CARD' }) : undefined}
                testId={`pyramid-card-${i}`}
              />
            ))}
            <span className="row-value">{rowValue(row[0])}🍺</span>
          </div>
        ))}
      </div>
      <div className="hands">
        {state.players.map((p, i) => (
          <div key={i} className="hand-strip" data-testid={`hand-strip-${i}`}>
            <span className="hand-name">{p.name}</span>
            {stage.hands[i].map((card, j) => (
              <CardView key={`${card.rank}-${card.suit}-${j}`} card={card} small />
            ))}
          </div>
        ))}
      </div>
      {head && (
        <PlayerPicker
          players={state.players}
          exclude={head.playerIndex}
          prompt={`${state.players[head.playerIndex].name} has a match! Assign ${head.drinks} drink${head.drinks > 1 ? 's' : ''} to…`}
          onPick={(toPlayer) => dispatch({ type: 'ASSIGN_DRINKS', toPlayer })}
        />
      )}
      {done && (
        <button className="btn btn-primary" data-testid="to-bus-button" onClick={() => dispatch({ type: 'ADVANCE' })}>
          Who rides the bus?
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify and commit**

Run: `npm run build`
Expected: clean.

```bash
git add src/ui/screens/PyramidScreen.tsx
git commit -m "feat: pyramid screen with match assignment flow"
```

---

### Task 13: Bus reveal, bus ride, and game over screens

**Files:**
- Create: `src/ui/screens/BusRevealScreen.tsx`, `src/ui/screens/BusScreen.tsx`, `src/ui/screens/GameOverScreen.tsx`

**Interfaces:**
- Consumes: `QUESTION_ANSWERS`; `BusRevealStage`, `Phase3Stage`, `GameOverStage` types; `CardView`; labels.
- Produces:
  - `<BusRevealScreen state stage dispatch />` — testids `bus-rider-name`, `bus-deal-button`.
  - `<BusScreen state stage dispatch />` — testids `question`, `bus-attempts`, `bus-card-{i}`, `answer-{answer}`, `verdict`, `feedback-continue`.
  - `<GameOverScreen state stage onPlayAgain onNewGame />` — testids `gameover-scoreboard`, `gameover-again`, `gameover-new`.

- [ ] **Step 1: Write `src/ui/screens/BusRevealScreen.tsx`**

```tsx
import type { Action, BusRevealStage, GameState } from '../../engine/types';

interface Props {
  state: GameState;
  stage: BusRevealStage;
  dispatch: (action: Action) => void;
}

export function BusRevealScreen({ state, stage, dispatch }: Props) {
  return (
    <div className="screen center">
      <p className="phase-label">Phase 3 — Ride the Bus</p>
      <h2 className="bus-rider reveal-pop" data-testid="bus-rider-name">
        {state.players[stage.riderIndex].name}
      </h2>
      <p className="question">rides the bus! 🚌</p>
      <button className="btn btn-primary" data-testid="bus-deal-button" onClick={() => dispatch({ type: 'ADVANCE' })}>
        Deal the cards
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Write `src/ui/screens/BusScreen.tsx`**

```tsx
import { QUESTION_ANSWERS } from '../../engine/engine';
import type { Action, GameState, Phase3Stage } from '../../engine/types';
import { CardView } from '../components/CardView';
import { ANSWER_LABELS, QUESTION_TEXT } from '../labels';

interface Props {
  state: GameState;
  stage: Phase3Stage;
  dispatch: (action: Action) => void;
}

export function BusScreen({ state, stage, dispatch }: Props) {
  const rider = state.players[stage.riderIndex];
  const revealedCount = stage.position + (stage.feedback ? 1 : 0);

  return (
    <div className="screen">
      <p className="phase-label">Phase 3 — Ride the Bus</p>
      <h2 className="turn-banner" data-testid="turn-banner">{rider.name} 🚌</h2>
      <p className="attempts" data-testid="bus-attempts">Attempt #{stage.attempts}</p>
      <p className="question" data-testid="question">{QUESTION_TEXT[stage.position]}</p>
      <div className="card-row">
        {stage.cards.map((card, i) => (
          <CardView
            key={`${stage.attempts}-${i}`}
            card={card}
            faceDown={i >= revealedCount}
            testId={`bus-card-${i}`}
          />
        ))}
      </div>
      {!stage.feedback && (
        <div className="answers">
          {QUESTION_ANSWERS[stage.position].map((answer) => (
            <button
              key={answer}
              className="btn btn-answer"
              data-testid={`answer-${answer}`}
              onClick={() => dispatch({ type: 'GUESS', answer })}
            >
              {ANSWER_LABELS[answer]}
            </button>
          ))}
        </div>
      )}
      {stage.feedback && (
        <div className="overlay">
          <div className="panel">
            <h2
              className={stage.feedback.correct ? 'verdict verdict-right' : 'verdict verdict-wrong'}
              data-testid="verdict"
            >
              {stage.feedback.correct
                ? stage.position === 3
                  ? 'OFF THE BUS! 🎉'
                  : 'CORRECT!'
                : 'DRINK! Back to the start 🍺'}
            </h2>
            <CardView card={stage.feedback.card} />
            <button
              className="btn btn-primary"
              data-testid="feedback-continue"
              onClick={() => dispatch({ type: 'ADVANCE' })}
            >
              {stage.feedback.correct ? 'Continue' : 'New cards'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write `src/ui/screens/GameOverScreen.tsx`**

```tsx
import type { GameOverStage, GameState } from '../../engine/types';

interface Props {
  state: GameState;
  stage: GameOverStage;
  onPlayAgain: () => void;
  onNewGame: () => void;
}

export function GameOverScreen({ state, stage, onPlayAgain, onNewGame }: Props) {
  const sorted = state.players
    .map((p, i) => ({ ...p, i }))
    .sort((a, b) => b.drinks - a.drinks);
  return (
    <div className="screen center">
      <h1 className="logo">GAME OVER</h1>
      <p className="question">
        {state.players[stage.riderIndex].name} escaped the bus after {stage.attempts} attempt
        {stage.attempts === 1 ? '' : 's'} 🚌
      </p>
      <div className="final-board" data-testid="gameover-scoreboard">
        {sorted.map((p) => (
          <div key={p.i} className="score">
            <span className="score-name">{p.name}</span>
            <span className="score-drinks">{p.drinks} 🍺</span>
          </div>
        ))}
      </div>
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

- [ ] **Step 4: Verify and commit**

Run: `npm run build`
Expected: clean.

```bash
git add src/ui/screens
git commit -m "feat: bus reveal, bus ride, and game over screens"
```

---

### Task 14: App assembly — routing, persistence wiring, seed, wake lock

**Files:**
- Create: `src/ui/seed.ts`, `src/ui/wakeLock.ts`
- Modify: `src/App.tsx` (replace the Task 1 placeholder entirely)

**Interfaces:**
- Consumes: everything produced so far.
- Produces:
  - `newSeed(): number` — `?seed=` URL param (all builds) or random.
  - `useWakeLock(active: boolean): void` — best-effort Screen Wake Lock, reacquired on visibility change, silent no-op when unsupported/denied.
  - `App` — screen routing: UI-level `home`/`setup` screens, then engine-stage-driven game screens. `useReducer` initialized from `loadGame()`; every state change runs `saveGame`.

- [ ] **Step 1: Write `src/ui/seed.ts`**

```ts
/** Seed from the (undocumented) ?seed= URL param — kept in all builds so E2E
 *  tests run against the production bundle — otherwise random. */
export function newSeed(): number {
  const param = new URLSearchParams(window.location.search).get('seed');
  if (param !== null) {
    const n = Number.parseInt(param, 10);
    if (Number.isFinite(n)) return n >>> 0;
  }
  return Math.floor(Math.random() * 2 ** 31);
}
```

- [ ] **Step 2: Write `src/ui/wakeLock.ts`**

```ts
import { useEffect } from 'react';

interface WakeLockSentinel {
  release(): Promise<void>;
}

interface WakeLockNavigator extends Navigator {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinel> };
}

/** Keep the screen awake during play. Best-effort: iOS Safari 16.4+ supports
 *  it; anywhere else this silently does nothing. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const wl = (navigator as WakeLockNavigator).wakeLock;
        if (!wl) return;
        const sentinel = await wl.request('screen');
        if (cancelled) {
          void sentinel.release();
        } else {
          lock = sentinel;
        }
      } catch {
        // Denied or unsupported — not worth surfacing at a party.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void lock?.release();
    };
  }, [active]);
}
```

- [ ] **Step 3: Replace `src/App.tsx`**

```tsx
import { useEffect, useReducer, useState } from 'react';
import { createInitialState, reduce } from './engine/engine';
import { BusRevealScreen } from './ui/screens/BusRevealScreen';
import { BusScreen } from './ui/screens/BusScreen';
import { GameOverScreen } from './ui/screens/GameOverScreen';
import { HomeScreen } from './ui/screens/HomeScreen';
import { Phase1Screen } from './ui/screens/Phase1Screen';
import { PyramidScreen } from './ui/screens/PyramidScreen';
import { SetupScreen } from './ui/screens/SetupScreen';
import { Scoreboard } from './ui/components/Scoreboard';
import { newSeed } from './ui/seed';
import { loadGame, saveGame } from './ui/storage';
import { useWakeLock } from './ui/wakeLock';

type Screen = 'home' | 'setup' | 'game';

export function App() {
  const [state, dispatch] = useReducer(reduce, undefined, () => loadGame() ?? createInitialState());
  const [screen, setScreen] = useState<Screen>('home');

  useEffect(() => {
    saveGame(state);
  }, [state]);

  const { stage } = state;
  const inProgress = stage.kind !== 'idle' && stage.kind !== 'gameOver';
  useWakeLock(screen === 'game' && inProgress);

  if (screen === 'home') {
    return (
      <HomeScreen
        canResume={inProgress}
        onResume={() => setScreen('game')}
        onNewGame={() => setScreen('setup')}
      />
    );
  }

  if (screen === 'setup' || stage.kind === 'idle') {
    return (
      <SetupScreen
        onStart={(names) => {
          dispatch({ type: 'START_GAME', names, seed: newSeed() });
          setScreen('game');
        }}
        onBack={() => setScreen('home')}
      />
    );
  }

  return (
    <div className="app">
      {stage.kind !== 'gameOver' && <Scoreboard players={state.players} />}
      {stage.kind === 'phase1' && <Phase1Screen state={state} stage={stage} dispatch={dispatch} />}
      {stage.kind === 'phase2' && <PyramidScreen state={state} stage={stage} dispatch={dispatch} />}
      {stage.kind === 'busReveal' && <BusRevealScreen state={state} stage={stage} dispatch={dispatch} />}
      {stage.kind === 'phase3' && <BusScreen state={state} stage={stage} dispatch={dispatch} />}
      {stage.kind === 'gameOver' && (
        <GameOverScreen
          state={state}
          stage={stage}
          onPlayAgain={() =>
            dispatch({ type: 'START_GAME', names: state.players.map((p) => p.name), seed: newSeed() })
          }
          onNewGame={() => setScreen('setup')}
        />
      )}
    </div>
  );
}
```

Note: "New Game" from Home does NOT clear an in-progress save — the old game stays resumable until Start actually begins a new one (accidental taps are recoverable via Back).

- [ ] **Step 4: Verify and commit**

Run: `npm run build`
Expected: clean.

Run: `npm test`
Expected: all suites pass.

Optional manual smoke: `npm run dev`, open `http://localhost:5173/Ridethebusgame/`, add two players, answer a question. (Behavioral verification is automated in Task 16.)

```bash
git add src/App.tsx src/ui/seed.ts src/ui/wakeLock.ts
git commit -m "feat: assemble app routing with persistence, seed, wake lock"
```

---

### Task 15: PWA — icons, manifest, service worker

**Files:**
- Create: `scripts/generate-icons.mjs`, `public/` icons (generated, committed)
- Modify: `vite.config.ts` (add VitePWA), `src/main.tsx` (register SW), `src/vite-env.d.ts` (pwa client types)

**Interfaces:**
- Consumes: npm script `icons` from Task 1.
- Produces: `dist/manifest.webmanifest` + `dist/sw.js` (precache all assets); `public/icon-192.png`, `public/icon-512.png`, `public/icon-512-maskable.png`, `public/apple-touch-icon.png`.

- [ ] **Step 1: Write `scripts/generate-icons.mjs`**

Pure-shape neon bus SVG (no fonts/emoji, so it renders identically everywhere):

```js
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

// scale < 1 shrinks the artwork toward the center (maskable safe zone).
function busSvg(scale = 1) {
  const g = (1 - scale) * 256;
  return `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0a0a14"/>
  <g transform="translate(${g} ${g}) scale(${scale})">
    <rect x="56" y="128" width="400" height="224" rx="44" fill="none" stroke="#22e6ff" stroke-width="18"/>
    <line x1="72" y1="248" x2="440" y2="248" stroke="#22e6ff" stroke-width="10"/>
    <rect x="104" y="168" width="72" height="52" rx="12" fill="#ff2d78"/>
    <rect x="220" y="168" width="72" height="52" rx="12" fill="#ff2d78"/>
    <rect x="336" y="168" width="72" height="52" rx="12" fill="#ff2d78"/>
    <circle cx="150" cy="376" r="40" fill="#0a0a14" stroke="#a26bff" stroke-width="16"/>
    <circle cx="362" cy="376" r="40" fill="#0a0a14" stroke="#a26bff" stroke-width="16"/>
  </g>
</svg>`;
}

await mkdir('public', { recursive: true });
const normal = Buffer.from(busSvg());
const maskable = Buffer.from(busSvg(0.72));

await sharp(normal).resize(192, 192).png().toFile('public/icon-192.png');
await sharp(normal).resize(512, 512).png().toFile('public/icon-512.png');
await sharp(maskable).resize(512, 512).png().toFile('public/icon-512-maskable.png');
await sharp(normal).resize(180, 180).png().toFile('public/apple-touch-icon.png');
console.log('icons written to public/');
```

- [ ] **Step 2: Generate the icons**

Run: `npm run icons`
Expected: "icons written to public/", four PNGs exist in `public/`.

- [ ] **Step 3: Add VitePWA to `vite.config.ts`**

Full new file content:

```ts
/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/Ridethebusgame/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Ride the Bus',
        short_name: 'RideTheBus',
        description: 'Pass-and-play drinking card game',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0a0a14',
        theme_color: '#0a0a14',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 4: Register the service worker**

`src/vite-env.d.ts` becomes:

```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
```

Add to the top of `src/main.tsx` (after the existing imports):

```ts
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });
```

- [ ] **Step 5: Verify the build output**

Run: `npm run build`
Expected: clean; `dist/` now contains `sw.js`, `workbox-*.js`, and `manifest.webmanifest`; `dist/index.html` contains a `<link rel="manifest"` tag.

Run: `ls dist/sw.js dist/manifest.webmanifest`
Expected: both files listed.

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-icons.mjs public vite.config.ts src/main.tsx src/vite-env.d.ts
git commit -m "feat: PWA manifest, generated icons, offline service worker"
```

---

### Task 16: Playwright E2E verification (iPhone WebKit)

**Files:**
- Create: `playwright.config.ts`, `e2e/helpers.ts`, `e2e/fullGame.spec.ts`, `e2e/resume.spec.ts`, `e2e/pwa.spec.ts`

**Interfaces:**
- Consumes: the engine (imported directly into tests as the "mirror"), all testids from Tasks 9–13, `?seed=` param from Task 14, SW/manifest from Task 15.
- Produces: `npm run test:e2e` — builds, serves `vite preview`, and runs:
  - `iphone-webkit` project (WebKit + iPhone 14 emulation — Safari's engine): full game + resume + manifest tests.
  - `chromium-pwa` project: only tests tagged `@offline` (Playwright's offline emulation + service workers is only reliable in Chromium).

The full-game test drives the real UI while replaying every action into a local engine "mirror" seeded identically — after every tap it asserts the UI matches the mirror. This proves UI behavior === engine behavior for a complete game.

- [ ] **Step 1: Write `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  use: {
    baseURL: 'http://localhost:4173/Ridethebusgame/',
  },
  projects: [
    { name: 'iphone-webkit', use: { ...devices['iPhone 14'] }, grepInvert: /@offline/ },
    { name: 'chromium-pwa', use: { ...devices['Pixel 7'] }, grep: /@offline/ },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173/Ridethebusgame/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 2: Install the Playwright browsers**

Run: `npx playwright install webkit chromium`
Expected: WebKit and Chromium download and install (this is the "download any tools needed for verification" step).

- [ ] **Step 3: Write `e2e/helpers.ts`**

```ts
import { QUESTION_ANSWERS, reduce } from '../src/engine/engine';
import type { GameState, GuessAnswer } from '../src/engine/types';

/** The answer the engine says is correct for the current question — or the
 *  first option when every answer loses (tie cards). */
export function bestAnswer(state: GameState, questionIndex: number): GuessAnswer {
  const candidates = QUESTION_ANSWERS[questionIndex];
  for (const answer of candidates) {
    const next = reduce(state, { type: 'GUESS', answer });
    const stage = next.stage;
    if ((stage.kind === 'phase1' || stage.kind === 'phase3') && stage.feedback?.correct) {
      return answer;
    }
  }
  return candidates[0];
}
```

- [ ] **Step 4: Write `e2e/fullGame.spec.ts`**

```ts
import { expect, test, type Page } from '@playwright/test';
import { createInitialState, reduce } from '../src/engine/engine';
import type { GameState } from '../src/engine/types';
import { bestAnswer } from './helpers';

const SEED = 42;
const NAMES = ['Amy', 'Bob', 'Cat'];

async function startGame(page: Page): Promise<GameState> {
  await page.goto(`?seed=${SEED}`);
  await page.getByTestId('home-new-game').click();
  for (const name of NAMES) {
    await page.getByTestId('setup-name-input').fill(name);
    await page.getByTestId('setup-add-player').click();
  }
  await page.getByTestId('setup-start').click();
  return reduce(createInitialState(), { type: 'START_GAME', names: NAMES, seed: SEED });
}

test('full game: phase 1 → pyramid → bus → game over, UI locked to engine', async ({ page }) => {
  let mirror = await startGame(page);
  expect(mirror.stage.kind).toBe('phase1');

  const assertScoreboard = async () => {
    for (let i = 0; i < NAMES.length; i++) {
      await expect(page.getByTestId(`scoreboard-drinks-${i}`)).toHaveText(String(mirror.players[i].drinks));
    }
  };

  // ---- Phase 1: every player answers all four questions ----
  let guard = 0;
  while (mirror.stage.kind === 'phase1') {
    if (guard++ > 200) throw new Error('phase 1 did not finish');
    const stage = mirror.stage;
    await expect(page.getByTestId('turn-banner')).toHaveText(mirror.players[stage.playerIndex].name);
    const answer = bestAnswer(mirror, stage.questionIndex);
    await page.getByTestId(`answer-${answer}`).click();
    mirror = reduce(mirror, { type: 'GUESS', answer });
    if (mirror.stage.kind !== 'phase1') throw new Error('unreachable');
    if (mirror.stage.feedback?.correct) {
      const target = (stage.playerIndex + 1) % NAMES.length;
      await page.getByTestId(`pick-player-${target}`).click();
      mirror = reduce(mirror, { type: 'ASSIGN_DRINKS', toPlayer: target });
    } else {
      await page.getByTestId('feedback-continue').click();
      mirror = reduce(mirror, { type: 'ADVANCE' });
    }
    await assertScoreboard();
  }
  expect(mirror.stage.kind).toBe('phase2');

  // ---- Phase 2: flip all 10, assign every match ----
  guard = 0;
  while (mirror.stage.kind === 'phase2') {
    if (guard++ > 200) throw new Error('phase 2 did not finish');
    const stage = mirror.stage;
    if (stage.matchQueue.length > 0) {
      const head = stage.matchQueue[0];
      const target = (head.playerIndex + 1) % NAMES.length;
      await page.getByTestId(`pick-player-${target}`).click();
      mirror = reduce(mirror, { type: 'ASSIGN_DRINKS', toPlayer: target });
      await assertScoreboard();
    } else if (stage.flipped < 10) {
      await page.getByTestId(`pyramid-card-${stage.flipped}`).click();
      mirror = reduce(mirror, { type: 'FLIP_PYRAMID_CARD' });
    } else {
      await page.getByTestId('to-bus-button').click();
      mirror = reduce(mirror, { type: 'ADVANCE' });
    }
  }
  expect(mirror.stage.kind).toBe('busReveal');
  if (mirror.stage.kind !== 'busReveal') throw new Error('unreachable');

  // ---- Bus reveal: UI must announce the same rider the engine picked ----
  await expect(page.getByTestId('bus-rider-name')).toHaveText(NAMES[mirror.stage.riderIndex]);
  await page.getByTestId('bus-deal-button').click();
  mirror = reduce(mirror, { type: 'ADVANCE' });

  // ---- Phase 3: ride the bus (bestAnswer means ties are the only misses) ----
  guard = 0;
  while (mirror.stage.kind === 'phase3') {
    if (guard++ > 400) throw new Error('bus ride did not finish');
    const stage = mirror.stage;
    await expect(page.getByTestId('bus-attempts')).toHaveText(`Attempt #${stage.attempts}`);
    const answer = bestAnswer(mirror, stage.position);
    await page.getByTestId(`answer-${answer}`).click();
    mirror = reduce(mirror, { type: 'GUESS', answer });
    await page.getByTestId('feedback-continue').click();
    mirror = reduce(mirror, { type: 'ADVANCE' });
    if (mirror.stage.kind === 'phase3') await assertScoreboard();
  }
  expect(mirror.stage.kind).toBe('gameOver');

  // ---- Game over: board visible, play-again restarts ----
  await expect(page.getByTestId('gameover-scoreboard')).toBeVisible();
  await page.getByTestId('gameover-again').click();
  await expect(page.getByTestId('turn-banner')).toHaveText(NAMES[0]);
});
```

- [ ] **Step 5: Write `e2e/resume.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

test('an in-progress game survives a reload via Resume', async ({ page }) => {
  await page.goto('?seed=7');
  await page.getByTestId('home-new-game').click();
  for (const name of ['Amy', 'Bob']) {
    await page.getByTestId('setup-name-input').fill(name);
    await page.getByTestId('setup-add-player').click();
  }
  await page.getByTestId('setup-start').click();

  // Answer one question so there is real progress to lose.
  await page.getByTestId('answer-red').click();
  const resolve = page.getByTestId('feedback-continue').or(page.getByTestId('pick-player-1'));
  await resolve.first().click();

  const question = await page.getByTestId('question').textContent();
  const drinks0 = await page.getByTestId('scoreboard-drinks-0').textContent();
  const drinks1 = await page.getByTestId('scoreboard-drinks-1').textContent();

  await page.reload();
  await page.getByTestId('home-resume').click();

  await expect(page.getByTestId('question')).toHaveText(question ?? '');
  await expect(page.getByTestId('scoreboard-drinks-0')).toHaveText(drinks0 ?? '');
  await expect(page.getByTestId('scoreboard-drinks-1')).toHaveText(drinks1 ?? '');
  await expect(page.getByTestId('turn-banner')).toHaveText('Bob');
});
```

- [ ] **Step 6: Write `e2e/pwa.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

test('serves a web app manifest', async ({ page }) => {
  await page.goto('');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toContain('manifest.webmanifest');
});

test('app loads from the service worker cache while offline @offline', async ({ page, context }) => {
  await page.goto('');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    return true;
  });
  await page.waitForFunction(async () => (await caches.keys()).length > 0);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('home-new-game')).toBeVisible();
  await context.setOffline(false);
});
```

- [ ] **Step 7: Run the E2E suite**

Run: `npm run test:e2e`
Expected: PASS — 3 tests on `iphone-webkit` (full game, resume, manifest — the `@offline` test is filtered out) and 1 test on `chromium-pwa`. The full-game test takes the longest (~1–2 min).

If the full-game test fails on a scoreboard assertion, the UI and engine disagree — debug the engine/UI, never loosen the assertion.

- [ ] **Step 8: Commit**

```bash
git add playwright.config.ts e2e
git commit -m "test: e2e full-game lockstep, resume, and offline PWA verification"
```

---

### Task 17: CI/CD, README, final verification

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: all npm scripts.
- Produces: push to `main` → tests gate → GitHub Pages deploy at `https://<user>.github.io/Ridethebusgame/`.

- [ ] **Step 1: Write `.github/workflows/deploy.yml`**

```yaml
name: Test & Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npx playwright install --with-deps webkit chromium
      - run: npm run test:e2e
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: test
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Write `README.md`** (replace the stub)

```markdown
# Ride the Bus 🚌

Pass-and-play drinking game PWA. One phone is the deck and the table — deal,
guess, assign drinks, survive the pyramid, and someone rides the bus.

**Play:** https://<your-github-username>.github.io/Ridethebusgame/
(add to home screen via Share → *Add to Home Screen* for the full-screen app;
works offline after the first visit)

## Development

- `npm run dev` — dev server at `http://localhost:5173/Ridethebusgame/`
- `npm test` — engine unit tests (Vitest)
- `npm run test:e2e` — Playwright E2E on WebKit (iPhone emulation); first run
  needs `npx playwright install webkit chromium`
- `npm run build` — type-check + production build
- `npm run icons` — regenerate PWA icons into `public/`

The game rules engine lives in `src/engine/` — pure TypeScript, no React, all
randomness seeded. React screens in `src/ui/` can only dispatch engine actions.

## Deployment

Pushing to `main` runs unit + E2E tests and deploys to GitHub Pages.
One-time repo setup:

1. Create a GitHub repo named exactly `Ridethebusgame` (the Vite `base` path
   depends on it) and push.
2. Repo Settings → Pages → Source: **GitHub Actions**.
```

- [ ] **Step 3: Full local verification**

Run: `npm test`
Expected: all unit suites pass.

Run: `npm run test:e2e`
Expected: all E2E tests pass.

Run: `npm run build`
Expected: clean build with `sw.js` and `manifest.webmanifest` in `dist/`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/deploy.yml README.md
git commit -m "ci: test-gated GitHub Pages deployment and README"
```

- [ ] **Step 5: Publish (needs the user's GitHub remote)**

If `git remote -v` shows no remote: report to the user that the code is ready
to publish and they should create a GitHub repo named `Ridethebusgame`, push
`main`, and set Pages → Source to **GitHub Actions** (or authorize `gh repo
create Ridethebusgame --public --source . --push`). After the first push,
verify the Actions run goes green and the game loads at the Pages URL on an
iPhone.
```
