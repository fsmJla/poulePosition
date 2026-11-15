// Aperçu de l'affiche et de la feuille de route (US-072) : vignette, fenêtre d'aperçu, boutons de la charte, fichier
// illisible, écran étroit, hors ligne. Les fichiers sont joints sur le serveur de test, à une manifestation créée pour l'occasion.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { pdfIllisible, pdfValide, pngUnique } from './fichiers-types';
import { creerManifestationSimple, ouvrirManifestation } from './planche';

const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

const documents = (page: Page) => page.getByRole('region', { name: 'Documents' });
const sorte = (page: Page, nom: 'affiche' | 'feuilleDeRoute') => documents(page).locator(`[data-sorte="${nom}"]`);
const champ = (page: Page, nom: 'affiche' | 'feuilleDeRoute') => sorte(page, nom).locator('input[type="file"]');

async function ouvrirLesDocuments(page: Page, manifestation: string) {
  await ouvrirManifestation(page, manifestation, 'documents');
  await expect(documents(page)).toBeVisible();
  await expect(sorte(page, 'affiche')).toBeVisible({ timeout: 20_000 });
}

async function joindre(page: Page, nom: 'affiche' | 'feuilleDeRoute', fichier: ReturnType<typeof pngUnique>) {
  const envoi = page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().includes(`/${nom}`));
  await champ(page, nom).setInputFiles(fichier);
  expect((await envoi).status()).toBe(201);
}

async function preparer(
  page: Page,
  fichiers: { affiche?: ReturnType<typeof pngUnique>; feuille?: ReturnType<typeof pdfValide> },
) {
  test.setTimeout(120_000);
  const manifestation = nomUnique();
  await seConnecter(page);
  await creerManifestationSimple(page, manifestation);
  await ouvrirLesDocuments(page, manifestation);
  if (fichiers.affiche) await joindre(page, 'affiche', fichiers.affiche);
  if (fichiers.feuille) await joindre(page, 'feuilleDeRoute', fichiers.feuille);
  return manifestation;
}

const vignette = (page: Page, nom: 'affiche' | 'feuilleDeRoute') =>
  sorte(page, nom).getByRole('button', { name: /^Agrandir l’aperçu/ });
const fenetre = (page: Page) => page.getByRole('dialog');

test('US-072 CA-1 : la feuille de route a un aperçu de sa première page, avec son nom, sa taille et son nombre de pages', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  await preparer(page, { feuille: pdfValide(2) });
  const bloc = sorte(page, 'feuilleDeRoute');
  const canevas = bloc.locator('canvas');
  await expect(canevas).toBeVisible({ timeout: 20_000 });
  expect(await canevas.evaluate((c: HTMLCanvasElement) => c.width)).toBeGreaterThan(100);
  await expect(bloc.getByText(/2 pages/)).toBeVisible();
  await expect(bloc.getByText(/\d+ (o|Ko)/)).toBeVisible();
  // Au-dessus des boutons « Remplacer » et « Retirer ».
  const aperçu = (await canevas.boundingBox())!;
  const remplacer = (await bloc.getByText('Remplacer', { exact: true }).boundingBox())!;
  expect(aperçu.y).toBeLessThan(remplacer.y);
});

test('US-072 CA-2 : la vignette s’ouvre en grand dans une fenêtre, Échap la ferme et rend le focus au bouton', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  await preparer(page, { affiche: pngUnique(), feuille: pdfValide(1) });
  await expect(sorte(page, 'feuilleDeRoute').locator('canvas')).toBeVisible({ timeout: 20_000 });

  for (const nom of ['affiche', 'feuilleDeRoute'] as const) {
    const bouton = vignette(page, nom);
    await bouton.focus();
    await page.keyboard.press('Enter');
    await expect(fenetre(page)).toBeVisible();
    await expect(fenetre(page).getByRole('link', { name: 'Ouvrir dans un nouvel onglet' })).toBeVisible();
    await expect(fenetre(page).getByRole('button', { name: 'Fermer' })).toBeVisible();
    await expect(fenetre(page).locator(nom === 'affiche' ? 'img' : 'iframe')).toBeVisible();
    // Le focus est piégé dans la fenêtre : Tab reste dans ses éléments.
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement?.closest('dialog') !== null)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(fenetre(page)).toHaveCount(0);
    await expect(bouton).toBeFocused();
  }
  // Le bouton « Fermer » ferme aussi.
  await vignette(page, 'affiche').click();
  await fenetre(page).getByRole('button', { name: 'Fermer' }).click();
  await expect(fenetre(page)).toHaveCount(0);
});

test('US-072 CA-3 : « Remplacer » et « Retirer » sont des boutons neutres de la charte, le lien de la feuille reprend l’accent', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  await preparer(page, { affiche: pngUnique(), feuille: pdfValide(1) });
  const couleurDe = (valeur: string) =>
    page.evaluate((v) => {
      const sonde = document.createElement('div');
      sonde.style.color = v;
      document.body.append(sonde);
      const couleur = getComputedStyle(sonde).color;
      sonde.remove();
      return couleur;
    }, valeur);
  const surface = await couleurDe('var(--surface)');
  for (const nom of ['affiche', 'feuilleDeRoute'] as const) {
    const remplacer = sorte(page, nom).locator('label.bouton');
    const retirer = sorte(page, nom).getByRole('button', { name: /^Retirer/ });
    for (const bouton of [remplacer, retirer]) {
      expect(await bouton.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(surface);
      expect((await bouton.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  }
  const lien = sorte(page, 'feuilleDeRoute').getByRole('link', { name: 'Ouvrir la feuille de route' });
  expect(await lien.evaluate((e) => getComputedStyle(e).color)).toBe(await couleurDe('var(--accent)'));
});

test('US-072 CA-4 : sans feuille de route, « Aucune feuille de route » et un bouton d’ajout, sans aperçu vide', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  await preparer(page, {});
  const bloc = sorte(page, 'feuilleDeRoute');
  await expect(bloc.getByText('Aucune feuille de route')).toBeVisible();
  await expect(bloc.getByText('Joindre une feuille de route')).toBeVisible();
  await expect(bloc.locator('canvas')).toHaveCount(0);
  await expect(vignette(page, 'feuilleDeRoute')).toHaveCount(0);
});

test('US-072 CA-5 : un PDF illisible est remplacé par une icône « Document » et son nom, avec « Ouvrir dans un nouvel onglet »', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  await preparer(page, {});
  await joindre(page, 'feuilleDeRoute', pdfIllisible());
  const bloc = sorte(page, 'feuilleDeRoute');
  await expect(bloc.locator('svg[data-icone="document"]')).toBeVisible({ timeout: 20_000 });
  await expect(bloc.locator('canvas')).toHaveCount(0);
  await expect(bloc.getByRole('link', { name: 'Ouvrir dans un nouvel onglet' })).toBeVisible();
});

test('US-072 CA-6 : à 390 px, l’aperçu tient dans la largeur et la fenêtre occupe l’écran, « Fermer » d’au moins 44 px', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await preparer(page, { affiche: pngUnique(), feuille: pdfValide(1) });
  await expect(sorte(page, 'feuilleDeRoute').locator('canvas')).toBeVisible({ timeout: 20_000 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await vignette(page, 'affiche').click();
  const boite = (await fenetre(page).boundingBox())!;
  expect(boite.width).toBeGreaterThanOrEqual(385);
  expect(boite.height).toBeGreaterThanOrEqual(835);
  const fermer = (await fenetre(page).getByRole('button', { name: 'Fermer' }).boundingBox())!;
  expect(fermer.width).toBeGreaterThanOrEqual(44);
  expect(fermer.height).toBeGreaterThanOrEqual(44);
});

test('US-072 hors ligne : la page des documents reste utilisable, sans erreur, avec ou sans copie gardée', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  await preparer(page, { affiche: pngUnique() });
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await context.setOffline(true);
  await page.reload();
  // Selon le cache de l'appareil : copie gardée, texte « Aperçu disponible en ligne » ou liste hors ligne, jamais une page cassée.
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 });
  expect(erreurs).toEqual([]);
});
