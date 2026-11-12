// Grille des épreuves (US-048) : créer d'un coup les épreuves d'une compétition en cochant catégories et sexes.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { ajouterCompetition, creerManifestationSimple, ouvrirManifestation } from './planche';

/** Nom unique, pour reconnaître les données de ce test parmi celles du club. */
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

/** US-056 : la manifestation et sa compétition sont créées au serveur, puis la page de la manifestation est ouverte. */
async function creerManifestation(page: Page, nom: string) {
  await creerManifestationSimple(page, nom);
}

/** Une compétition dans la manifestation, au sabre ou sans arme ; la page de la manifestation s'ouvre dessus. */
async function creerCompetition(page: Page, manifestation: string, nom: string, arme: 'sabre' | '' = 'sabre') {
  await ajouterCompetition(page, manifestation, nom, arme || null);
  await ouvrirManifestation(page, manifestation);
  await expect(page.getByRole('article', { name: nom })).toBeVisible({ timeout: 20_000 });
}

/** Ouvre la grille depuis la carte de la compétition (page de la manifestation). */
async function ouvrirLaGrille(page: Page, competition: string) {
  await page.getByRole('link', { name: `Ajouter des épreuves à ${competition}` }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Ajouter des épreuves' })).toBeVisible();
}

const laCase = (page: Page, categorie: string, sexe: string) =>
  page.getByRole('button', { name: `${categorie} ${sexe}`, exact: true });

test('US-048 CA-1, CA-3, CA-4, CA-5 et CA-6 : cocher, régler, créer le lot et retrouver les épreuves dans la liste', async ({
  page,
}) => {
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await creerManifestation(page, manifestation);
  await creerCompetition(page, manifestation, competition);
  await ouvrirLaGrille(page, competition);

  // CA-1 : le fil d'Ariane, les colonnes et une case par catégorie et par sexe.
  const ariane = page.getByRole('navigation', { name: 'Compétition' });
  await expect(ariane).toContainText(manifestation);
  await expect(ariane).toContainText(competition);
  await expect(ariane).toContainText('Sabre');
  for (const colonne of ['Dames', 'Hommes', 'Mixte']) {
    await expect(page.getByRole('columnheader', { name: colonne })).toBeVisible();
  }
  await expect(page.getByRole('rowheader', { name: 'Vétéran 4' })).toBeVisible();
  await expect(laCase(page, 'M13', 'Hommes')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('button', { name: /^Créer/ })).toBeDisabled();
  await expect(page.getByText('Aucune case cochée')).toBeVisible();

  // CA-6 : une catégorie libre devient une ligne de la grille.
  await page.getByLabel('Catégorie libre').fill('Open');
  await page.getByRole('button', { name: 'Ajouter la catégorie' }).click();
  await expect(page.getByRole('rowheader', { name: 'Open' })).toBeVisible();
  await page.getByLabel('Catégorie libre').fill('m13');
  await page.getByRole('button', { name: 'Ajouter la catégorie' }).click();
  await expect(page.getByText('Cette catégorie est déjà dans la grille')).toBeVisible();

  // CA-3 : les cases cochées donnent les épreuves proposées, nommées, au premier jour par défaut.
  await laCase(page, 'M13', 'Hommes').click();
  await laCase(page, 'M15', 'Hommes').click();
  await laCase(page, 'Open', 'Mixte').click();
  await expect(laCase(page, 'M13', 'Hommes')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('3 épreuves seront créées')).toBeVisible();
  await expect(page.getByLabel('Nom de l’épreuve M13 Hommes')).toHaveValue(`${competition} M13 Hommes`);
  await expect(page.getByText('dimanche 14 mars 2027 : 3')).toBeVisible();

  // CA-3 : le jour et le nom d'une épreuve se modifient ; la répartition suit.
  await page.getByLabel('Jour de l’épreuve M15 Hommes').selectOption({ label: 'lundi 15 mars 2027' });
  await expect(page.getByText('dimanche 14 mars 2027 : 2 · lundi 15 mars 2027 : 1')).toBeVisible();
  await page.getByLabel('Nom de l’épreuve Open Mixte').fill(`${competition} Open`);

  // CA-4 : réglages communs, l'appel de chaque jour et le type.
  await page.getByLabel('Appel du dimanche 14 mars 2027').fill('08:30');
  await page.getByLabel('Type').selectOption('equipes2');

  // CA-5 : « Créer les 3 épreuves », puis retour à la liste du club.
  await page.getByRole('button', { name: 'Créer les 3 épreuves' }).click();
  await expect(page).toHaveURL(/\/organisateur$/);
  await deplier(page, manifestation);
  await expect(page.getByRole('link', { name: `Ouvrir l’épreuve ${competition} M13 Hommes`, exact: true })).toBeVisible(
    {
      timeout: 20_000,
    },
  );
  await expect(
    page.getByRole('link', { name: `Ouvrir l’épreuve ${competition} M15 Hommes`, exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: `Ouvrir l’épreuve ${competition} Open`, exact: true })).toBeVisible();

  // CA-5 : chaque épreuve a son journal, ce PC en est le pilote, avec les réglages communs.
  await page.getByRole('link', { name: `Ouvrir l’épreuve ${competition} M13 Hommes`, exact: true }).click();
  await expect(page.getByText('Ce PC est le pilote', { exact: true })).toBeVisible();
  await expect(page.getByText('Équipes de 2')).toBeVisible();
  await expect(page.getByText('dimanche 14 mars 2027')).toBeVisible();
  await expect(page.getByText('Salle Bellegrave')).toBeVisible();
});

test('US-048 CA-2 : une case déjà créée est marquée et ne se coche pas', async ({ page }) => {
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await creerManifestation(page, manifestation);
  await creerCompetition(page, manifestation, competition);

  // Une épreuve M15 Dames, créée par le formulaire unitaire.
  await page.goto('/epreuves/nouvelle');
  await page.getByLabel('Compétition', { exact: true }).selectOption({ label: `${competition} — ${manifestation}` });
  await page.getByLabel('Nom', { exact: true }).fill(`${competition} existante`);
  await page.getByLabel('Catégorie').selectOption('M15');
  await page.getByLabel('Sexe').selectOption('dames');
  await page.getByRole('button', { name: 'lundi 15 mars 2027' }).click();
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });

  await ouvrirManifestation(page, manifestation);
  await ouvrirLaGrille(page, competition);
  const prise = laCase(page, 'M15', 'Dames');
  await expect(prise).toBeDisabled();
  await expect(prise).toContainText('déjà créée');
  await expect(laCase(page, 'M15', 'Hommes')).toBeEnabled();
});

test('US-048 CA-7 : une compétition sans arme demande l’arme du lot, pour toutes les épreuves', async ({ page }) => {
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await creerManifestation(page, manifestation);
  await creerCompetition(page, manifestation, competition, '');
  await ouvrirLaGrille(page, competition);

  await expect(page.getByLabel('Arme du lot')).toHaveValue('');
  await laCase(page, 'M13', 'Dames').click();
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page.getByText('Choisissez une arme')).toBeVisible();
  await expect(page).toHaveURL(/\/competitions\/[0-9a-f-]{36}\/epreuves$/);

  await page.getByLabel('Arme du lot').selectOption('epee');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/organisateur$/);
  await deplier(page, manifestation);
  // US-055 : l'arme d'une épreuve n'est plus sur sa ligne ; on l'ouvre pour la lire.
  await page.getByRole('link', { name: `Ouvrir l’épreuve ${competition} M13 Dames` }).click({ timeout: 20_000 });
  await expect(page.getByText('Épée').first()).toBeVisible();
});

test('US-048 cas limite : un nom vide est refusé sur sa ligne et rien n’est créé', async ({ page }) => {
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await creerManifestation(page, manifestation);
  await creerCompetition(page, manifestation, competition);
  await ouvrirLaGrille(page, competition);

  await laCase(page, 'M13', 'Dames').click();
  await page.getByLabel('Nom de l’épreuve M13 Dames').fill('');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page.getByText('Le nom est obligatoire')).toBeVisible();
  await expect(page).toHaveURL(/\/competitions\/[0-9a-f-]{36}\/epreuves$/);
});

test('US-048 hors ligne : la grille crée les épreuves d’une compétition connue, envoyées au retour du réseau', async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await creerManifestation(page, manifestation);
  await creerCompetition(page, manifestation, competition);
  // La copie des compétitions de l'appareil se remplit à la lecture de la liste du club.
  const copie = page.waitForResponse((reponse) => /\/competitions$/.test(reponse.url()));
  await page.goto('/organisateur');
  await copie;
  const bloc = page.getByRole('article', { name: manifestation });
  await expect(bloc).toBeVisible({ timeout: 20_000 });

  await context.setOffline(true);
  await expect(page.getByText(/^Hors ligne : liste du /)).toBeVisible({ timeout: 20_000 });
  await bloc.getByRole('link', { name: `Ajouter des épreuves à ${competition}` }).click();
  await expect(page.getByRole('navigation', { name: 'Compétition' })).toContainText(competition);
  await laCase(page, 'M13', 'Hommes').click();
  await laCase(page, 'M13', 'Dames').click();
  await page.getByRole('button', { name: 'Créer les 2 épreuves' }).click();
  await expect(page).toHaveURL(/\/organisateur$/);
  const ligne = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('link', { name: `Ouvrir l’épreuve ${competition} M13 Hommes` }) });
  await expect(ligne).toContainText('Pas encore envoyée', { timeout: 20_000 });

  await context.setOffline(false);
  // La liste ne se rafraîchit pas seule à l'envoi : on la relit jusqu'à ce que les deux épreuves soient parties.
  await expect(async () => {
    await page.goto('/organisateur');
    await expect(page.getByText(/^Pas encore envoyée$/)).toHaveCount(0, { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
});

/** La liste de l'accueil ; la manifestation de 2027, à venir, est dépliée par défaut (US-055). */
async function deplier(page: Page, manifestation: string) {
  await expect(page.getByRole('article', { name: manifestation })).toBeVisible();
}
