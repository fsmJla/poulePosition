// Suppression d'une compétition avec son contenu (US-041) : l'administrateur supprime la compétition et ses épreuves après
// avoir saisi son nom. Le compte local est administrateur, celui de la preview un organisateur : seul CA-2 y tourne.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';

/** Nom unique, pour reconnaître les données de ce test parmi celles du club. */
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

const AVEC_ADMINISTRATEUR = 'administrateur réel : local uniquement (le compte de la preview est un organisateur)';

const carteManifestation = (page: Page, nom: string) => page.getByRole('listitem').filter({ hasText: nom }).first();
const section = (page: Page, manifestation: string) =>
  page.getByRole('region', { name: `Compétitions de ${manifestation}` });
const carteCompetition = (page: Page, manifestation: string, nom: string) =>
  section(page, manifestation).getByRole('listitem').filter({ hasText: nom });

async function ouvrirPage(page: Page) {
  await page.getByRole('link', { name: 'Manifestations', exact: true }).click();
  await expect(page).toHaveURL(/\/manifestations$/);
}

/** Crée une manifestation du 14 au 15 mars 2027 et une compétition au sabre, et attend qu'elles soient dans la liste. */
async function creerManifestationEtCompetition(page: Page, manifestation: string, competition: string) {
  await page.getByRole('button', { name: 'Nouvelle manifestation' }).click();
  await page.getByLabel('Nom', { exact: true }).fill(manifestation);
  await page.getByLabel('Date de début').fill('2027-03-14');
  await page.getByLabel('Date de fin').fill('2027-03-15');
  await page.getByLabel('Lieu').fill('Salle Bellegrave');
  await page.getByRole('button', { name: 'Créer la manifestation' }).click();
  await expect(carteManifestation(page, manifestation)).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: `Ajouter une compétition à ${manifestation}` }).click();
  await page.getByLabel('Nom de la compétition').fill(competition);
  await page.getByLabel('Arme').selectOption('sabre');
  await page.getByRole('button', { name: 'Créer la compétition' }).click();
  await expect(carteCompetition(page, manifestation, competition)).toBeVisible({ timeout: 20_000 });
}

/** Crée, par le formulaire, une épreuve rattachée à la compétition, et attend que le serveur l'ait reçue. */
async function rattacherEpreuve(page: Page, manifestation: string, competition: string, epreuve: string) {
  await page.goto('/epreuves/nouvelle');
  await page.getByLabel('Compétition', { exact: true }).selectOption({ label: `${competition} — ${manifestation}` });
  await page.getByLabel('Nom', { exact: true }).fill(epreuve);
  await page.getByRole('button', { name: 'lundi 15 mars 2027' }).click();
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
}

const boutonContenu = (page: Page, competition: string) =>
  page.getByRole('button', { name: `Supprimer avec son contenu la compétition ${competition}` });

async function preparer(page: Page) {
  const manifestation = nomUnique();
  const competition = nomUnique();
  const epreuve = nomUnique();
  await seConnecter(page);
  await ouvrirPage(page);
  await creerManifestationEtCompetition(page, manifestation, competition);
  await rattacherEpreuve(page, manifestation, competition, epreuve);
  await page.goto('/manifestations');
  await expect(carteCompetition(page, manifestation, competition)).toBeVisible({ timeout: 20_000 });
  return { manifestation, competition, epreuve };
}

test('US-041 CA-1 et CA-8 : supprimer une compétition avec son épreuve, après avoir saisi son nom', async ({
  page,
}) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const { manifestation, competition, epreuve } = await preparer(page);

  await boutonContenu(page, competition).click();
  const fenetre = page.getByRole('group', {
    name: `Supprimer définitivement la compétition « ${competition} » avec son contenu ?`,
  });
  await expect(fenetre.getByText('L’épreuve de la compétition est supprimée avec elle.')).toBeVisible({
    timeout: 20_000,
  });
  const valider = fenetre.getByRole('button', { name: 'Supprimer définitivement', exact: true });
  await expect(valider).toBeDisabled();
  await fenetre.getByLabel(`Saisissez « ${competition} » pour confirmer`).fill(`${competition} x`);
  await expect(valider).toBeDisabled();
  await fenetre.getByLabel(`Saisissez « ${competition} » pour confirmer`).fill(competition);
  await expect(valider).toBeEnabled();
  await valider.click();

  await expect(carteCompetition(page, manifestation, competition)).toHaveCount(0, { timeout: 30_000 });
  await page.goto('/organisateur');
  await expect(page.getByRole('link', { name: manifestation, exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: epreuve, exact: true })).toHaveCount(0);
});

test('US-041 hors ligne : le bouton est grisé, avec « Connexion requise pour supprimer »', async ({
  page,
  context,
}) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const { competition } = await preparer(page);

  await context.setOffline(true);
  await expect(boutonContenu(page, competition)).toBeDisabled();
  await expect(page.getByText('Connexion requise pour supprimer').first()).toBeVisible();
  await context.setOffline(false);
  await expect(boutonContenu(page, competition)).toBeEnabled();
});

test('US-041 CA-2 : un organisateur n’a pas le bouton « avec son contenu »', async ({ page }) => {
  test.skip(!process.env.BASE_URL, 'organisateur réel : preview uniquement (le compte local est un administrateur)');
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await ouvrirPage(page);
  await creerManifestationEtCompetition(page, manifestation, competition);
  await expect(page.getByRole('button', { name: `Supprimer la compétition ${competition}` })).toBeVisible();
  await expect(boutonContenu(page, competition)).toHaveCount(0);
});
