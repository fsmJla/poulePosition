// US-017 : menu de compte en haut à droite, ouvert depuis l'avatar. Réponses du serveur simulées (aucune donnée de la
// preview n'est modifiée).
import { expect, test, type Page } from '@playwright/test';
import { boutonMenuCompte } from './compte';
import { connecterSimule, sessionSimulee, simuler } from './simulation';

/** US-054 CA-7 : sur un écran étroit (< 640 px), le menu reçoit aussi « Créer », l'aide et le thème. */
const etroit = (page: Page) => (page.viewportSize()?.width ?? 1280) < 640;

const menu = (page: Page) => page.locator('#menu-compte');

test('US-017 CA-1 : l’avatar remplace les deux boutons de l’entête', async ({ page }) => {
  await connecterSimule(page, 'organisateur');
  const entete = page.getByRole('banner');
  await expect(entete.getByRole('button', { name: 'Menu du compte de Compte simulé' })).toBeVisible();
  await expect(boutonMenuCompte(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(boutonMenuCompte(page)).toHaveText('CS');
  await expect(page.getByRole('button', { name: 'Se déconnecter', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Se déconnecter et oublier cet appareil' })).toHaveCount(0);
});

test('US-017 CA-2 : le menu montre l’avatar, le nom, l’e-mail, puis les trois entrées dans l’ordre', async ({
  page,
}) => {
  await connecterSimule(page, 'organisateur');
  await boutonMenuCompte(page).click();
  await expect(boutonMenuCompte(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(menu(page)).toContainText('Compte simulé');
  await expect(menu(page)).toContainText('simule@poule-position.test');
  expect(await menu(page).locator('a, button').allInnerTexts()).toEqual([
    'Éditer le profil',
    ...(etroit(page) ? ['Créer', 'Comment ça s’organise', 'Clair', 'Sombre', 'Auto'] : []),
    'Se déconnecter',
    'Se déconnecter et oublier cet appareil',
  ]);

  await menu(page).getByRole('link', { name: 'Éditer le profil' }).click();
  await expect(page).toHaveURL(/\/profil$/);
  await expect(menu(page)).toHaveCount(0);

  await boutonMenuCompte(page).click();
  await menu(page).getByRole('button', { name: 'Se déconnecter et oublier cet appareil' }).click();
  await expect(page.getByText('Les épreuves enregistrées sur cet appareil sont conservées.')).toBeVisible();
  await page.getByRole('button', { name: 'Annuler' }).click();

  await boutonMenuCompte(page).click();
  await menu(page).getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page).toHaveURL(/\/connexion$/);
});

test('US-017 CA-3 : le menu se ferme par l’avatar, par un clic en dehors et par Échap', async ({ page }) => {
  await connecterSimule(page, 'organisateur');
  await boutonMenuCompte(page).click();
  await boutonMenuCompte(page).click();
  await expect(menu(page)).toHaveCount(0);

  await boutonMenuCompte(page).click();
  // Clic en bas à gauche de l'écran : hors du menu, même sur smartphone où il recouvre le titre.
  await page.mouse.click(5, page.viewportSize()!.height - 5);
  await expect(menu(page)).toHaveCount(0);

  await boutonMenuCompte(page).click();
  await menu(page).getByRole('link', { name: 'Éditer le profil' }).focus();
  await page.keyboard.press('Escape');
  await expect(menu(page)).toHaveCount(0);
  await expect(boutonMenuCompte(page)).toBeFocused();
});

test('US-017 CA-4 : au clavier, avec les flèches, Début, Fin et Entrée', async ({ page }) => {
  await connecterSimule(page, 'organisateur');
  await boutonMenuCompte(page).focus();
  await page.keyboard.press('Enter');
  await expect(boutonMenuCompte(page)).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('ArrowDown');
  await expect(menu(page).getByRole('link', { name: 'Éditer le profil' })).toBeFocused();
  // Écran étroit : cinq entrées de plus (Créer, aide, trois thèmes) entre le profil et « Se déconnecter ».
  for (let pas = 0; pas < (etroit(page) ? 6 : 1); pas++) await page.keyboard.press('ArrowDown');
  await expect(menu(page).getByRole('button', { name: 'Se déconnecter', exact: true })).toBeFocused();
  await page.keyboard.press('End');
  await expect(menu(page).getByRole('button', { name: 'Se déconnecter et oublier cet appareil' })).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(menu(page).getByRole('link', { name: 'Éditer le profil' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/profil$/);
});

test('US-017 CA-5 : plus de tuile « Mon profil » sur l’accueil', async ({ page }) => {
  await connecterSimule(page, 'organisateur');
  await expect(page.getByRole('main').getByRole('link', { name: 'Mon profil' })).toHaveCount(0);
});

test('US-017 : l’entête tient sur une ligne et le menu reste dans l’écran', async ({ page }) => {
  await connecterSimule(page, 'organisateur');
  await boutonMenuCompte(page).click();
  const largeur = page.viewportSize()!.width;
  const boite = (await menu(page).boundingBox())!;
  expect(boite.x).toBeGreaterThanOrEqual(0);
  expect(boite.x + boite.width).toBeLessThanOrEqual(largeur);
  expect((await page.getByRole('banner').boundingBox())!.height).toBeLessThan(80);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('US-017 : un nom très long est coupé à l’écran, mais entier dans le nom accessible', async ({ page }) => {
  await connecterSimule(page, 'organisateur');
  const longue = sessionSimulee(false, 'organisateur');
  const nom = 'Marie-Charlotte de La Rochefoucauld-Montbazon des Grands Prés';
  await simuler(page, '/session', 200, { ...longue, compte: { ...longue.compte, nom } }, 'GET');
  await page.reload();
  await expect(page.getByRole('button', { name: `Menu du compte de ${nom}` })).toBeVisible();
  await boutonMenuCompte(page).click();
  const nomAffiche = menu(page).getByText(nom);
  expect(await nomAffiche.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('US-017 : avec un mot de passe temporaire, « Éditer le profil » mène au changement obligatoire', async ({
  page,
}) => {
  await simuler(page, '/session/sel', 200, { ok: true, sel: 'AAAAAAAAAAAAAAAAAAAAAA' });
  await simuler(page, '/session', 200, sessionSimulee(true, 'organisateur'));
  await simuler(page, '/session', 200, sessionSimulee(true, 'organisateur'), 'GET');
  await page.goto('/connexion');
  await page.getByLabel('E-mail').fill('simule@poule-position.test');
  await page.getByLabel('Mot de passe', { exact: true }).fill('mot-de-passe-temporaire');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/mot-de-passe$/, { timeout: 20_000 });
  await boutonMenuCompte(page).click();
  await menu(page).getByRole('link', { name: 'Éditer le profil' }).click();
  await expect(page).toHaveURL(/\/mot-de-passe$/);
});

test('US-017 hors ligne : le menu s’ouvre et « Se déconnecter » fonctionne sans réseau', async ({ page, context }) => {
  await connecterSimule(page, 'organisateur');
  await context.setOffline(true);
  await boutonMenuCompte(page).click();
  await expect(menu(page)).toContainText('simule@poule-position.test');
  await menu(page).getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page).toHaveURL(/\/connexion$/);
  await context.setOffline(false);
});
