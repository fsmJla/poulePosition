// Création d'une compétition (US-025) : formulaire, page de la compétition, création hors ligne.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';

/** Nom unique, pour reconnaître la compétition créée par ce test parmi celles du club. */
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

async function ouvrirFormulaire(page: Page) {
  await page.getByRole('link', { name: 'Nouvelle compétition' }).click();
  await expect(page).toHaveURL(/\/competitions\/nouvelle$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nouvelle compétition');
}

const MOTIF_PAGE_COMPETITION = /\/competitions\/[0-9a-f-]{36}$/;
const creer = (page: Page) => page.getByRole('button', { name: 'Créer la compétition' }).click();

test('US-025 CA-1 : le formulaire « Nouvelle compétition » propose tous les champs', async ({ page }) => {
  await seConnecter(page);
  await ouvrirFormulaire(page);
  for (const champ of ['Nom', 'Arme', 'Type', 'Catégorie', 'Sexe', 'Date', 'Appel', 'Scratch', 'Début des poules']) {
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

test('US-025 CA-2 : créer une compétition mène à sa page, en préparation, non publiée, pilotée par ce PC', async ({
  page,
}) => {
  const nom = nomUnique();
  await seConnecter(page);
  await ouvrirFormulaire(page);
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

  await expect(page).toHaveURL(MOTIF_PAGE_COMPETITION);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(nom);
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
  await expect(page).toHaveURL(/\/competitions\/nouvelle$/);
});

test('US-025 cas limites : nom et arme obligatoires, nom trop long, message sous le champ', async ({ page }) => {
  await seConnecter(page);
  await ouvrirFormulaire(page);
  await creer(page);
  await expect(page.getByText('Le nom est obligatoire')).toBeVisible();
  await expect(page.getByText('Choisissez une arme')).toBeVisible();

  await page.getByLabel('Nom').fill('x'.repeat(101));
  await creer(page);
  await expect(page.getByText('Le nom fait au plus 100 caractères')).toBeVisible();
  await expect(page).toHaveURL(/\/competitions\/nouvelle$/);
});

test('US-025 CA-6 : créée hors ligne, puis envoyée au retour du réseau', async ({ page, context }) => {
  const nom = nomUnique();
  await seConnecter(page);
  await context.setOffline(true);
  await ouvrirFormulaire(page);
  await page.getByLabel('Nom').fill(nom);
  await page.getByLabel('Arme').selectOption('fleuret');
  await creer(page);

  await expect(page).toHaveURL(MOTIF_PAGE_COMPETITION);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(nom);
  await expect(page.getByText('1 modification en attente d’envoi · Pas encore envoyée')).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
});

test('US-025 cas limite : un deuxième onglet sur la même compétition est en lecture seule', async ({
  page,
  context,
}) => {
  await seConnecter(page);
  await ouvrirFormulaire(page);
  await page.getByLabel('Nom').fill(nomUnique());
  await page.getByLabel('Arme').selectOption('sabreLaser');
  await creer(page);
  await expect(page).toHaveURL(MOTIF_PAGE_COMPETITION);
  await expect(page.getByText('Ce PC est le pilote', { exact: true })).toBeVisible();

  const autreOnglet = await context.newPage();
  await autreOnglet.goto(page.url());
  await expect(
    autreOnglet.getByText('Cette compétition est ouverte dans un autre onglet : lecture seule ici'),
  ).toBeVisible({ timeout: 20_000 });
  await autreOnglet.close();
});
