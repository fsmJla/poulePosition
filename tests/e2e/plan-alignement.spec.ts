// Alignement des lignes du plan (US-068) : à l'étape « Vérifier » de l'assistant, la cellule du nom de compétition occupe
// toute la hauteur de sa ligne, comme les cellules de jours. `display: flex` sur la cellule la sortait du tableau : son
// trait de séparation était plus court et décalé. L'onglet « Plan » de la manifestation sert de référence (CA-3).
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { ouvrirDepuisCreer } from './creer';

const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

async function commencer(page: Page, manifestation: string) {
  await seConnecter(page);
  await page.goto('/organisateur');
  await ouvrirDepuisCreer(page, 'Créer une manifestation');
  await page.getByLabel('Nom', { exact: true }).fill(manifestation);
  await page.getByLabel('Date de début').fill('2027-03-14');
  await page.getByLabel('Date de fin').fill('2027-03-15');
  await page.getByLabel('Lieu').fill('Salle Bellegrave');
  await page.getByRole('button', { name: 'Suivant : Compétitions' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Les compétitions du week-end' })).toBeVisible({
    timeout: 20_000,
  });
}

async function ajouterCompetition(page: Page, nom: string, arme: string) {
  await page.getByLabel('Nom de la compétition').fill(nom);
  await page.getByRole('button', { name: arme, exact: true }).click();
  await page.getByRole('button', { name: 'Ajouter la compétition' }).click();
  await expect(page.getByText(`Compétition « ${nom} » créée`)).toBeVisible({ timeout: 20_000 });
}

/** Crée, pour une compétition de l'étape « Épreuves », les épreuves des catégories données. */
async function creerEpreuves(page: Page, competition: string, categories: string[]) {
  await page.getByRole('button', { name: new RegExp(`^${competition}`) }).click();
  for (const categorie of categories) await page.getByRole('button', { name: categorie, exact: true }).click();
  const total = categories.length;
  await page.getByRole('button', { name: total > 1 ? `Créer les ${total} épreuves` : 'Créer l’épreuve' }).click();
  await expect(page.getByRole('button', { name: new RegExp(`^${competition}.*${total} épreuve`) })).toBeVisible({
    timeout: 20_000,
  });
}

/** Une manifestation à trois compétitions de 1, 2 et 6 épreuves (étiquettes sur 1 à plusieurs lignes), à l'étape « Vérifier ». */
async function jusqueAVerifier(page: Page): Promise<string> {
  test.setTimeout(150_000);
  const manifestation = nomUnique();
  const une = `Une ${nomUnique()}`;
  const deux = `Deux ${nomUnique()}`;
  const six = `Six ${nomUnique()}`;
  await commencer(page, manifestation);
  await ajouterCompetition(page, une, 'Sabre');
  await ajouterCompetition(page, deux, 'Épée');
  await ajouterCompetition(page, six, 'Fleuret');
  await page.getByRole('button', { name: 'Suivant : Épreuves' }).click();
  await creerEpreuves(page, une, ['M13 Hommes']);
  await creerEpreuves(page, deux, ['M13 Hommes', 'M15 Dames']);
  await creerEpreuves(page, six, ['M13 Hommes', 'M13 Dames', 'M15 Hommes', 'M15 Dames', 'M17 Hommes', 'M17 Dames']);
  await page.getByRole('button', { name: 'Suivant : Vérifier' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Vérifier le plan' })).toBeVisible();
  await expect(page.getByRole('table')).toContainText(six, { timeout: 20_000 });
  return manifestation;
}

/** Pour chaque ligne du tableau : écart entre le bas de la cellule du nom et le bas des autres cellules, et de la ligne. */
async function mesurerLignes(page: Page) {
  return page.getByRole('table').evaluate((tableau) =>
    [...tableau.querySelectorAll('tbody tr')].map((ligne) => {
      const boite = (element: Element) => element.getBoundingClientRect();
      const [nom, ...jours] = [...ligne.children];
      const bas = Math.max(...jours.map((jour) => boite(jour).bottom));
      return {
        hauteurLigne: boite(ligne).height,
        hautNom: boite(nom!).top - boite(ligne).top,
        ecartBasNom: Math.abs(boite(nom!).bottom - bas),
        ecartHauteurNom: Math.abs(boite(nom!).height - boite(ligne).height),
        affichage: getComputedStyle(nom!).display,
      };
    }),
  );
}

function verifierAlignement(lignes: Awaited<ReturnType<typeof mesurerLignes>>) {
  expect(lignes).toHaveLength(3);
  // Au moins une ligne est plus haute qu'une ligne d'une étiquette : sans cela le test ne prouverait rien.
  expect(Math.max(...lignes.map((l) => l.hauteurLigne))).toBeGreaterThan(
    Math.min(...lignes.map((l) => l.hauteurLigne)) + 20,
  );
  for (const ligne of lignes) {
    expect(ligne.affichage).toBe('table-cell');
    expect(ligne.hautNom).toBeLessThanOrEqual(1);
    expect(ligne.ecartBasNom).toBeLessThanOrEqual(1);
    expect(ligne.ecartHauteurNom).toBeLessThanOrEqual(1);
  }
}

test('US-068 CA-1 et CA-2 : à l’étape « Vérifier », le nom de la compétition et ses jours occupent la même ligne, de même hauteur', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  await jusqueAVerifier(page);
  verifierAlignement(await mesurerLignes(page));
});

test('US-068 CA-3 : l’onglet « Plan » de la manifestation a le même alignement', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  const manifestation = await jusqueAVerifier(page);
  await page.getByRole('button', { name: 'Terminer' }).click();
  await expect(page.getByRole('heading', { level: 1, name: manifestation })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('table')).toBeVisible();
  const lignes = await mesurerLignes(page);
  for (const ligne of lignes) {
    expect(ligne.ecartBasNom).toBeLessThanOrEqual(1);
    expect(ligne.ecartHauteurNom).toBeLessThanOrEqual(1);
  }
});

test('US-068 CA-4 : thème sombre et 390 px, même alignement, le tableau défile dans son cadre sans élargir la page', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 390, height: 844 });
  await jusqueAVerifier(page);
  verifierAlignement(await mesurerLignes(page));
  const debordement = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(debordement).toBeLessThanOrEqual(1);
});

test('US-068 cas limite : une compétition sans épreuve et un nom très long gardent des lignes alignées', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1000, height: 900 });
  const manifestation = nomUnique();
  const longue = `Compétition au nom volontairement très long ${nomUnique()} ${nomUnique()} ${nomUnique()}`;
  await commencer(page, manifestation);
  await ajouterCompetition(page, longue, 'Sabre');
  await page.getByRole('button', { name: 'Suivant : Épreuves' }).click();
  await page.getByRole('button', { name: 'Plus tard' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Vérifier le plan' })).toBeVisible();
  const lignes = await page.getByRole('table').evaluate((tableau) =>
    [...tableau.querySelectorAll('tbody tr')].map((ligne) => {
      const [nom, ...jours] = [...ligne.children];
      const bas = Math.max(...jours.map((jour) => jour.getBoundingClientRect().bottom), 0);
      return Math.abs(nom!.getBoundingClientRect().bottom - (bas || nom!.getBoundingClientRect().bottom));
    }),
  );
  expect(lignes.length).toBeGreaterThan(0);
  for (const ecart of lignes) expect(ecart).toBeLessThanOrEqual(1);
});
