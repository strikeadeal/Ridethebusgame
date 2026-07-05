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
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async () => {} },
      configurable: true,
    });
  });

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

  await page.getByTestId('gameover-share').click();
  await expect(page.getByTestId('gameover-share')).toHaveText('Copied!');

  await page.getByTestId('gameover-again').click();
  await expect(page.getByTestId('turn-banner')).toHaveText(NAMES[0]);
});
