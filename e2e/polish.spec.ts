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
