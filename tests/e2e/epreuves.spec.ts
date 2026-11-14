// Création d'une épreuve (US-025, US-045) : formulaire, page de l’épreuve, création hors ligne. Toute épreuve est dans une
// compétition : ces tests créent en ligne une compétition seule avec sa première épreuve (US-045 CA-4), puis, hors ligne,
// une épreuve dans cette compétition connue de l'appareil.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { ouvrirNouvelleEpreuve } from './creer';

/** Nom unique, pour reconnaître l’épreuve créée par ce test parmi celles du club. */
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

async function ouvrirFormulaire(page: Page) {
  await ouvrirNouvelleEpreuve(page);
  await expect(page).toHaveURL(/\/epreuves\/nouvelle$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nouvelle épreuve');
}

const MOTIF_PAGE_EPREUVE = /\/epreuves\/[0-9a-f-]{36}$/;
const creer = (page: Page) => page.getByRole('button', { name: 'Créer l’épreuve' }).click();
const competition = (page: Page) => page.getByLabel('Compétition', { exact: true });
const choisirSeule = (page: Page) => competition(page).selectOption({ label: 'Nouvelle compétition seule (en ligne)' });

test('US-025 CA-1 : le formulaire « Nouvelle épreuve » propose tous les champs', async ({ page }) => {
  await seConnecter(page);
  await ouvrirFormulaire(page);
  for (const champ of [
    'Compétition',
    'Nom',
    'Arme',
    'Type',
    'Catégorie',
    'Sexe',
    'Date',
    'Appel',
    'Scratch',
    'Début des poules',
  ]) {
    await expect(page.getByLabel(champ, { exact: false }).first()).toBeVisible();
  }
  await expect(page.getByLabel('Lieu')).toBeVisible();
  await expect(page.getByLabel('Commentaire')).toBeVisible();
  await expect(page.getByLabel('Type')).toHaveValue('individuelle');
  const armes = page.getByLabel('Arme').locator('option:not([disabled])');
  await expect(armes).toHaveText(['Sabre', 'Épée', 'Fleuret', 'Sabre laser']);
  await expect(page.getByLabel('Sexe').locator('option')).toHaveText(['Non précisé', 'Hommes', 'Dames', 'Mixte']);
  await page.getByLabel('Catégorie').selectOption('autre');
  await expect(page.getByLabel('Catégorie libre')).toBeVisible();
});

test('US-045 CA-1 : sans compétition choisie, la création est impossible et le message le dit', async ({ page }) => {
  await seConnecter(page);
  await ouvrirFormulaire(page);
  await page.getByLabel('Nom').fill(nomUnique());
  await page.getByLabel('Arme').selectOption('sabre');
  await creer(page);
  await expect(page.getByText('Choisissez la compétition de cette épreuve')).toBeVisible();
  await expect(competition(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL(/\/epreuves\/nouvelle$/);
});

test('US-025 CA-2 et US-045 CA-4 : créer une compétition seule mène à la page de son épreuve, en préparation, non publiée, pilotée par ce PC @reel', async ({
  page,
}) => {
  // US-061 : sous 40 rem, la page d'une épreuve a une flèche de retour et une barre d'onglets au lieu du fil et de la navigation.
  await page.setViewportSize({ width: 1100, height: 900 });
  const nom = nomUnique();
  await seConnecter(page);
  await ouvrirFormulaire(page);
  await choisirSeule(page);
  await page.getByLabel('Nom').fill(nom);
  await page.getByLabel('Arme').selectOption('sabre');
  await page.getByLabel('Catégorie').selectOption('M13');
  await page.getByLabel('Sexe').selectOption('mixte');
  await page.getByLabel('Date').fill('2027-03-13');
  await page.getByLabel('Appel').fill('08:30');
  await page.getByLabel('Scratch').fill('09:00');
  await page.getByLabel('Début des poules').fill('09:30');
  await page.getByLabel('Lieu').fill('Salle Bellegrave, Pessac');
  await creer(page);

  await expect(page).toHaveURL(MOTIF_PAGE_EPREUVE);
  // CA-4 : l'épreuve porte le nom de la compétition et s'ouvre directement.
  // US-058 : le titre est le nom court ; le nom complet reste celui du fil d'Ariane.
  await expect(page.getByRole('navigation', { name: 'Fil d’Ariane' }).getByText(nom)).toBeVisible();
  await expect(page.getByText('En préparation', { exact: true })).toBeVisible();
  await expect(page.getByText('Non publiée', { exact: true })).toBeVisible();
  await expect(page.getByText('Ce PC est le pilote', { exact: true })).toBeVisible();
  await expect(page.getByText('samedi 13 mars 2027')).toBeVisible();
  await expect(page.getByText('Salle Bellegrave, Pessac')).toBeVisible();
  await expect(page.getByText('Poules en 5 touches, sans élimination · Tableau en 15 touches')).toBeVisible();
  // En ligne, la création part aussitôt au serveur : rien ne reste en attente.
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
});

test('US-025 CA-5 : des horaires incohérents sont refusés, le message nomme les deux horaires', async ({ page }) => {
  await seConnecter(page);
  await ouvrirFormulaire(page);
  await choisirSeule(page);
  await page.getByLabel('Nom').fill(nomUnique());
  await page.getByLabel('Arme').selectOption('epee');
  await page.getByLabel('Appel').fill('09:00');
  await page.getByLabel('Scratch').fill('08:30');
  await creer(page);
  await expect(page.getByText('Le scratch doit être après l’appel')).toBeVisible();
  await expect(page.getByLabel('Scratch')).toHaveAttribute('aria-invalid', 'true');

  await page.getByLabel('Scratch').fill('09:15');
  await page.getByLabel('Début des poules').fill('09:10');
  await creer(page);
  await expect(page.getByText('Le début des poules doit être après le scratch')).toBeVisible();
  await expect(page).toHaveURL(/\/epreuves\/nouvelle$/);
});

test('US-025 cas limites : nom et arme obligatoires, nom trop long, message sous le champ', async ({ page }) => {
  await seConnecter(page);
  await ouvrirFormulaire(page);
  await choisirSeule(page);
  await creer(page);
  await expect(page.getByText('Le nom est obligatoire')).toBeVisible();
  await expect(page.getByText('Choisissez une arme')).toBeVisible();

  await page.getByLabel('Nom').fill('x'.repeat(101));
  await creer(page);
  await expect(page.getByText('Le nom fait au plus 100 caractères')).toBeVisible();
  await expect(page).toHaveURL(/\/epreuves\/nouvelle$/);
});

test('US-025 CA-6 et US-045 hors ligne : créée dans une compétition connue de l’appareil, puis envoyée au retour du réseau @reel', async ({
  page,
  context,
}) => {
  const connue = nomUnique();
  const nom = nomUnique();
  await seConnecter(page);
  // En ligne : la compétition seule est créée avec sa première épreuve, et sa copie est gardée sur l'appareil.
  await ouvrirFormulaire(page);
  await choisirSeule(page);
  await page.getByLabel('Nom').fill(connue);
  await page.getByLabel('Arme').selectOption('fleuret');
  await creer(page);
  await expect(page).toHaveURL(MOTIF_PAGE_EPREUVE);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });

  // La copie des compétitions de l'appareil se remplit à la lecture de la liste du club.
  const copie = page.waitForResponse((reponse) => /\/competitions$/.test(reponse.url()));
  await page.goto('/organisateur');
  await copie;
  await context.setOffline(true);
  await ouvrirFormulaire(page);
  // Hors ligne : créer une compétition est grisé, le choix se limite aux compétitions de la copie.
  await expect(
    page.getByRole('option', { name: /Nouvelle compétition seule \(nécessite une connexion internet\)/ }),
  ).toBeDisabled();
  await competition(page).selectOption({ label: `${connue} (seule)` });
  await page.getByLabel('Nom').fill(nom);
  await page.getByLabel('Arme').selectOption('fleuret');
  await creer(page);

  await expect(page).toHaveURL(MOTIF_PAGE_EPREUVE);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(nom);
  await expect(page.getByText('1 modification en attente d’envoi · Pas encore envoyée')).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
});

test('US-025 cas limite : un deuxième onglet sur la même épreuve est en lecture seule', async ({ page, context }) => {
  await seConnecter(page);
  await ouvrirFormulaire(page);
  await choisirSeule(page);
  await page.getByLabel('Nom').fill(nomUnique());
  await page.getByLabel('Arme').selectOption('sabreLaser');
  await creer(page);
  await expect(page).toHaveURL(MOTIF_PAGE_EPREUVE);
  await expect(page.getByText('Ce PC est le pilote', { exact: true })).toBeVisible();

  const autreOnglet = await context.newPage();
  await autreOnglet.goto(page.url());
  await expect(autreOnglet.getByText('Cette épreuve est ouverte dans un autre onglet : lecture seule ici')).toBeVisible(
    { timeout: 20_000 },
  );
  await autreOnglet.close();
});
