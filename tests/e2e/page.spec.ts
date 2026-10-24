import { expect, test } from '@playwright/test';

test('US-001 CA-2 : la page minimale affiche « poulePosition »', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('poulePosition');
});

test('US-001 CA-8 : la page affiche « Serveur connecté »', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('Serveur connecté');
});
