// Thème clair, sombre ou automatique (US-052) : un sélecteur dans l'entête et sur les pages sans entête, retenu sur l'appareil.
import { expect, test, type Page } from '@playwright/test';
import { boutonMenuCompte, seConnecter } from './compte';

const FOND_CLAIR = 'rgb(247, 244, 239)';
const FOND_SOMBRE = 'rgb(15, 23, 22)';

const fondDeLaPage = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const selecteur = (page: Page) => page.getByRole('group', { name: 'Thème' });
const choix = (page: Page, nom: 'Clair' | 'Sombre' | 'Auto') => selecteur(page).getByRole('button', { name: nom });
/**
 * Pages réservées (US-054) : le thème se choisit par l'icône de l'entête (menu de trois choix) ; sur un écran étroit
 * (< 640 px), par le groupe « Thème » du menu de compte. Ces aides ouvrent le menu au besoin et rendent les choix.
 */
const etroit = (page: Page) => (page.viewportSize()?.width ?? 1280) < 640;
const attributChoix = (page: Page) => (etroit(page) ? 'aria-pressed' : 'aria-checked');
async function choixConnecte(page: Page) {
  if (etroit(page)) {
    if (!(await page.locator('#menu-compte').isVisible())) await boutonMenuCompte(page).click();
    const groupe = page.locator('#menu-compte').getByRole('group', { name: 'Thème' });
    return (nom: string) => groupe.getByRole('button', { name: nom, exact: true });
  }
  const menu = page.getByRole('menu', { name: 'Thème' });
  if (!(await menu.isVisible()))
    await page.getByRole('banner').getByRole('button', { name: 'Thème', exact: true }).click();
  return (nom: string) => menu.getByRole('menuitemradio', { name: nom, exact: true });
}

const themePose = (page: Page) => page.locator('html').getAttribute('data-theme');

test('US-052 CA-1 (US-054 : icône et menu) : l’entête d’une page réservée propose Clair, Sombre et Auto, le choix en cours est annoncé', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await seConnecter(page);
  if (!etroit(page)) {
    const declencheur = page.getByRole('banner').getByRole('button', { name: 'Thème', exact: true });
    await expect(declencheur).toHaveAttribute('title', 'Thème');
  }
  let choix = await choixConnecte(page);
  await expect(choix('Auto')).toHaveAttribute(attributChoix(page), 'true');
  await expect(choix('Clair')).toHaveAttribute(attributChoix(page), 'false');
  await expect(choix('Sombre')).toHaveAttribute(attributChoix(page), 'false');

  await choix('Sombre').click();
  choix = await choixConnecte(page);
  await expect(choix('Sombre')).toHaveAttribute(attributChoix(page), 'true');
  await expect(choix('Auto')).toHaveAttribute(attributChoix(page), 'false');
});

test('US-052 CA-2 : le sélecteur est aussi sur l’accueil, la connexion, « mot de passe oublié » et la réinitialisation', async ({
  page,
}) => {
  for (const chemin of ['/', '/connexion', '/mot-de-passe-oublie', '/reinitialisation']) {
    await page.goto(chemin);
    await expect(selecteur(page), chemin).toBeVisible();
    await expect(selecteur(page).getByRole('button')).toHaveCount(3);
  }
});

test('US-052 CA-3 : un choix s’applique tout de suite, sans recharger, bannière comprise', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.evaluate(() => ((window as unknown as { repere: string }).repere = 'meme-page'));
  const banniere = page.locator('main img').first();
  await expect.poll(() => fondDeLaPage(page)).toBe(FOND_CLAIR);
  await expect(banniere).toHaveAttribute('src', '/brand/login-light.svg');

  await choix(page, 'Sombre').click();
  await expect.poll(() => fondDeLaPage(page)).toBe(FOND_SOMBRE);
  await expect(banniere).toHaveAttribute('src', '/brand/login-dark.svg');
  expect(await themePose(page)).toBe('sombre');
  expect(await page.evaluate(() => (window as unknown as { repere: string }).repere)).toBe('meme-page');

  await choix(page, 'Clair').click();
  await expect.poll(() => fondDeLaPage(page)).toBe(FOND_CLAIR);
  await expect(banniere).toHaveAttribute('src', '/brand/login-light.svg');
});

test('US-052 CA-4 : « Auto » suit le système en direct, un choix manuel ne le suit pas', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(choix(page, 'Auto')).toHaveAttribute('aria-pressed', 'true');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => fondDeLaPage(page)).toBe(FOND_SOMBRE);
  await expect(page.locator('main img').first()).toHaveAttribute('src', '/brand/login-dark.svg');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(() => fondDeLaPage(page)).toBe(FOND_CLAIR);

  await choix(page, 'Clair').click();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect.poll(() => fondDeLaPage(page)).toBe(FOND_CLAIR);
  expect(await themePose(page)).toBe('clair');
});

test('US-052 CA-5 : le choix est retenu à la réouverture, posé avant le script de l’application', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/connexion');
  await choix(page, 'Sombre').click();
  await expect.poll(() => fondDeLaPage(page)).toBe(FOND_SOMBRE);

  await page.reload();
  await expect(choix(page, 'Sombre')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => fondDeLaPage(page)).toBe(FOND_SOMBRE);

  // Sans le moindre script de l'application, le thème est déjà posé : pas de clignotement au premier affichage.
  await page.route('**/*', (route) => (route.request().resourceType() === 'script' ? route.abort() : route.continue()));
  await page.goto('/connexion');
  expect(await themePose(page)).toBe('sombre');
});

test('US-052 CA-5 : le choix n’est pas lié au compte, un appareil sans choix reste en « Auto »', async ({
  browser,
}) => {
  const contexte = await browser.newContext();
  const page = await contexte.newPage();
  await page.goto('/connexion');
  await expect(choix(page, 'Auto')).toHaveAttribute('aria-pressed', 'true');
  expect(await themePose(page)).toBeNull();
  await contexte.close();
});

test('US-052 CA-6 : lisible dans les deux thèmes, le choix en cours s’y distingue sur l’entête comme dans le menu', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await seConnecter(page);
  for (const nom of ['Clair', 'Sombre'] as const) {
    let choix = await choixConnecte(page);
    await choix(nom).click();
    choix = await choixConnecte(page);
    await expect(choix(nom)).toHaveAttribute(attributChoix(page), 'true');
    if (etroit(page)) {
      // Le choix actif et les autres se distinguent par leur fond.
      const fonds = await page
        .locator('#menu-compte')
        .getByRole('group', { name: 'Thème' })
        .getByRole('button')
        .evaluateAll((boutons) => boutons.map((bouton) => getComputedStyle(bouton).backgroundColor));
      expect(new Set(fonds).size).toBeGreaterThan(1);
    } else {
      // Une coche marque le seul choix en cours.
      await expect(page.getByRole('menu', { name: 'Thème' }).locator('svg[data-icone="coche"]')).toHaveCount(1);
      await expect(choix(nom).locator('svg[data-icone="coche"]')).toHaveCount(1);
      await page.keyboard.press('Escape');
    }
  }
});

test('US-052 hors ligne : le choix s’applique et se retient sans réseau', async ({ page, context }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await context.setOffline(true);

  await choix(page, 'Sombre').click();
  await expect.poll(() => fondDeLaPage(page)).toBe(FOND_SOMBRE);
  // Navigation interne (sans recharger) vers la connexion : le thème et le sélecteur y sont.
  await page.getByRole('link', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/connexion$/);
  await expect(choix(page, 'Sombre')).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => fondDeLaPage(page)).toBe(FOND_SOMBRE);
  await choix(page, 'Clair').click();
  await expect.poll(() => fondDeLaPage(page)).toBe(FOND_CLAIR);
  expect(await page.evaluate(() => localStorage.getItem('poule-position:theme'))).toBe('clair');

  await context.setOffline(false);
});

test('US-052 cas limite : à 320 px, l’entête tient sans défilement horizontal et le thème reste atteignable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await seConnecter(page);
  const { defilement, largeur } = await page.evaluate(() => ({
    defilement: document.documentElement.scrollWidth,
    largeur: document.documentElement.clientWidth,
  }));
  expect(defilement).toBeLessThanOrEqual(largeur);
  const boite = await boutonMenuCompte(page).boundingBox();
  expect(boite!.x + boite!.width).toBeLessThanOrEqual(320);
  await expect(page.getByRole('banner').getByRole('link', { name: 'Poule Position' })).toBeVisible();
  const choix = await choixConnecte(page);
  await choix('Sombre').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sombre');
});
