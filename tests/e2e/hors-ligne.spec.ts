import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';

/** Première visite : le service worker s'installe et précache l'application, puis prend le contrôle. */
async function installerHorsLigne(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
}

test('US-001 hors ligne : la page s’affiche après une première visite et indique « serveur injoignable »', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await installerHorsLigne(page);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('Poule Position');
  await expect(page.getByRole('status')).toHaveText('Serveur injoignable');
  await context.setOffline(false);
});

test('US-003 hors ligne : la connexion est impossible et l’écran l’indique', async ({ page, context }) => {
  await page.goto('/connexion');
  await installerHorsLigne(page);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('alert')).toHaveText(
    'Hors ligne : connexion possible uniquement sur un appareil déjà utilisé',
  );
  await page.getByLabel('E-mail').fill('orga@club.fr');
  await page.getByLabel('Mot de passe').fill('un mot de passe');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Hors ligne : connexion possible uniquement sur un appareil déjà utilisé',
  );
  await expect(page).toHaveURL(/\/connexion$/);
  await context.setOffline(false);
});

test('US-003 hors ligne : une session déjà ouverte reste utilisable sans réseau', async ({ page, context }) => {
  await seConnecter(page);
  await installerHorsLigne(page);

  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveURL(/\/organisateur$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Bonjour, .+/);
  await context.setOffline(false);
});
