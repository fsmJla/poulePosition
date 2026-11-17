// Accueil public structuré (US-079 CA-6 à CA-11) : la manifestation avec sa ville et son adresse une seule fois, les
// compétitions en intertitres, une ligne courte par épreuve, le lieu ouvert sur OpenStreetMap.
import { expect, test, type Browser, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { ajouterCompetition, creerManifestationSimple, ouvrirManifestation } from './planche';

const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;
const ADRESSE = 'Avenue Colonel Robert Jacqui 33600 Pessac';

/** Une manifestation à Pessac, une compétition au sabre, deux épreuves de ce PC, toutes publiées. */
async function publierManifestation(page: Page) {
  const manifestation = nomUnique();
  const competition = nomUnique();
  await creerManifestationSimple(page, manifestation, '2027-03-14', '2027-03-15', ADRESSE);
  await ajouterCompetition(page, manifestation, competition);
  await ouvrirManifestation(page, manifestation);
  await page.getByRole('link', { name: `Ajouter des épreuves à ${competition}` }).click();
  await page.getByRole('button', { name: 'M13 Dames', exact: true }).click();
  await page.getByRole('button', { name: 'M15 Hommes', exact: true }).click();
  await page.getByRole('button', { name: 'Créer les 2 épreuves' }).click();
  await expect(page).toHaveURL(/\/organisateur$/);
  await expect(page.getByRole('article', { name: manifestation })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: `Autres actions pour ${competition}` }).click();
  await page.getByRole('menuitem', { name: /^Publier toutes les épreuves/ }).click();
  await expect(page.getByRole('status').filter({ hasText: '2 épreuves publiées' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Pas encore envoyée')).toHaveCount(0, { timeout: 20_000 });
  return { manifestation, competition };
}

/** Un visiteur sans connexion, sur l'accueil public, jusqu'à ce que la manifestation y paraisse. */
async function visiter(browser: Browser, manifestation: string, largeur = 1280) {
  const visiteur = await (await browser.newContext({ viewport: { width: largeur, height: 900 } })).newPage();
  const carte = visiteur.getByRole('article', { name: manifestation });
  await expect(async () => {
    await visiteur.goto('/');
    await expect(carte).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 40_000 });
  return { visiteur, carte };
}

test('US-079 CA-6, CA-7 et CA-10 : la manifestation en tête avec sa ville, une ligne courte par épreuve, le lieu sur OpenStreetMap', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  await seConnecter(page);
  const { manifestation, competition } = await publierManifestation(page);
  const { carte } = await visiter(browser, manifestation);

  // CA-6 : la ville est le lien vers la carte ; les dates en toutes lettres ; l'adresse une seule fois.
  const ville = carte.getByRole('link', { name: `Voir ${ADRESSE} sur OpenStreetMap` });
  await expect(ville).toHaveText('Pessac');
  await expect(carte).toContainText('du dimanche 14 au lundi 15 mars 2027');
  expect((await carte.innerText()).split(ADRESSE).length - 1).toBe(1);

  // CA-10 : OpenStreetMap s'ouvre dans un nouvel onglet, sur une recherche de l'adresse.
  await expect(ville).toHaveAttribute('target', '_blank');
  await expect(ville).toHaveAttribute('href', /^https:\/\/www\.openstreetmap\.org\/search\?query=Avenue%20Colonel/);
  const boite = await ville.boundingBox();
  expect(boite?.height ?? 0).toBeGreaterThanOrEqual(44);

  // CA-7 : la compétition en intertitre avec son arme ; chaque épreuve est une ligne (nom court, jour, horaires)
  // qui est entièrement le lien vers elle.
  const bloc = carte.getByRole('region', { name: competition });
  await expect(bloc.getByRole('heading', { level: 4 })).toHaveText(`${competition} · Sabre`);
  const ligne = bloc.getByRole('link', { name: `Voir l’épreuve ${competition} M13 Dames`, exact: true });
  await expect(ligne).toContainText('M13 Dames');
  await expect(ligne).toContainText('dim. 14');
  await expect(ligne).toContainText('Appel 09:00');
  await expect(ligne).not.toContainText(competition);
  await expect(ligne).not.toContainText('Sabre');
  await expect(bloc.getByRole('link', { name: 'Voir l’épreuve', exact: true })).toHaveCount(0);

  // CA-5 : le lieu des épreuves, le même que la manifestation, n'est pas répété.
  await expect(bloc).not.toContainText(ADRESSE);
  await ligne.click();
  await expect(ligne.page()).toHaveURL(/\/direct\/[0-9a-f-]{36}$/);
});

test('US-079 CA-11 : sur un smartphone, les lignes passent sur deux lignes sans débordement horizontal', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  await seConnecter(page);
  const { manifestation, competition } = await publierManifestation(page);
  const { visiteur, carte } = await visiter(browser, manifestation, 390);

  const ligne = carte.getByRole('link', { name: `Voir l’épreuve ${competition} M13 Dames`, exact: true });
  await expect(ligne).toBeVisible();
  const nom = await ligne.getByText('M13 Dames').boundingBox();
  const horaires = await ligne.getByText('Appel 09:00').boundingBox();
  expect((horaires?.y ?? 0) - (nom?.y ?? 0)).toBeGreaterThan(10);
  const debordement = await visiteur.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(debordement).toBeLessThanOrEqual(0);
});
