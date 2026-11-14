// « Annuler » est un bouton neutre dans les formulaires (US-074) : formulaire d'épreuve (création et modification) et
// grille des épreuves. Un lien souligné sous « Enregistrer » ne ressemblait pas aux autres formulaires.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { ajouterCompetition, creerManifestationSimple, ouvrirManifestation } from './planche';

const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;
const MOTIF_PAGE_EPREUVE = /\/epreuves\/[0-9a-f-]{36}$/;

const annuler = (page: Page) => page.getByRole('button', { name: 'Annuler', exact: true });
const lienAnnuler = (page: Page) => page.getByRole('link', { name: 'Annuler', exact: true });

/** Crée une épreuve (compétition seule) et attend que le serveur l'ait reçue. */
async function creerEpreuve(page: Page, nom: string) {
  await page.goto('/epreuves/nouvelle?seule');
  await page.getByLabel('Nom de la compétition et de son épreuve').fill(nom);
  await page.getByLabel('Arme').selectOption('sabre');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(MOTIF_PAGE_EPREUVE);
  await expect(page.getByText('Ce PC est le pilote', { exact: true })).toBeVisible();
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
}

async function ouvrirModification(page: Page) {
  await page.getByRole('link', { name: 'Modifier', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Modifier l’épreuve');
}

/** Ouvre la grille des épreuves d'une nouvelle compétition de manifestation. */
async function ouvrirLaGrille(page: Page) {
  const manifestation = nomUnique();
  const competition = nomUnique();
  await creerManifestationSimple(page, manifestation);
  await ajouterCompetition(page, manifestation, competition, 'sabre');
  await ouvrirManifestation(page, manifestation);
  await page.getByRole('link', { name: `Ajouter des épreuves à ${competition}` }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Ajouter des épreuves' })).toBeVisible();
}

test('US-074 CA-1 : « Annuler » du formulaire de modification est un bouton neutre de 44 px, pas un lien', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await seConnecter(page);
  await creerEpreuve(page, nomUnique());
  await ouvrirModification(page);
  await expect(annuler(page)).toBeVisible();
  await expect(lienAnnuler(page)).toHaveCount(0);
  const boite = (await annuler(page).boundingBox())!;
  expect(boite.height).toBeGreaterThanOrEqual(44);
  // Neutre : son fond n'est pas celui du bouton principal « Enregistrer ».
  const fond = (bouton: ReturnType<typeof annuler>) => bouton.evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(await fond(annuler(page))).not.toBe(await fond(page.getByRole('button', { name: 'Enregistrer' })));
});

test('US-074 CA-2 : le bouton principal est suivi d’« Annuler », côte à côte, dans le formulaire d’épreuve et dans la grille', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await seConnecter(page);
  await page.goto('/epreuves/nouvelle');
  const principal = page.getByRole('button', { name: 'Créer l’épreuve' });
  await expect(principal).toBeVisible();
  const p = (await principal.boundingBox())!;
  const a = (await annuler(page).boundingBox())!;
  expect(a.x).toBeGreaterThan(p.x);
  expect(Math.abs(a.y - p.y)).toBeLessThan(p.height);

  await ouvrirLaGrille(page);
  const creer = (await page.getByRole('button', { name: /^Créer/ }).boundingBox())!;
  await expect(lienAnnuler(page)).toHaveCount(0);
  const annulerGrille = (await annuler(page).boundingBox())!;
  expect(annulerGrille.x).toBeGreaterThan(creer.x);
  expect(Math.abs(annulerGrille.y - creer.y)).toBeLessThan(creer.height);
});

test('US-074 CA-3 : « Annuler » revient sans rien enregistrer (modification : à l’épreuve ; création et grille : à l’accueil)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  const nom = nomUnique();
  await seConnecter(page);
  await creerEpreuve(page, nom);
  await ouvrirModification(page);
  await page.getByLabel('Nom', { exact: true }).fill(nomUnique());
  await annuler(page).click();
  await expect(page).toHaveURL(MOTIF_PAGE_EPREUVE);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(nom);

  // Au clavier (Entrée), en création.
  await page.goto('/epreuves/nouvelle');
  await annuler(page).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/organisateur$/);

  // Grille : retour à l'accueil, rien n'est créé.
  await ouvrirLaGrille(page);
  await annuler(page).click();
  await expect(page).toHaveURL(/\/organisateur$/);
});

test('US-074 CA-4 : à 390 px, les deux boutons sont visibles et distincts, sans défilement horizontal', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seConnecter(page);
  await page.goto('/epreuves/nouvelle');
  const principal = page.getByRole('button', { name: 'Créer l’épreuve' });
  await annuler(page).scrollIntoViewIfNeeded();
  await expect(principal).toBeVisible();
  await expect(annuler(page)).toBeVisible();
  const p = (await principal.boundingBox())!;
  const a = (await annuler(page).boundingBox())!;
  const separes = a.x >= p.x + p.width || p.x >= a.x + a.width || a.y >= p.y + p.height || p.y >= a.y + a.height;
  expect(separes).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= 390)).toBe(true);
});

test('US-074 hors ligne : « Annuler » fonctionne réseau coupé', async ({ page, context }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  const nom = nomUnique();
  await seConnecter(page);
  await creerEpreuve(page, nom);
  await ouvrirModification(page);
  await context.setOffline(true);
  await annuler(page).click();
  await expect(page).toHaveURL(MOTIF_PAGE_EPREUVE);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(nom);
});

test('US-074 cas limite : ouvert par un lien profond, « Annuler » mène à l’accueil', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 900 });
  await seConnecter(page);
  await page.goto('/epreuves/nouvelle');
  await annuler(page).click();
  await expect(page).toHaveURL(/\/organisateur$/);
});
