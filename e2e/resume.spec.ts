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
