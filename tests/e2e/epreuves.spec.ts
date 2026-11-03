// Épreuves du club (US-024) : création, modification, suppression, hors ligne, et rattachement d'une compétition
// (formulaire « Nouvelle compétition » : US-025 CA-3 et CA-4, US-024 CA-4).
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';

/** Nom unique, pour reconnaître les données de ce test parmi celles du club. */
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

const carteManifestation = (page: Page, nom: string) => page.getByRole('listitem').filter({ hasText: nom }).first();
/** Épreuves d'une manifestation : la section qui les regroupe. */
const section = (page: Page, manifestation: string) =>
  page.getByRole('region', { name: `Épreuves de ${manifestation}` });
const carteEpreuve = (page: Page, manifestation: string, nom: string) =>
  section(page, manifestation).getByRole('listitem').filter({ hasText: nom });

async function ouvrirPage(page: Page) {
  await page.getByRole('link', { name: 'Manifestations', exact: true }).click();
  await expect(page).toHaveURL(/\/manifestations$/);
}

/** Crée une manifestation du 14 au 15 mars 2027 et attend qu'elle soit dans la liste. */
async function creerManifestation(page: Page, nom: string) {
  await page.getByRole('button', { name: 'Nouvelle manifestation' }).click();
  await page.getByLabel('Nom', { exact: true }).fill(nom);
  await page.getByLabel('Date de début').fill('2027-03-14');
  await page.getByLabel('Date de fin').fill('2027-03-15');
  await page.getByLabel('Lieu').fill('Salle Bellegrave');
  await page.getByRole('button', { name: 'Créer la manifestation' }).click();
  await expect(carteManifestation(page, nom)).toBeVisible({ timeout: 20_000 });
}

/** Crée une épreuve dans la manifestation et attend qu'elle soit dans sa liste. */
async function creerEpreuve(page: Page, manifestation: string, nom: string, arme = '') {
  await page.getByRole('button', { name: `Ajouter une épreuve à ${manifestation}` }).click();
  await page.getByLabel('Nom de l’épreuve').fill(nom);
  if (arme) await page.getByLabel('Arme').selectOption(arme);
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(carteEpreuve(page, manifestation, nom)).toBeVisible({ timeout: 20_000 });
}

test('US-024 CA-1 : créer une épreuve l’ajoute sous sa manifestation', async ({ page }) => {
  const manifestation = nomUnique();
  const epreuve = nomUnique();
  await seConnecter(page);
  await ouvrirPage(page);
  await creerManifestation(page, manifestation);
  await creerEpreuve(page, manifestation, epreuve, 'sabre');
  await expect(carteEpreuve(page, manifestation, epreuve)).toContainText('Sabre');
  // Le commentaire est facultatif ; l'épreuve est toujours là au rechargement.
  await page.reload();
  await expect(carteEpreuve(page, manifestation, epreuve)).toBeVisible({ timeout: 20_000 });
});

test('US-024 CA-1 : l’arme est facultative, le nom obligatoire', async ({ page }) => {
  const manifestation = nomUnique();
  const epreuve = nomUnique();
  await seConnecter(page);
  await ouvrirPage(page);
  await creerManifestation(page, manifestation);
  await page.getByRole('button', { name: `Ajouter une épreuve à ${manifestation}` }).click();
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page.getByText('Le nom est obligatoire')).toBeVisible();
  await expect(page.getByLabel('Nom de l’épreuve')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Arme').locator('option')).toHaveText([
    'Toutes armes',
    'Sabre',
    'Épée',
    'Fleuret',
    'Sabre laser',
  ]);
  await page.getByLabel('Nom de l’épreuve').fill(epreuve);
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(carteEpreuve(page, manifestation, epreuve)).toBeVisible({ timeout: 20_000 });
});

test('US-024 CA-2 : une épreuve se crée toujours depuis une manifestation', async ({ page }) => {
  await seConnecter(page);
  await ouvrirPage(page);
  // Pas de bouton « Nouvelle épreuve » en dehors d'une manifestation : seule la section d'une manifestation en offre un.
  await expect(page.getByRole('button', { name: 'Nouvelle épreuve', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Ajouter une épreuve à / }).first()).toBeVisible({ timeout: 20_000 });
});

test('US-024 CA-3 : modifier une épreuve, visible au rechargement', async ({ page }) => {
  const manifestation = nomUnique();
  const epreuve = nomUnique();
  await seConnecter(page);
  await ouvrirPage(page);
  await creerManifestation(page, manifestation);
  await creerEpreuve(page, manifestation, epreuve, 'sabre');
  await page.getByRole('button', { name: `Modifier l’épreuve ${epreuve}` }).click();
  await page.getByLabel('Arme').selectOption('epee');
  await page.getByLabel('Commentaire').fill('Qualificative');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(carteEpreuve(page, manifestation, epreuve)).toContainText('Épée', { timeout: 20_000 });
  await page.reload();
  await expect(carteEpreuve(page, manifestation, epreuve)).toContainText('Qualificative', { timeout: 20_000 });
});

test('US-024 CA-5 : supprimer une épreuve vide, après confirmation', async ({ page }) => {
  const manifestation = nomUnique();
  const epreuve = nomUnique();
  await seConnecter(page);
  await ouvrirPage(page);
  await creerManifestation(page, manifestation);
  await creerEpreuve(page, manifestation, epreuve);
  await page.getByRole('button', { name: `Supprimer l’épreuve ${epreuve}` }).click();
  await expect(page.getByText(`Supprimer définitivement l’épreuve « ${epreuve} » ?`)).toBeVisible();
  await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(carteEpreuve(page, manifestation, epreuve)).toHaveCount(0, { timeout: 20_000 });
});

test('US-024 CA-3, CA-4 et CA-5 : rattacher une compétition à une épreuve (arme, date, suppression refusée)', async ({
  page,
}) => {
  const manifestation = nomUnique();
  const epreuve = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await ouvrirPage(page);
  await creerManifestation(page, manifestation);
  await creerEpreuve(page, manifestation, epreuve, 'sabre');
  await page.getByRole('link', { name: "Retour à l'accueil de l'organisateur" }).click();

  await page.getByRole('link', { name: 'Nouvelle compétition' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nouvelle compétition');
  // US-025 CA-3 : « Aucune » par défaut, puis la manifestation et l'épreuve.
  await expect(page.getByLabel('Manifestation', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Épreuve', { exact: true })).toHaveCount(0);
  await page.getByLabel('Manifestation', { exact: true }).selectOption({ label: manifestation });
  await page.getByLabel('Épreuve', { exact: true }).selectOption({ label: epreuve });
  // Le lieu de la manifestation et l'arme de l'épreuve sont proposés.
  await expect(page.getByLabel('Lieu')).toHaveValue('Salle Bellegrave');
  await expect(page.getByLabel('Arme')).toHaveValue('sabre');
  await page.getByLabel('Nom', { exact: true }).fill(competition);

  // US-024 CA-4 : une autre arme que celle de l'épreuve est refusée.
  await page.getByLabel('Arme').selectOption('epee');
  await page.getByLabel('Date').fill('2027-03-15');
  await page.getByRole('button', { name: 'Créer la compétition' }).click();
  await expect(page.getByText('Cette épreuve est au sabre')).toBeVisible();
  await page.getByLabel('Arme').selectOption('sabre');

  // US-025 CA-4 : la date, proposée parmi les jours de la manifestation, doit y être comprise.
  await expect(page.getByRole('button', { name: 'dimanche 14 mars 2027' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'lundi 15 mars 2027' })).toBeVisible();
  await page.getByLabel('Date').fill('2027-03-16');
  await page.getByRole('button', { name: 'Créer la compétition' }).click();
  await expect(page.getByText('La date doit être comprise entre le 14/03 et le 15/03')).toBeVisible();
  await page.getByRole('button', { name: 'lundi 15 mars 2027' }).click();
  await expect(page.getByLabel('Date')).toHaveValue('2027-03-15');
  await page.getByRole('button', { name: 'Créer la compétition' }).click();
  await expect(page).toHaveURL(/\/competitions\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(competition);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });

  // CA-5 : l'épreuve contient désormais une compétition, elle ne se supprime pas.
  await page.goto('/manifestations');
  await page.getByRole('button', { name: `Supprimer l’épreuve ${epreuve}` }).click();
  await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(page.getByText('Cette épreuve contient des compétitions')).toBeVisible({ timeout: 20_000 });
  await expect(carteEpreuve(page, manifestation, epreuve)).toBeVisible();
});

test('US-025 CA-3 : sans choix de rattachement, la compétition est créée isolée', async ({ page }) => {
  const competition = nomUnique();
  await seConnecter(page);
  await page.getByRole('link', { name: 'Nouvelle compétition' }).click();
  await page.getByLabel('Nom', { exact: true }).fill(competition);
  await page.getByLabel('Arme').selectOption('fleuret');
  await page.getByRole('button', { name: 'Créer la compétition' }).click();
  await expect(page).toHaveURL(/\/competitions\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(competition);
});

test('US-024 hors ligne : les épreuves restent consultables, les actions sont grisées', async ({ page, context }) => {
  const manifestation = nomUnique();
  const epreuve = nomUnique();
  await seConnecter(page);
  await ouvrirPage(page);
  await creerManifestation(page, manifestation);
  await creerEpreuve(page, manifestation, epreuve, 'fleuret');
  await page.getByRole('link', { name: "Retour à l'accueil de l'organisateur" }).click();

  await context.setOffline(true);
  await ouvrirPage(page);
  await expect(page.getByText(/^Hors ligne : liste du /)).toBeVisible();
  await expect(carteEpreuve(page, manifestation, epreuve)).toBeVisible();
  const ajout = page.getByRole('button', { name: `Ajouter une épreuve à ${manifestation}` });
  await expect(ajout).toBeDisabled();
  await expect(ajout).toContainText('Nécessite une connexion internet');
  await expect(page.getByRole('button', { name: `Modifier l’épreuve ${epreuve}` })).toBeDisabled();
  await expect(page.getByRole('button', { name: `Supprimer l’épreuve ${epreuve}` })).toBeDisabled();

  // La création d'une compétition reste possible hors ligne, rattachée à ce que la copie contient.
  await page.getByRole('link', { name: "Retour à l'accueil de l'organisateur" }).click();
  await page.getByRole('link', { name: 'Nouvelle compétition' }).click();
  await expect(
    page.getByLabel('Manifestation', { exact: true }).locator('option', { hasText: manifestation }),
  ).toHaveCount(1);
  await context.setOffline(false);
});
