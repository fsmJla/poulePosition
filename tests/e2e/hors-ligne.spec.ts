import { expect, test } from '@playwright/test';

test('US-001 hors ligne : la page s’affiche après une première visite et indique « serveur injoignable »', async ({
  page,
  context,
}) => {
  await page.goto('/');
  // Première visite : le service worker s'installe et précache l'application, puis prend le contrôle.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('poulePosition');
  await expect(page.getByRole('status')).toHaveText('Serveur injoignable');
  await context.setOffline(false);
});
