// Compétitions du club (US-024) : création, modification, suppression, hors ligne, et rattachement d'une épreuve
// (formulaire « Nouvelle épreuve » : US-045 CA-1 et CA-3, US-025 CA-4, US-024 CA-4).
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';

/** Nom unique, pour reconnaître les données de ce test parmi celles du club. */
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

const carteManifestation = (page: Page, nom: string) => page.getByRole('listitem').filter({ hasText: nom }).first();
/** Compétitions d'une manifestation : la section qui les regroupe. */
const section = (page: Page, manifestation: string) =>
  page.getByRole('region', { name: `Compétitions de ${manifestation}` });
const carteCompetition = (page: Page, manifestation: string, nom: string) =>
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

/** Crée une compétition dans la manifestation et attend qu'elle soit dans sa liste. */
async function creerCompetition(page: Page, manifestation: string, nom: string, arme = '') {
  await page.getByRole('button', { name: `Ajouter une compétition à ${manifestation}` }).click();
  await page.getByLabel('Nom de la compétition').fill(nom);
  if (arme) await page.getByLabel('Arme').selectOption(arme);
  await page.getByRole('button', { name: 'Créer la compétition' }).click();
  await expect(carteCompetition(page, manifestation, nom)).toBeVisible({ timeout: 20_000 });
}

test('US-024 CA-1 : créer une compétition l’ajoute sous sa manifestation', async ({ page }) => {
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await ouvrirPage(page);
  await creerManifestation(page, manifestation);
  await creerCompetition(page, manifestation, competition, 'sabre');
  await expect(carteCompetition(page, manifestation, competition)).toContainText('Sabre');
  // Le commentaire est facultatif ; la compétition est toujours là au rechargement.
  await page.reload();
  await expect(carteCompetition(page, manifestation, competition)).toBeVisible({ timeout: 20_000 });
});

test('US-024 CA-1 : l’arme est facultative, le nom obligatoire', async ({ page }) => {
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await ouvrirPage(page);
  await creerManifestation(page, manifestation);
  await page.getByRole('button', { name: `Ajouter une compétition à ${manifestation}` }).click();
  await page.getByRole('button', { name: 'Créer la compétition' }).click();
  await expect(page.getByText('Le nom est obligatoire')).toBeVisible();
  await expect(page.getByLabel('Nom de la compétition')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByLabel('Arme').locator('option')).toHaveText([
    'Toutes armes',
    'Sabre',
    'Épée',
    'Fleuret',
    'Sabre laser',
  ]);
  await page.getByLabel('Nom de la compétition').fill(competition);
  await page.getByRole('button', { name: 'Créer la compétition' }).click();
  await expect(carteCompetition(page, manifestation, competition)).toBeVisible({ timeout: 20_000 });
});

test('US-024 CA-2 : une compétition se crée toujours depuis une manifestation', async ({ page }) => {
  await seConnecter(page);
  await ouvrirPage(page);
  // Pas de bouton « Nouvelle compétition » en dehors d'une manifestation : seule la section d'une manifestation en offre un.
  await expect(page.getByRole('button', { name: 'Nouvelle compétition', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Ajouter une compétition à / }).first()).toBeVisible({
    timeout: 20_000,
  });
});

test('US-024 CA-3 : modifier une compétition, visible au rechargement', async ({ page }) => {
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await ouvrirPage(page);
  await creerManifestation(page, manifestation);
  await creerCompetition(page, manifestation, competition, 'sabre');
  await page.getByRole('button', { name: `Modifier la compétition ${competition}` }).click();
  await page.getByLabel('Arme').selectOption('epee');
  await page.getByLabel('Commentaire').fill('Qualificative');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(carteCompetition(page, manifestation, competition)).toContainText('Épée', { timeout: 20_000 });
  await page.reload();
  await expect(carteCompetition(page, manifestation, competition)).toContainText('Qualificative', { timeout: 20_000 });
});

test('US-024 CA-5 : supprimer une compétition vide, après confirmation', async ({ page }) => {
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await ouvrirPage(page);
  await creerManifestation(page, manifestation);
  await creerCompetition(page, manifestation, competition);
  await page.getByRole('button', { name: `Supprimer la compétition ${competition}` }).click();
  await expect(page.getByText(`Supprimer définitivement la compétition « ${competition} » ?`)).toBeVisible();
  await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(carteCompetition(page, manifestation, competition)).toHaveCount(0, { timeout: 20_000 });
});

test('US-024 CA-3, CA-4 et CA-5 : rattacher une épreuve à une compétition (arme, date, suppression refusée)', async ({
  page,
}) => {
  const manifestation = nomUnique();
  const competition = nomUnique();
  const epreuve = nomUnique();
  await seConnecter(page);
  await ouvrirPage(page);
  await creerManifestation(page, manifestation);
  await creerCompetition(page, manifestation, competition, 'sabre');
  await page.getByRole('link', { name: "Retour à l'accueil de l'organisateur" }).click();

  await page.getByRole('link', { name: 'Nouvelle épreuve' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nouvelle épreuve');
  // US-045 CA-1 et CA-3 : aucune compétition choisie par défaut ; celle d'une manifestation se nomme avec elle.
  await expect(page.getByLabel('Compétition', { exact: true })).toHaveValue('');
  await page.getByLabel('Compétition', { exact: true }).selectOption({ label: `${competition} — ${manifestation}` });
  // Le lieu de la manifestation et l'arme de la compétition sont proposés.
  await expect(page.getByLabel('Lieu')).toHaveValue('Salle Bellegrave');
  await expect(page.getByLabel('Arme')).toHaveValue('sabre');
  await page.getByLabel('Nom', { exact: true }).fill(epreuve);

  // US-024 CA-4 : une autre arme que celle de la compétition est refusée.
  await page.getByLabel('Arme').selectOption('epee');
  await page.getByLabel('Date').fill('2027-03-15');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page.getByText('Cette compétition est au sabre')).toBeVisible();
  await page.getByLabel('Arme').selectOption('sabre');

  // US-025 CA-4 : la date, proposée parmi les jours de la manifestation, doit y être comprise.
  await expect(page.getByRole('button', { name: 'dimanche 14 mars 2027' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'lundi 15 mars 2027' })).toBeVisible();
  await page.getByLabel('Date').fill('2027-03-16');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page.getByText('La date doit être comprise entre le 14/03 et le 15/03')).toBeVisible();
  await page.getByRole('button', { name: 'lundi 15 mars 2027' }).click();
  await expect(page.getByLabel('Date')).toHaveValue('2027-03-15');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(epreuve);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });

  // CA-5 : la compétition contient désormais une épreuve, elle ne se supprime pas.
  await page.goto('/manifestations');
  await page.getByRole('button', { name: `Supprimer la compétition ${competition}` }).click();
  await page.getByRole('button', { name: 'Supprimer', exact: true }).click();
  await expect(page.getByText('Cette compétition contient des épreuves')).toBeVisible({ timeout: 20_000 });
  await expect(carteCompetition(page, manifestation, competition)).toBeVisible();
});

test('US-024 hors ligne : les compétitions restent consultables, les actions sont grisées', async ({
  page,
  context,
}) => {
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await ouvrirPage(page);
  await creerManifestation(page, manifestation);
  await creerCompetition(page, manifestation, competition, 'fleuret');
  await page.getByRole('link', { name: "Retour à l'accueil de l'organisateur" }).click();

  await context.setOffline(true);
  await ouvrirPage(page);
  await expect(page.getByText(/^Hors ligne : liste du /)).toBeVisible();
  await expect(carteCompetition(page, manifestation, competition)).toBeVisible();
  const ajout = page.getByRole('button', { name: `Ajouter une compétition à ${manifestation}` });
  await expect(ajout).toBeDisabled();
  await expect(ajout).toContainText('Nécessite une connexion internet');
  await expect(page.getByRole('button', { name: `Modifier la compétition ${competition}` })).toBeDisabled();
  await expect(page.getByRole('button', { name: `Supprimer la compétition ${competition}` })).toBeDisabled();

  // La création d'une épreuve reste possible hors ligne, dans une compétition que la copie contient (US-045).
  await page.getByRole('link', { name: "Retour à l'accueil de l'organisateur" }).click();
  await page.getByRole('link', { name: 'Nouvelle épreuve' }).click();
  await expect(page.getByLabel('Compétition', { exact: true }).locator('option', { hasText: competition })).toHaveCount(
    1,
  );
  await context.setOffline(false);
});

test('US-024 smartphone : un nom de compétition très long ne fait pas déborder le formulaire d’épreuve', async ({
  page,
}) => {
  const manifestation = `${nomUnique()} ${'Championnats de Nouvelle-Aquitaine '.repeat(2)}`.trim();
  const competition = `${nomUnique()} ${'Championnats de Nouvelle-Aquitaine de sabre '.repeat(2)}`.trim();
  await seConnecter(page);
  await ouvrirPage(page);
  await creerManifestation(page, manifestation);
  await creerCompetition(page, manifestation, competition, 'sabre');
  const debordement = () =>
    page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(await debordement()).toBe(false);

  await page.getByRole('link', { name: "Retour à l'accueil de l'organisateur" }).click();
  await page.getByRole('link', { name: 'Nouvelle épreuve' }).click();
  await page.getByLabel('Compétition', { exact: true }).selectOption({ label: `${competition} — ${manifestation}` });
  await expect(page.getByLabel('Arme')).toHaveValue('sabre');
  expect(await debordement()).toBe(false);
});
