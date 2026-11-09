// US-012 : écran de connexion moderne (panneau + carte sur PC, carte seule sur smartphone).
// Les tests d'US-003 (connexion.spec.ts) restent inchangés : libellés, messages et enchaînements sont les mêmes.
import { expect, test, type Page } from '@playwright/test';

const PC = { width: 1280, height: 800 };
const SMARTPHONE = { width: 390, height: 844 };

const panneau = (page: Page) => page.getByRole('complementary', { name: 'Présentation de Poule Position' });
const formulaire = (page: Page) => page.locator('form');

async function remplir(page: Page) {
  await page.getByLabel('E-mail').fill('orga@poule-position.test');
  await page.getByLabel('Mot de passe', { exact: true }).fill('mot-de-passe-de-test');
}

test('US-012 CA-1 : sur PC, panneau avec la bannière et le sous-titre, formulaire dans une carte à droite', async ({
  page,
}) => {
  await page.setViewportSize(PC);
  await page.goto('/connexion');
  await expect(panneau(page)).toBeVisible();
  const banniere = panneau(page).getByRole('img', { name: 'Poule Position' });
  await expect.poll(() => banniere.evaluate((image: HTMLImageElement) => image.currentSrc)).toMatch(/login-dark\.svg$/);
  await expect(panneau(page).getByText('Gestion d’épreuves d’escrime')).toBeVisible();
  const gauche = await panneau(page).boundingBox();
  const droite = await formulaire(page).boundingBox();
  expect(droite!.x).toBeGreaterThan(gauche!.x + gauche!.width - 1);
});

test('US-012 CA-2 : sur smartphone, la carte seule avec la bannière, sans défilement horizontal', async ({ page }) => {
  await page.setViewportSize(SMARTPHONE);
  await page.goto('/connexion');
  await expect(panneau(page)).toBeHidden();
  const carte = page.getByRole('main');
  await expect(carte.getByRole('img', { name: 'Poule Position' })).toBeVisible();
  await expect(carte.getByText('Gestion d’épreuves d’escrime')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const element of [
    page.getByLabel('E-mail'),
    page.getByLabel('Mot de passe', { exact: true }),
    page.getByRole('button', { name: 'Se connecter' }),
  ]) {
    expect((await element.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
});

test('US-012 : la mise en page bascule au redimensionnement sans perdre la saisie', async ({ page }) => {
  await page.setViewportSize(PC);
  await page.goto('/connexion');
  await remplir(page);
  await page.setViewportSize(SMARTPHONE);
  await expect(panneau(page)).toBeHidden();
  await page.setViewportSize(PC);
  await expect(panneau(page)).toBeVisible();
  await expect(page.getByLabel('E-mail')).toHaveValue('orga@poule-position.test');
  await expect(page.getByLabel('Mot de passe', { exact: true })).toHaveValue('mot-de-passe-de-test');
});

test('US-012 CA-3 : le bouton œil affiche puis masque le mot de passe', async ({ page }) => {
  await page.goto('/connexion');
  const champ = page.getByLabel('Mot de passe', { exact: true });
  await champ.fill('secret-123456');
  const oeil = page.getByRole('button', { name: 'Afficher le mot de passe' });
  await expect(oeil).toHaveAttribute('aria-pressed', 'false');
  await oeil.click();
  await expect(champ).toHaveAttribute('type', 'text');
  const masquer = page.getByRole('button', { name: 'Masquer le mot de passe' });
  await expect(masquer).toHaveAttribute('aria-pressed', 'true');
  await masquer.click();
  await expect(champ).toHaveAttribute('type', 'password');
});

/** Ralentit la demande de sel pour observer l'état « connexion en cours ». */
async function ralentirServeur(page: Page) {
  let liberer = () => {};
  const attente = new Promise<void>((resoudre) => (liberer = resoudre));
  await page.route('**/session/sel', async (route) => {
    await attente;
    await route.abort();
  });
  return liberer;
}

test('US-012 CA-4 : pendant la connexion, icône animée, « Connexion… » et champs inactifs', async ({ page }) => {
  await page.goto('/connexion');
  const liberer = await ralentirServeur(page);
  await remplir(page);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  const bouton = page.locator('button[type="submit"]');
  await expect(bouton).toContainText('Connexion…');
  const icone = bouton.locator('svg.icone-animee');
  await expect(icone).toBeVisible();
  expect(
    await icone
      .locator('.case-animee')
      .first()
      .evaluate((c) => getComputedStyle(c).animationName),
  ).not.toBe('none');
  await expect(page.getByLabel('E-mail')).toBeDisabled();
  await expect(page.getByLabel('Mot de passe', { exact: true })).toBeDisabled();
  liberer();
});

test('US-012 CA-4 : l’icône reste fixe si l’on a demandé à réduire les animations', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/connexion');
  const liberer = await ralentirServeur(page);
  await remplir(page);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  const cases = page.locator('button[type="submit"] svg.icone-animee .case-animee');
  await expect(cases.first()).toBeVisible();
  const animations = await cases.evaluateAll((liste) => liste.map((c) => getComputedStyle(c).animationName));
  expect(new Set(animations)).toEqual(new Set(['none']));
  liberer();
});

test('US-012 CA-5 : un refus s’affiche dans le bandeau d’alerte', async ({ page }) => {
  await page.route('**/session/sel', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      json: { ok: true, sel: 'AAAAAAAAAAAAAAAAAAAAAA' },
    }),
  );
  await page.route('**/session', (route) =>
    route.request().method() === 'POST'
      ? route.fulfill({
          status: 401,
          headers: { 'Access-Control-Allow-Origin': '*' },
          json: { ok: false, erreur: 'IDENTIFIANTS_INVALIDES' },
        })
      : route.fallback(),
  );
  await page.goto('/connexion');
  await remplir(page);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  const alerte = page.getByRole('alert');
  await expect(alerte).toHaveText('E-mail ou mot de passe incorrect', { timeout: 20_000 });
  await expect(alerte).toHaveClass(/bandeau/);
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(1);
});

test('US-012 CA-6 : tout au clavier, dans l’ordre, avec un focus visible', async ({ page }) => {
  await page.goto('/connexion');
  await remplir(page);
  await page.getByLabel('E-mail').focus();
  const ordre: string[] = [];
  for (let i = 0; i < 6; i++) {
    ordre.push(
      await page.evaluate(() => {
        const actif = document.activeElement as HTMLElement;
        return actif.getAttribute('aria-label') ?? actif.textContent?.trim() ?? actif.id;
      }),
    );
    // Le focus obtenu au clavier est toujours visible (contour de la charte).
    if (i > 0) {
      expect(await page.evaluate(() => getComputedStyle(document.activeElement as Element).outlineStyle)).not.toBe(
        'none',
      );
    }
    await page.keyboard.press('Tab');
  }
  // « Mot de passe oublié ? » (US-009 CA-4) s'insère avant le retour à l'accueil.
  const [email, motDePasse, oeil, connecter, oubli, retour] = ordre;
  expect(email).toBe('');
  expect(motDePasse).toBe('');
  expect(oeil).toContain('Afficher le mot de passe');
  expect(connecter).toBe('Se connecter');
  expect(oubli).toBe('Mot de passe oublié ?');
  expect(retour).toBe("Retour à l'accueil");
});

test('US-012 hors ligne : même aspect, et le message dans le bandeau', async ({ page, context }) => {
  await page.setViewportSize(PC);
  await page.goto('/connexion');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  const banniere = panneau(page).getByRole('img', { name: 'Poule Position' });
  await expect.poll(() => banniere.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  const alerte = page.getByRole('alert');
  await expect(alerte).toHaveText('Hors ligne : connexion possible uniquement sur un appareil déjà utilisé');
  await expect(alerte).toHaveClass(/bandeau/);
  await context.setOffline(false);
});
