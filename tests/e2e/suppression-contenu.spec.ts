// Suppression d'une compétition avec son contenu (US-041) : l'administrateur supprime la compétition et ses épreuves après
// avoir saisi son nom. Le compte local est administrateur, celui de la preview un organisateur : seul CA-2 y tourne.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { ajouterCompetition, ajouterEpreuve, creerManifestationSimple, ouvrirManifestation } from './planche';

/** Nom unique, pour reconnaître les données de ce test parmi celles du club. */
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

const AVEC_ADMINISTRATEUR = 'administrateur réel : local uniquement (le compte de la preview est un organisateur)';

/** US-056 : une compétition est une carte de la page de sa manifestation. */
const carteCompetition = (page: Page, nom: string) => page.getByRole('article', { name: nom });

/** US-057 : un seul « Supprimer… » dans le menu « ⋯ » de la carte. */
async function ouvrirSuppression(page: Page, competition: string) {
  await page.getByRole('button', { name: `Autres actions pour ${competition}` }).click();
  return page.getByRole('menuitem', { name: /^Supprimer…/ });
}

async function preparer(page: Page) {
  const manifestation = nomUnique();
  const competition = nomUnique();
  const epreuve = nomUnique();
  await seConnecter(page);
  await creerManifestationSimple(page, manifestation);
  const competitionId = await ajouterCompetition(page, manifestation, competition);
  await ajouterEpreuve(page, competitionId, epreuve);
  await ouvrirManifestation(page, manifestation);
  await expect(carteCompetition(page, competition)).toBeVisible({ timeout: 20_000 });
  return { manifestation, competition, epreuve };
}

test('US-041 CA-1 et CA-8 : supprimer une compétition avec son épreuve, après avoir saisi son nom @reel', async ({
  page,
}) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const { manifestation, competition, epreuve } = await preparer(page);

  await (await ouvrirSuppression(page, competition)).click();
  const fenetre = page.getByRole('dialog', {
    name: `Supprimer définitivement la compétition « ${competition} » ?`,
  });
  await expect(fenetre.getByText('Seront aussi supprimées : 1 épreuve, archivées comprises.')).toBeVisible({
    timeout: 20_000,
  });
  const valider = fenetre.getByRole('button', { name: 'Supprimer définitivement', exact: true });
  await expect(valider).toBeDisabled();
  await fenetre.getByLabel(`Saisissez « ${competition} » pour confirmer`).fill(`${competition} x`);
  await expect(valider).toBeDisabled();
  await fenetre.getByLabel(`Saisissez « ${competition} » pour confirmer`).fill(competition);
  await expect(valider).toBeEnabled();
  await valider.click();

  await expect(carteCompetition(page, competition)).toHaveCount(0, { timeout: 30_000 });
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
  await expect(await ouvrirSuppression(page, competition)).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('menu')).toContainText('Connexion requise pour supprimer');
  await page.keyboard.press('Escape');
  await context.setOffline(false);
  await expect(await ouvrirSuppression(page, competition)).not.toHaveAttribute('aria-disabled', 'true');
});

test('US-041 CA-2 (US-057 CA-5) : un organisateur voit « Supprimer… » pour une compétition vide, plus dès qu’elle contient une épreuve', async ({
  page,
}) => {
  test.skip(!process.env.BASE_URL, 'organisateur réel : preview uniquement (le compte local est un administrateur)');
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await creerManifestationSimple(page, manifestation);
  const competitionId = await ajouterCompetition(page, manifestation, competition);
  await ouvrirManifestation(page, manifestation);
  await expect(await ouvrirSuppression(page, competition)).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press('Escape');
  await ajouterEpreuve(page, competitionId, nomUnique());
  await ouvrirManifestation(page, manifestation);
  await expect(page.getByRole('button', { name: `Modifier ${competition}` })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: `Autres actions pour ${competition}` }).click();
  await expect(page.getByRole('menuitem', { name: /^Supprimer…/ })).toHaveCount(0);
});
