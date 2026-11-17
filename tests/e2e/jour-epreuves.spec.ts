// Choisir le jour des épreuves (US-078) : un jour par catégorie dans la grille, et le glisser-déposer d'une épreuve
// d'un jour à l'autre sur le plan de la manifestation.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { ajouterCompetition, ajouterEpreuve, creerManifestationSimple, ouvrirManifestation } from './planche';

/** Nom unique, pour reconnaître les données de ce test parmi celles du club. */
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

const DIMANCHE = 'dimanche 14 mars 2027';
const LUNDI = 'lundi 15 mars 2027';

const laCase = (page: Page, categorie: string, sexe: string) =>
  page.getByRole('button', { name: `${categorie} ${sexe}`, exact: true });
const leJour = (page: Page, categorie: string, jour: string) =>
  page.getByRole('radio', { name: `Jour des épreuves ${categorie} : ${jour}` });
const tuile = (page: Page, nom: string) => page.getByRole('button', { name: `Épreuve ${nom}`, exact: true });

/** Une manifestation (14 et 15 mars 2027 par défaut) et sa compétition au sabre, puis la grille de la compétition. */
async function ouvrirLaGrille(page: Page, manifestation: string, competition: string, fin = '2027-03-15') {
  await creerManifestationSimple(page, manifestation, '2027-03-14', fin);
  await ajouterCompetition(page, manifestation, competition);
  await ouvrirManifestation(page, manifestation);
  await page.getByRole('link', { name: `Ajouter des épreuves à ${competition}` }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Ajouter des épreuves' })).toBeVisible();
}

/** La colonne (0 = premier jour) où se trouve une tuile du plan, sur la première ligne du tableau. */
const cellule = (page: Page, colonne: number) => page.locator('tbody tr').first().locator('td').nth(colonne);

test('US-078 CA-1, CA-3 et CA-4 : un jour par ligne dans la grille, un récapitulatif sans liste, les épreuves au bon jour', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await ouvrirLaGrille(page, manifestation, competition);

  // CA-1 : une colonne par jour après Dames, Hommes, Mixte ; pas de bouton de jour tant qu'une ligne n'est pas cochée.
  await expect(page.getByRole('columnheader', { name: 'dim. 14' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'lun. 15' })).toBeVisible();
  // US-080 CA-2 : les boutons de jour sont affichés, désactivés et non choisis, tant que la ligne n'est pas cochée.
  await expect(leJour(page, 'M13', DIMANCHE)).toBeDisabled();
  await expect(leJour(page, 'M13', DIMANCHE)).not.toBeChecked();

  // CA-4 : une catégorie libre a, elle aussi, ses boutons de jour.
  await page.getByLabel('Catégorie libre').fill('Open');
  await page.getByRole('button', { name: 'Ajouter la catégorie' }).click();

  await laCase(page, 'M13', 'Dames').click();
  await laCase(page, 'M13', 'Hommes').click();
  await laCase(page, 'M15', 'Dames').click();
  await laCase(page, 'Open', 'Mixte').click();

  // CA-1 : une ligne cochée a un bouton par jour, le premier choisi par défaut ; une ligne non cochée n'en a pas.
  await expect(leJour(page, 'M13', DIMANCHE)).toBeChecked();
  await expect(leJour(page, 'M13', LUNDI)).not.toBeChecked();
  await expect(leJour(page, 'M13', DIMANCHE)).toBeEnabled();
  await expect(leJour(page, 'M17', DIMANCHE)).toBeDisabled();
  await expect(leJour(page, 'M17', DIMANCHE)).not.toBeChecked();
  await expect(leJour(page, 'Open', LUNDI)).toBeVisible();

  // CA-3 : plus de nom ni de jour par épreuve ; un récapitulatif avec la répartition par jour.
  await expect(page.getByRole('textbox', { name: /^Nom de l’épreuve/ })).toHaveCount(0);
  await expect(page.getByText('4 épreuves seront créées')).toBeVisible();
  await expect(page.getByText(`${DIMANCHE} : 4`)).toBeVisible();

  // CA-1 : le jour choisi vaut pour toutes les épreuves cochées de la ligne.
  await leJour(page, 'M13', LUNDI).check();
  await leJour(page, 'Open', LUNDI).check();
  await expect(page.getByText(`${DIMANCHE} : 1 · ${LUNDI} : 3`)).toBeVisible();

  await page.getByRole('button', { name: 'Créer les 4 épreuves' }).click();
  await expect(page).toHaveURL(/\/organisateur$/);

  // Les épreuves sont au bon jour sur le plan, avec leur nom généré.
  await ouvrirManifestation(page, manifestation, 'plan');
  await expect(cellule(page, 1).getByRole('button', { name: `Épreuve ${competition} M13 Dames` })).toBeVisible({
    timeout: 20_000,
  });
  await expect(cellule(page, 1).getByRole('button', { name: `Épreuve ${competition} M13 Hommes` })).toBeVisible();
  await expect(cellule(page, 1).getByRole('button', { name: `Épreuve ${competition} Open Mixte` })).toBeVisible();
  await expect(cellule(page, 0).getByRole('button', { name: `Épreuve ${competition} M15 Dames` })).toBeVisible();
});

test('US-078 CA-2 : une manifestation d’un seul jour n’a pas de colonne de jour', async ({ page }) => {
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await ouvrirLaGrille(page, manifestation, competition, '2027-03-14');

  await laCase(page, 'M13', 'Dames').click();
  await expect(page.getByRole('columnheader', { name: 'dim. 14' })).toHaveCount(0);
  await expect(page.getByRole('radio')).toHaveCount(0);
  await expect(page.getByText('1 épreuve sera créée')).toBeVisible();
});

test('US-078 CA-5 et CA-6 : glisser une épreuve d’un jour à l’autre ; le panneau reste le moyen sans souris', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await ouvrirLaGrille(page, manifestation, competition);
  await laCase(page, 'M13', 'Dames').click();
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/organisateur$/);

  await ouvrirManifestation(page, manifestation, 'plan');
  const mienne = tuile(page, `${competition} M13 Dames`);
  await expect(cellule(page, 0).getByRole('button', { name: `Épreuve ${competition} M13 Dames` })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/en attente d’envoi|Pas encore envoyée/)).toHaveCount(0, { timeout: 20_000 });

  // CA-5 : la tuile se glisse dans la case du lundi ; le résultat s'affiche au-dessus du plan.
  await expect(mienne).toHaveAttribute('draggable', 'true');
  await mienne.dragTo(cellule(page, 1));
  await expect(page.getByRole('status').filter({ hasText: `Épreuve déplacée au ${LUNDI}` })).toBeVisible();
  await expect(cellule(page, 1).getByRole('button', { name: `Épreuve ${competition} M13 Dames` })).toBeVisible();
  await expect(cellule(page, 0).getByRole('button', { name: /^Épreuve / })).toHaveCount(0);

  // CA-5 : un dépôt dans sa propre case ne change rien.
  await tuile(page, `${competition} M13 Dames`).dragTo(cellule(page, 1));
  await expect(cellule(page, 1).getByRole('button', { name: `Épreuve ${competition} M13 Dames` })).toBeVisible();

  // CA-6 : sans souris, « Changer de jour » du panneau reste proposé.
  await tuile(page, `${competition} M13 Dames`).click();
  const panneau = page.getByRole('region', { name: `Détail de l’épreuve ${competition} M13 Dames` });
  await expect(panneau.getByRole('button', { name: 'Changer de jour : dimanche' })).toBeVisible();
});

test('US-078 CA-7 : une épreuve pilotée par un autre PC ne se glisse pas et dit pourquoi', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await creerManifestationSimple(page, manifestation);
  const competitionId = await ajouterCompetition(page, manifestation, competition);
  // Écrite au serveur par un autre appareil : ce PC n'en est pas le pilote.
  await ajouterEpreuve(page, competitionId, `${competition} M15`, '2027-03-14');
  await ouvrirManifestation(page, manifestation, 'plan');

  const autre = tuile(page, `${competition} M15`);
  await expect(autre).toBeVisible({ timeout: 20_000 });
  await expect(autre).toHaveAttribute('draggable', 'false');
  await expect(autre).toHaveAttribute('title', /pilotée par un autre PC/);
});

test('US-078 CA-8 : sur un smartphone, le plan en liste n’a pas de glissement', async ({ page }) => {
  test.setTimeout(60_000);
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await ouvrirLaGrille(page, manifestation, competition);
  await laCase(page, 'M13', 'Dames').click();
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/organisateur$/);

  await page.setViewportSize({ width: 390, height: 800 });
  await ouvrirManifestation(page, manifestation, 'plan');
  await expect(tuile(page, `${competition} M13 Dames`)).toBeVisible({ timeout: 20_000 });
  await expect(tuile(page, `${competition} M13 Dames`)).toHaveAttribute('draggable', 'false');
});

test('US-078 hors ligne : glisser une épreuve écrit son nouveau jour dans le journal local, envoyé au retour du réseau', async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await ouvrirLaGrille(page, manifestation, competition);
  await laCase(page, 'M15', 'Hommes').click();
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/organisateur$/);
  await ouvrirManifestation(page, manifestation, 'plan');
  const epreuve = tuile(page, `${competition} M15 Hommes`);
  await expect(epreuve).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Pas encore envoyée')).toHaveCount(0, { timeout: 20_000 });

  await context.setOffline(true);
  await expect(page.getByText(/^Hors ligne : plan du /)).toBeVisible({ timeout: 20_000 });
  await epreuve.dragTo(cellule(page, 1));
  await expect(page.getByRole('status').filter({ hasText: `Épreuve déplacée au ${LUNDI}` })).toBeVisible();
  await expect(cellule(page, 1).getByRole('button', { name: `Épreuve ${competition} M15 Hommes` })).toBeVisible();

  // Au retour du réseau, le changement part au serveur : le plan relu garde l'épreuve au lundi.
  await context.setOffline(false);
  await expect(async () => {
    await ouvrirManifestation(page, manifestation, 'plan');
    await expect(cellule(page, 1).getByRole('button', { name: `Épreuve ${competition} M15 Hommes` })).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
});

test('US-080 CA-1 : les colonnes Dames, Hommes et Mixte ont la même largeur, cases cochées ou non', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await ouvrirLaGrille(page, manifestation, competition);
  await laCase(page, 'M13', 'Dames').click();
  const largeurs = async () =>
    Promise.all(
      ['Dames', 'Hommes', 'Mixte'].map(
        async (sexe) => (await page.getByRole('columnheader', { name: sexe, exact: true }).boundingBox())!.width,
      ),
    );
  const [dames, hommes, mixte] = await largeurs();
  expect(Math.abs(dames! - hommes!)).toBeLessThan(1);
  expect(Math.abs(hommes! - mixte!)).toBeLessThan(1);
});
