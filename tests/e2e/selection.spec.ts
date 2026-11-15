// Mode sélection de l'accueil (US-059) : les cases n'apparaissent qu'après « Sélectionner », avec une barre d'actions
// (planche 4, docs/maquettes/ihm/4-selection.png). Les règles de la suppression par lot sont celles d'US-043. Le compte
// local est administrateur, celui de la preview un organisateur : seul CA-6 y tourne.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { ajouterCompetition, ajouterEpreuve, creerManifestationSimple } from './planche';

const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;
const AVEC_ADMINISTRATEUR = 'administrateur réel : local uniquement (le compte de la preview est un organisateur)';

const selectionner = (page: Page) => page.getByRole('button', { name: 'Sélectionner', exact: true });
const barre = (page: Page) => page.getByRole('toolbar', { name: 'Mode sélection' });
const casesDeSelection = (page: Page) =>
  page.getByRole('checkbox', { name: /^Sélectionner (l’épreuve|la compétition|la manifestation) / });
const caseEpreuve = (page: Page, nom: string) => page.getByRole('checkbox', { name: `Sélectionner l’épreuve ${nom}` });

/** Une manifestation avec une compétition et `nombre` épreuves, créées par l'API ; ouvre l'accueil. */
async function preparer(page: Page, nombre = 2) {
  const manifestation = nomUnique();
  const competition = nomUnique();
  const epreuves = Array.from({ length: nombre }, () => nomUnique());
  await seConnecter(page);
  await creerManifestationSimple(page, manifestation);
  const competitionId = await ajouterCompetition(page, manifestation, competition);
  for (const nom of epreuves) await ajouterEpreuve(page, competitionId, nom);
  await page.goto('/organisateur');
  await expect(page.getByRole('link', { name: `Ouvrir l’épreuve ${epreuves[0]}`, exact: true })).toBeVisible({
    timeout: 20_000,
  });
  return { manifestation, competition, epreuves };
}

test('US-059 CA-1 : hors mode sélection, aucune case ; « Sélectionner » est à côté du titre', async ({ page }) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  await preparer(page);
  await expect(casesDeSelection(page)).toHaveCount(0);
  await expect(barre(page)).toHaveCount(0);
  const titre = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
  const bouton = (await selectionner(page).boundingBox())!;
  // Sur un grand écran, le bouton est à droite du titre, sur la même ligne ; sur un écran étroit, il passe juste dessous.
  if ((page.viewportSize()?.width ?? 0) >= 900) {
    expect(bouton.x).toBeGreaterThan(titre.x);
    expect(Math.abs(bouton.y + bouton.height / 2 - (titre.y + titre.height / 2))).toBeLessThan(40);
  } else {
    expect(bouton.y).toBeGreaterThanOrEqual(titre.y);
    expect(bouton.y).toBeLessThan(titre.y + titre.height + 60);
  }
});

test('US-059 CA-2 : le mode affiche les cases et une barre avec croix, compteur annoncé, « Tout sélectionner » et « Supprimer… »', async ({
  page,
}) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const { manifestation, competition, epreuves } = await preparer(page);
  await selectionner(page).click();
  const zone = barre(page);
  await expect(zone).toBeVisible();
  await expect(page.getByRole('checkbox', { name: `Sélectionner la manifestation ${manifestation}` })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: `Sélectionner la compétition ${competition}` })).toBeVisible();
  await expect(caseEpreuve(page, epreuves[0]!)).toBeVisible();
  await expect(zone.getByRole('button', { name: 'Quitter le mode sélection' })).toBeVisible();
  await expect(zone.getByRole('button', { name: 'Tout sélectionner' })).toBeVisible();
  // Aucune sélection : « Supprimer… » est grisé (cas limite) ; le compteur est annoncé aux lecteurs d'écran.
  await expect(zone.getByRole('button', { name: 'Supprimer…', exact: true })).toBeDisabled();
  await caseEpreuve(page, epreuves[0]!).check();
  await expect(zone.getByRole('status')).toHaveText('1 épreuve sélectionnée');
  await expect(zone.getByRole('button', { name: 'Supprimer…', exact: true })).toBeEnabled();
});

test('US-059 CA-3 : cocher une compétition sélectionne son contenu, et une phrase le rappelle', async ({ page }) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const { competition, epreuves } = await preparer(page);
  await selectionner(page).click();
  await expect(
    page.getByText(/Cocher une manifestation ou une compétition sélectionne aussi tout son contenu/),
  ).toBeVisible();
  await page.getByRole('checkbox', { name: `Sélectionner la compétition ${competition}` }).check();
  for (const nom of epreuves) {
    await expect(caseEpreuve(page, nom)).toBeChecked();
    await expect(caseEpreuve(page, nom)).toBeDisabled();
  }
  await expect(barre(page).getByRole('status')).toContainText('1 compétition');
});

test('US-059 CA-4 : « Supprimer… » ouvre la confirmation unique ; après le compte rendu, le mode se ferme', async ({
  page,
}) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const { epreuves } = await preparer(page);
  await selectionner(page).click();
  await caseEpreuve(page, epreuves[0]!).check();
  await barre(page).getByRole('button', { name: 'Supprimer…', exact: true }).click();
  const fenetre = page.getByRole('group', { name: 'Supprimer définitivement cette épreuve ?' });
  await expect(fenetre).toBeVisible();
  await expect(fenetre.getByText(epreuves[0]!)).toBeVisible();
  await fenetre.getByLabel('Saisissez SUPPRIMER pour confirmer').fill('SUPPRIMER');
  await fenetre.getByRole('button', { name: 'Supprimer définitivement', exact: true }).click();
  await expect(page.getByText('1 épreuve supprimée')).toBeVisible({ timeout: 30_000 });
  // Tout est supprimé : le mode sélection se ferme.
  await expect(barre(page)).toHaveCount(0);
  await expect(casesDeSelection(page)).toHaveCount(0);
  await expect(selectionner(page)).toBeVisible();
  await expect(page.getByRole('link', { name: `Ouvrir l’épreuve ${epreuves[0]}`, exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: `Ouvrir l’épreuve ${epreuves[1]}`, exact: true })).toBeVisible();
});

test('US-059 CA-5 : la croix et la touche Échap quittent le mode et abandonnent la sélection', async ({ page }) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const { epreuves } = await preparer(page);
  await selectionner(page).click();
  await caseEpreuve(page, epreuves[0]!).check();
  await barre(page).getByRole('button', { name: 'Quitter le mode sélection' }).click();
  await expect(barre(page)).toHaveCount(0);
  await expect(casesDeSelection(page)).toHaveCount(0);
  // La sélection est abandonnée : en rentrant, plus rien n'est coché.
  await selectionner(page).click();
  await expect(barre(page).getByRole('status')).toHaveText('0 épreuve sélectionnée');
  await caseEpreuve(page, epreuves[1]!).check();
  await page.keyboard.press('Escape');
  await expect(barre(page)).toHaveCount(0);
  await expect(casesDeSelection(page)).toHaveCount(0);
});

test('US-059 hypothèse : en mode sélection, un clic sur la ligne d’une épreuve la coche au lieu de l’ouvrir', async ({
  page,
}) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const { epreuves } = await preparer(page);
  const adresse = page.url();
  await selectionner(page).click();
  await page.getByRole('link', { name: `Ouvrir l’épreuve ${epreuves[0]}`, exact: true }).click();
  expect(page.url()).toBe(adresse);
  await expect(caseEpreuve(page, epreuves[0]!)).toBeChecked();
});

test('US-059 CA-6 : un organisateur n’a ni « Sélectionner » ni case ni barre', async ({ page }) => {
  test.skip(!process.env.BASE_URL, 'organisateur : preview uniquement (le compte local est administrateur)');
  await seConnecter(page);
  await page.goto('/organisateur');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
  await expect(selectionner(page)).toHaveCount(0);
  await expect(casesDeSelection(page)).toHaveCount(0);
  await expect(barre(page)).toHaveCount(0);
});

test('US-059 hors ligne : « Sélectionner » est grisé avec « Connexion requise pour supprimer »', async ({
  page,
  context,
}) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  await preparer(page);
  await context.setOffline(true);
  await expect(selectionner(page)).toBeDisabled();
  await expect(selectionner(page)).toHaveAccessibleDescription('Connexion requise pour supprimer');
  await expect(page.getByText('Connexion requise pour supprimer')).toBeVisible();
  await context.setOffline(false);
  await expect(selectionner(page)).toBeEnabled();
});

test('US-059 CA-7 : conforme à la planche 4 (barre d’actions et cases à 1360 px, trois épreuves cochées)', async ({
  page,
}, testInfo) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1360, height: 1000 });
  await page.emulateMedia({ colorScheme: 'light' });
  const { epreuves } = await preparer(page, 3);
  await selectionner(page).click();
  for (const nom of epreuves) await caseEpreuve(page, nom).check();
  const zone = barre(page);
  await expect(zone.getByRole('status')).toHaveText('3 épreuves sélectionnées');

  // Barre pleine largeur sous l'entête : fond teinté, croix puis compteur à gauche, « Tout sélectionner » puis « Supprimer… ».
  const boite = (await zone.boundingBox())!;
  expect(boite.x).toBeLessThanOrEqual(1);
  expect(boite.width).toBeGreaterThanOrEqual(1340);
  const fond = await zone.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(fond).toBe('rgb(227, 241, 240)');
  const croix = (await zone.getByRole('button', { name: 'Quitter le mode sélection' }).boundingBox())!;
  const compteur = (await zone.getByRole('status').boundingBox())!;
  const tout = (await zone.getByRole('button', { name: 'Tout sélectionner' }).boundingBox())!;
  const supprimer = (await zone.getByRole('button', { name: 'Supprimer…', exact: true }).boundingBox())!;
  expect(croix.x).toBeLessThan(compteur.x);
  expect(compteur.x + compteur.width).toBeLessThan(tout.x);
  expect(tout.x + tout.width).toBeLessThan(supprimer.x);
  expect(supprimer.x + supprimer.width).toBeGreaterThan(1300);
  const fondSupprimer = await zone
    .getByRole('button', { name: 'Supprimer…', exact: true })
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(fondSupprimer).toBe('rgb(179, 54, 47)');
  // Les cases sont à gauche de leur ligne, cochées pour les trois épreuves.
  for (const nom of epreuves) {
    const laCase = (await caseEpreuve(page, nom).boundingBox())!;
    const ligne = (await page.getByRole('link', { name: `Ouvrir l’épreuve ${nom}`, exact: true }).boundingBox())!;
    expect(laCase.x).toBeLessThan(ligne.x);
    await expect(caseEpreuve(page, nom)).toBeChecked();
  }
  await testInfo.attach('4-selection-accueil.png', { body: await page.screenshot(), contentType: 'image/png' });
});
