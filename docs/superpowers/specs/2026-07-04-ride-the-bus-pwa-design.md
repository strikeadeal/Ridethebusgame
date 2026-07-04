# Ride the Bus — PWA Design

**Date:** 2026-07-04
**Status:** Approved

## Summary

A pass-and-play progressive web app for the drinking game *Ride the Bus*. One shared
iPhone acts as the deck and table; the app runs the whole game — dealing, guess
evaluation, drink tallies, pyramid matching, and bus-rider selection. Static site
hosted on GitHub Pages, playable offline after first load, accessed from iPhone
Safari (installable to the home screen but fully functional in-tab).

## Decisions made during brainstorming

| Decision | Choice |
|---|---|
| Play model | One shared phone, pass-and-play. No backend, no accounts. |
| Pyramid hands | Auto-detect: the app announces who holds a matching rank; matches auto-play. |
| Drink tracking | Full tally + assignment. App records every drink and picks the bus rider. |
| Visual style | Neon party: dark background, glowing suit-colored accents, flip animations. |
| Tech stack | React 19 + TypeScript + Vite (user's choice; engine stays framework-free). |

## Architecture

### Engine (`src/engine/`) — pure TypeScript, zero React imports

- One immutable `GameState` object and a reducer: `reduce(state, action) → newState`.
- Actions (indicative): `START_GAME`, `GUESS { answer }`, `ASSIGN_DRINKS { toPlayer }`,
  `FLIP_PYRAMID_CARD`, `ADVANCE`, `PLAY_AGAIN`.
- Invalid actions for the current state are rejected (state returned unchanged with an
  error flag); the UI cannot create an illegal game state.
- All shuffling uses a **seeded PRNG** whose state lives inside `GameState`. Any game is
  reproducible from its seed. An undocumented `?seed=` URL parameter (honored in all
  builds, including production, so E2E tests can run against the real build) fixes the
  seed for deterministic runs; without it a random seed is used.

### UI (`src/ui/`) — React

- Single `useReducer` over the engine. Each engine state maps to one full-screen view.
- A persistent slim scoreboard bar shows all players' drink counts.
- After every dispatched action the serialized `GameState` is written to
  `localStorage`; the home screen offers **Resume game** when a save exists.
- Screen Wake Lock API requested during play (iOS Safari 16.4+; silent no-op if
  unavailable or denied).

### Data flow

Tap → dispatch engine action → new immutable state → React renders the screen for that
state → state saved to localStorage.

## Game rules (as implemented)

### General

- 2–8 players, names entered at setup.
- Standard 52-card deck; **Ace is high**.
- A fresh deck is shuffled at the start of each phase.
- Every drink is recorded against a player on a running scoreboard.

### Phase 1 — Four Questions

- Each player is dealt 4 face-down cards in a row.
- Played in rounds: every player answers Question 1, then the group goes around again
  for Question 2, etc.
  1. **Red or Black?** — color of card 1.
  2. **Higher or Lower?** — card 2 vs. card 1.
  3. **Inside or Outside?** — card 3 vs. the range spanned by cards 1 and 2.
  4. **Guess the Suit** — suit of card 4.
- **Ties count as wrong**: card 2 equal in rank to card 1 fails higher/lower; card 3
  equal in rank to either boundary fails inside/outside.
- Wrong guess → +1 drink to the guesser.
- Correct guess → guesser assigns 1 drink to any other player (not themselves).

### Phase 2 — Pyramid

- 10 cards in rows of 4-3-2-1, flipped **bottom-up**, one card per tap.
- Drink values: bottom row 1, then 2, then 3, top card 4.
- Hand sizes by player count: 2–4 players → 5 cards each; 5–6 → 4 each; 7–8 → 3 each
  (worst case 10 + 8×3 = 34 ≤ 52).
- On each flip the app lists every player holding that rank (hands are effectively
  public; no bluffing). Matches auto-play — holding cards back has no purpose because
  the bus rider is chosen by drink count, not cards remaining.
- Each matcher assigns the row's full drink value to one chosen player. Multiple
  matchers each assign independently (drinks stack).

### Phase 3 — Ride the Bus

- Rider = player with the **most total drinks** across Phases 1–2. Ties broken
  randomly, revealed with a short spinner animation.
- Rider faces the same 4 questions in sequence on a fresh row of 4 face-down cards.
- Wrong guess → +1 drink, all four cards are **discarded and replaced with fresh
  cards**, back to Question 1. (Fresh cards prevent memorizing the row.)
- Deck reshuffles (discards folded back in) when exhausted.
- Answering all 4 correctly ends the game.

### Game over

Final scoreboard sorted by drinks, bus attempt count, **Play again** (same players,
new seed) and **New game** (back to setup).

## Screens

1. **Home** — logo, New Game, Resume game (when a save exists), rules cheatsheet
   behind an info button.
2. **Setup** — add/edit/remove 2–8 player names, Start button.
3. **Phase 1 turn** — banner with player name + current question, that player's
   previously revealed cards shown small, 2–4 large answer buttons. Card-flip
   animation, then a verdict splash: "DRINK 🍺" or "CORRECT — give a drink" with a
   player-picker grid.
4. **Pyramid** — full pyramid laid out with row values labeled; below it, each
   player's remaining hand shown face-up in a compact strip (hands are public per the
   auto-detect decision). Tap the next face-down card to flip. Match announcements
   process matchers one at a time, each with a player-picker; played cards leave the
   matcher's strip.
5. **Bus reveal** — spinner lands on the rider's name.
6. **Bus** — 4 card slots with progress markers, question flow as Phase 1, visible
   attempt counter, "back to the start" animation on a wrong guess.
7. **Game over** — scoreboard, stats, Play again / New game.

**Style:** near-black background; glowing accents (red/pink for hearts/diamonds,
cyan/violet for spades/clubs); portrait-only; thumb-sized tap targets; CSS safe-area
insets for the notch; double-tap zoom disabled.

## PWA

- `vite-plugin-pwa`: web manifest (name, theme color, portrait orientation,
  `standalone` display) + precaching service worker → fully offline after first visit.
- iOS specifics: `apple-touch-icon`, `apple-mobile-web-app-capable` /
  `apple-mobile-web-app-status-bar-style` meta tags, `viewport-fit=cover`.

## Deployment

- GitHub Actions on push to `main`: install → unit tests → E2E tests → build →
  deploy to GitHub Pages (`actions/configure-pages` + `actions/deploy-pages`).
  Failing tests block deployment.
- Vite `base: '/Ridethebusgame/'` so assets resolve at
  `https://<user>.github.io/Ridethebusgame/`.

## Verification

- **Vitest** unit tests on the engine: deck integrity (52 unique cards, seeded shuffle
  reproducibility); every guess rule including all tie cases; pyramid match detection
  and drink stacking; hand-size table; bus-rider selection including ties; bus reset
  dealing fresh cards; reshuffle-on-exhaustion; state-machine legality (illegal
  actions rejected in every state).
- **Playwright E2E on WebKit** (Safari's engine) with iPhone device emulation,
  browsers downloaded during setup. Seeded games play scripted full runs — Phase 1 →
  Pyramid → Bus → Game Over — asserting screens, drink counts, and rider selection.
  Additional tests: localStorage resume after reload; service-worker registration and
  offline reload from cache.

## Out of scope

- Multi-device/networked play, accounts, or any backend.
- Bluffing/manual claim flow in the pyramid phase.
- Configurable house rules (pyramid direction, tie handling, hand sizes are fixed as
  specified above).
- Sound effects (can be a later addition).
