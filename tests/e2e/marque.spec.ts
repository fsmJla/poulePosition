// US-014 : bannière « Poule Position », entête des pages réservées, nom affiché.
import { expect, test, type Locator } from '@playwright/test';
import { seConnecter } from './compte';

/** Adresse de l'image réellement affichée par une balise <picture> (variante claire ou sombre). */
const imageAffichee = (image: Locator) => image.evaluate((element: HTMLImageElement) => element.currentSrc);
const chargee = (image: Locator) =>
  image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0);

test('US-014 CA-1 : l’accueil affiche la bannière, le filet et le sous-titre', async ({ page }) => {
  await page.goto('/');
  const titre = page.getByRole('heading', { level: 1 });
  await expect(titre).toHaveAccessibleName('Poule Position');
  const banniere = titre.getByRole('img', { name: 'Poule Position' });
  await expect.poll(() => chargee(banniere)).toBe(true);
  await expect(page.getByText('Gestion de compétitions d’escrime')).toBeVisible();
  await expect(page.getByText('poulePosition', { exact: true })).toHaveCount(0);
});

test('US-014 CA-2 : la bannière suit le mode clair ou sombre de l’appareil', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  const banniere = page.getByRole('heading', { level: 1 }).getByRole('img');
  await expect.poll(() => imageAffichee(banniere)).toMatch(/\/brand\/login-light\.svg$/);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => imageAffichee(banniere)).toMatch(/\/brand\/login-dark\.svg$/);
});

test('US-014 CA-3 : l’entête des pages réservées porte la bannière et « Se déconnecter »', async ({ page }) => {
  await seConnecter(page);
  const entete = page.getByRole('banner');
  const lienBanniere = entete.getByRole('link', { name: 'Poule Position' });
  await expect(lienBanniere).toBeVisible();
  await expect.poll(() => imageAffichee(lienBanniere.getByRole('img'))).toMatch(/\/brand\/header-dark\.svg$/);
  await expect(entete.getByRole('button', { name: 'Se déconnecter', exact: true })).toBeVisible();
  // Aucun défilement horizontal (smartphone compris).
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole('link', { name: 'Changer mon mot de passe' }).click();
  await expect(page).toHaveURL(/\/mot-de-passe$/);
  await page.getByRole('banner').getByRole('link', { name: 'Poule Position' }).click();
  await expect(page).toHaveURL(/\/organisateur$/);
});

test('US-014 CA-4 : le nom affiché est « Poule Position »', async ({ page, request }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Poule Position');
  await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute('content', 'Poule Position');
  const adresse = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifeste = await (await request.get(adresse as string)).json();
  expect(manifeste).toMatchObject({ name: 'Poule Position', short_name: 'Poule Position' });
});

test('US-014 hors ligne : la bannière s’affiche sans réseau', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect.poll(() => chargee(page.getByRole('heading', { level: 1 }).getByRole('img'))).toBe(true);
  await context.setOffline(false);
});
