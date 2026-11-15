// Repère « Document » sur les lignes de la liste (US-073) : l'icône apparaît sur la ligne qui porte une affiche ou une
// feuille de route, s'ouvre en aperçu sans ouvrir la ligne, et n'est pas répétée sur les lignes qui l'héritent.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { pdfValide, pngUnique } from './fichiers-types';
import {
  ajouterCompetition,
  ajouterEpreuve,
  creerManifestationSimple,
  nomUnique,
  ouvrirManifestation,
} from './planche';

const documents = (page: Page) => page.getByRole('region', { name: 'Documents' });
const sorte = (page: Page, nom: 'affiche' | 'feuilleDeRoute') => documents(page).locator(`[data-sorte="${nom}"]`);

async function joindre(page: Page, nom: 'affiche' | 'feuilleDeRoute', fichier: ReturnType<typeof pngUnique>) {
  const envoi = page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().includes(`/${nom}`));
  await sorte(page, nom).locator('input[type="file"]').setInputFiles(fichier);
  expect((await envoi).status()).toBe(201);
}

/** Une manifestation avec une compétition et une épreuve, dont les documents sont joints à la manifestation. */
async function preparer(page: Page, documentsJoints: ('affiche' | 'feuilleDeRoute')[]) {
  test.setTimeout(120_000);
  const manifestation = nomUnique();
  const competition = nomUnique();
  const epreuve = nomUnique();
  await seConnecter(page);
  await creerManifestationSimple(page, manifestation);
  const competitionId = await ajouterCompetition(page, manifestation, competition, 'sabre');
  await ajouterEpreuve(page, competitionId, epreuve);
  if (documentsJoints.length > 0) {
    await ouvrirManifestation(page, manifestation, 'documents');
    await expect(sorte(page, 'affiche')).toBeVisible({ timeout: 20_000 });
    if (documentsJoints.includes('affiche')) await joindre(page, 'affiche', pngUnique());
    if (documentsJoints.includes('feuilleDeRoute')) await joindre(page, 'feuilleDeRoute', pdfValide(1));
  }
  await page.goto('/organisateur');
  const carte = page.getByRole('article', { name: manifestation });
  await expect(carte).toBeVisible({ timeout: 20_000 });
  return { manifestation, competition, epreuve, carte };
}

const repere = (zone: ReturnType<Page['locator']>, nom: string) => zone.getByRole('button', { name: nom, exact: true });

test('US-073 CA-1, CA-4 et CA-5 : le repère est sur la ligne qui porte les documents, pas sur celles qui les héritent, et la légende l’explique', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  const { carte, competition, epreuve } = await preparer(page, ['affiche', 'feuilleDeRoute']);
  const bouton = repere(carte, 'Affiche et feuille de route jointes');
  await expect(bouton).toBeVisible({ timeout: 20_000 });
  await expect(bouton).toHaveAttribute('title', 'Affiche et feuille de route jointes');
  // La compétition et son épreuve héritent des documents de la manifestation : aucun repère sur leurs lignes.
  await expect(carte.getByRole('button', { name: new RegExp(`^${competition}`) })).toBeVisible();
  await expect(carte.getByRole('link', { name: new RegExp(epreuve) })).toBeVisible();
  await expect(carte.getByRole('button', { name: /jointes?$/ })).toHaveCount(1);
  const legende = page.getByRole('list', { name: 'Légende des icônes' });
  await expect(legende.getByRole('listitem').last()).toHaveText('Affiche ou feuille de route jointe');
});

test('US-073 CA-2 : sans document, aucun repère (pas d’icône grisée)', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  const { carte } = await preparer(page, []);
  await expect(carte.getByRole('button', { name: /jointes?$/ })).toHaveCount(0);
});

test('US-073 CA-3 : le repère ouvre l’aperçu sans ouvrir la ligne, avec le choix de document, et Échap ramène à la liste', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  const { carte } = await preparer(page, ['affiche', 'feuilleDeRoute']);
  const bouton = repere(carte, 'Affiche et feuille de route jointes');
  await bouton.click();
  const fenetre = page.getByRole('dialog');
  await expect(fenetre).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/organisateur');
  await expect(fenetre.locator('img')).toBeVisible();
  const choix = fenetre.getByRole('group', { name: 'Document à voir' });
  await expect(choix.getByRole('button', { name: 'Affiche' })).toHaveAttribute('aria-pressed', 'true');
  await choix.getByRole('button', { name: 'Feuille de route' }).click();
  await expect(fenetre.locator('iframe')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(fenetre).toHaveCount(0);
  await expect(bouton).toBeFocused();
  expect(new URL(page.url()).pathname).toBe('/organisateur');
});

test('US-073 CA-3 : avec un seul document, pas de choix, et la feuille de route s’ouvre directement', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  const { carte } = await preparer(page, ['feuilleDeRoute']);
  await repere(carte, 'Feuille de route jointe').click();
  const fenetre = page.getByRole('dialog');
  await expect(fenetre.locator('iframe')).toBeVisible();
  await expect(fenetre.getByRole('group', { name: 'Document à voir' })).toHaveCount(0);
});

test('US-073 CA-6 : à 390 px, le repère reste visible, d’au moins 44 × 44 px, sans défilement horizontal', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { carte } = await preparer(page, ['affiche']);
  const bouton = repere(carte, 'Affiche jointe');
  await expect(bouton).toBeVisible();
  const boite = (await bouton.boundingBox())!;
  expect(boite.width).toBeGreaterThanOrEqual(44);
  expect(boite.height).toBeGreaterThanOrEqual(44);
  expect(boite.x + boite.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('US-073 hors ligne : le repère reste affiché depuis la copie gardée sur l’appareil', async ({ page, context }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  const { carte } = await preparer(page, ['affiche']);
  await expect(repere(carte, 'Affiche jointe')).toBeVisible({ timeout: 20_000 });
  await context.setOffline(true);
  await page.reload();
  await expect(repere(page.locator('main'), 'Affiche jointe').first()).toBeVisible({ timeout: 20_000 });
});
