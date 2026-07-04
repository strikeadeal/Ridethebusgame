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
