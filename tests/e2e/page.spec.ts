import { expect, test } from '@playwright/test';

test('US-001 CA-2 : la page minimale affiche le nom de l’application (« Poule Position », US-014)', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('Poule Position');
});

// US-031 a retiré la pastille « Serveur connecté » de l'accueil : serveur joignable, la liste des épreuves se charge
// sans message d'erreur. La liaison avec le serveur reste couverte par serveur/ et app/src/lib/connexion.test.ts.
test('US-001 CA-8 (US-065) : l’accueil charge la liste des épreuves auprès du serveur', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 2, name: 'Épreuves à venir' })).toBeVisible();
  await expect(page.getByText('Chargement des épreuves…')).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByRole('alert')).toHaveCount(0);
});
