// Trois icônes de thème toujours visibles sur PC (US-067) : soleil, lune et écran dans l'entête, sans menu à ouvrir.
// Sur un écran étroit, le choix reste dans le menu de compte (US-054 CA-7). Comptes simulés (simulation.ts).
import { expect, test, type Page } from '@playwright/test';
import { boutonMenuCompte } from './compte';
import { connecterSimule } from './simulation';

const entete = (page: Page) => page.getByRole('banner');
const groupe = (page: Page) => entete(page).getByRole('group', { name: 'Thème' });
const boutons = (page: Page) => groupe(page).getByRole('button');
const NOMS = ['Thème clair', 'Thème sombre', 'Thème automatique'];

test('US-067 CA-1 : à 1 360 px, trois icônes seules sont visibles sans interaction, celle du thème en cours est pressée', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1360, height: 900 });
  await connecterSimule(page, 'organisateur');
  await expect(boutons(page)).toHaveCount(3);
  for (const nom of NOMS) await expect(groupe(page).getByRole('button', { name: nom, exact: true })).toBeVisible();
  await expect(boutons(page)).toHaveText(['', '', '']);
  await expect(entete(page).getByRole('menu')).toHaveCount(0);
  const xs: number[] = [];
  for (const bouton of await boutons(page).all()) xs.push((await bouton.boundingBox())!.x);
  expect(xs).toEqual([...xs].sort((a, b) => a - b));
  await expect(groupe(page).getByRole('button', { name: 'Thème automatique' })).toHaveAttribute('aria-pressed', 'true');
  await expect(groupe(page).getByRole('button', { name: 'Thème clair' })).toHaveAttribute('aria-pressed', 'false');

  // Pages publiques : le sélecteur y est déjà (US-052).
  await page.goto('/connexion');
  await expect(boutons(page).or(page.getByRole('group', { name: 'Thème' }).getByRole('button'))).toHaveCount(3);
});

test('US-067 CA-2 : un clic change le thème aussitôt, sans recharger, et le choix est retenu sur l’appareil', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1360, height: 900 });
  await connecterSimule(page, 'organisateur');
  await page.evaluate(() => ((window as unknown as { marque: string }).marque = 'pas-recharge'));
  await groupe(page).getByRole('button', { name: 'Thème sombre' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sombre');
  expect(await page.evaluate(() => (window as unknown as { marque: string }).marque)).toBe('pas-recharge');
  await expect(groupe(page).getByRole('button', { name: 'Thème sombre' })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('poule-position:theme'))).toBe('sombre');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sombre');
  await expect(groupe(page).getByRole('button', { name: 'Thème sombre' })).toHaveAttribute('aria-pressed', 'true');

  // « Automatique » suit le système, les deux autres non.
  await groupe(page).getByRole('button', { name: 'Thème automatique' }).click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(15, 23, 22)');
  await groupe(page).getByRole('button', { name: 'Thème clair' }).click();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'clair');
});

test('US-067 CA-3 : nom accessible, infobulle, cible de 44 × 44 px et parcours au clavier', async ({ page }) => {
  await page.setViewportSize({ width: 1360, height: 900 });
  await connecterSimule(page, 'organisateur');
  await expect(groupe(page)).toBeVisible();
  const boutonsListe = await boutons(page).all();
  for (const [i, bouton] of boutonsListe.entries()) {
    await expect(bouton).toHaveAttribute('aria-label', NOMS[i]!);
    await expect(bouton).toHaveAttribute('title', NOMS[i]!);
    const boite = (await bouton.boundingBox())!;
    expect(boite.width).toBeGreaterThanOrEqual(44);
    expect(boite.height).toBeGreaterThanOrEqual(44);
  }
  await boutons(page).first().focus();
  await page.keyboard.press('Tab');
  await expect(boutons(page).nth(1)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(boutons(page).nth(2)).toBeFocused();
});

test('US-067 CA-4 : à 390 px, l’entête n’a pas les trois icônes ; le choix est dans le menu de compte, sans défilement horizontal', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await connecterSimule(page, 'administrateur');
  await expect(groupe(page)).toHaveCount(0);
  await expect(boutonMenuCompte(page)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await boutonMenuCompte(page).click();
  const themes = page.locator('#menu-compte').getByRole('group', { name: 'Thème' });
  await expect(themes.getByRole('button')).toHaveCount(3);
});

test('US-067 CA-5 : à 1 040 px, administrateur, l’entête tient sur une ligne sans chevauchement ni recherche trop étroite', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1040, height: 900 });
  await connecterSimule(page, 'administrateur');
  await expect(groupe(page)).toBeVisible();
  const recherche = entete(page).getByRole('combobox');
  await expect(recherche).toBeVisible();
  const elements = [
    entete(page).getByRole('link', { name: 'Poule Position' }),
    recherche,
    entete(page).getByRole('link', { name: 'Créer', exact: true }),
    entete(page).getByRole('link', { name: 'Comptes' }),
    entete(page).getByRole('link', { name: 'Comment ça s’organise' }),
    groupe(page),
    boutonMenuCompte(page),
  ];
  const boites = [];
  for (const element of elements) boites.push((await element.boundingBox())!);
  // Même ligne : leurs centres verticaux sont proches, et la hauteur de l'entête reste celle d'une ligne.
  const centres = boites.map((b) => b.y + b.height / 2);
  expect(Math.max(...centres) - Math.min(...centres)).toBeLessThan(12);
  expect((await entete(page).boundingBox())!.height).toBeLessThanOrEqual(72);
  // Ni chevauchement (de gauche à droite), ni débordement de la page.
  const tries = [...boites].sort((a, b) => a.x - b.x);
  for (let i = 1; i < tries.length; i++)
    expect(tries[i]!.x).toBeGreaterThanOrEqual(tries[i - 1]!.x + tries[i - 1]!.width - 1);
  const dernier = tries.at(-1)!;
  expect(dernier.x + dernier.width).toBeLessThanOrEqual(1040);
  // Le champ de recherche garde au moins sa largeur minimale (8 rem = 128 px).
  expect(boites[1]!.width).toBeGreaterThanOrEqual(128);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('US-067 hors ligne : le choix du thème fonctionne réseau coupé', async ({ page, context }) => {
  await page.setViewportSize({ width: 1360, height: 900 });
  await connecterSimule(page, 'organisateur');
  await context.setOffline(true);
  await groupe(page).getByRole('button', { name: 'Thème sombre' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sombre');
});

test('US-067 cas limite : stockage local indisponible, le choix s’applique pour la session', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() {
        throw new Error('stockage indisponible');
      },
    });
  });
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.goto('/connexion');
  await page.getByRole('group', { name: 'Thème' }).getByRole('button', { name: 'Thème sombre' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sombre');
});
