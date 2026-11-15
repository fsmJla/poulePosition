// Suppression d'une manifestation avec son contenu (US-042) : l'administrateur supprime la manifestation, ses compétitions et
// ses épreuves après avoir saisi son nom. Le compte local est administrateur, celui de la preview un organisateur :
// seul CA-2 y tourne.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { ajouterCompetition, ajouterEpreuve, creerManifestationSimple, ouvrirManifestation } from './planche';

/** Nom unique, pour reconnaître les données de ce test parmi celles du club. */
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

const AVEC_ADMINISTRATEUR = 'administrateur réel : local uniquement (le compte de la preview est un organisateur)';

const menu = (page: Page, manifestation: string) =>
  page.getByRole('button', { name: `Autres actions pour ${manifestation}` });

/** US-057 : un seul « Supprimer… » dans le menu « ⋯ » de la page. */
async function ouvrirSuppression(page: Page, manifestation: string) {
  await menu(page, manifestation).click();
  return page.getByRole('menuitem', { name: /^Supprimer…/ });
}

async function preparer(page: Page) {
  const manifestation = nomUnique();
  const competition = nomUnique();
  const dansCompetition = nomUnique();
  const directe = nomUnique();
  await seConnecter(page);
  await creerManifestationSimple(page, manifestation);
  const competitionId = await ajouterCompetition(page, manifestation, competition);
  await ajouterEpreuve(page, competitionId, dansCompetition);
  await ajouterEpreuve(page, competitionId, directe);
  await ouvrirManifestation(page, manifestation);
  await expect(page.getByRole('article', { name: competition })).toBeVisible({ timeout: 20_000 });
  return { manifestation, competition, dansCompetition, directe };
}

test('US-042 CA-1 et CA-8 : supprimer une manifestation avec sa compétition et ses épreuves, après avoir saisi son nom @reel', async ({
  page,
}) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const { manifestation, dansCompetition, directe } = await preparer(page);

  await (await ouvrirSuppression(page, manifestation)).click();
  const fenetre = page.getByRole('dialog', {
    name: `Supprimer définitivement la manifestation « ${manifestation} » ?`,
  });
  await expect(
    fenetre.getByText('Seront aussi supprimées : 1 compétition et 2 épreuves, archivées comprises.'),
  ).toBeVisible({
    timeout: 20_000,
  });
  const valider = fenetre.getByRole('button', { name: 'Supprimer définitivement', exact: true });
  await expect(valider).toBeDisabled();
  await fenetre.getByLabel(`Saisissez « ${manifestation} » pour confirmer`).fill(`${manifestation} x`);
  await expect(valider).toBeDisabled();
  await fenetre.getByLabel(`Saisissez « ${manifestation} » pour confirmer`).fill(manifestation);
  await expect(valider).toBeEnabled();
  await valider.click();

  // La manifestation n'existe plus : retour à l'accueil.
  await expect(page).toHaveURL(/\/organisateur$/, { timeout: 30_000 });
  await page.goto('/organisateur');
  await expect(page.getByRole('link', { name: dansCompetition, exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: directe, exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: manifestation })).toHaveCount(0);
});

test('US-042 hors ligne : le bouton est grisé, avec « Connexion requise pour supprimer »', async ({
  page,
  context,
}) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const { manifestation } = await preparer(page);

  await context.setOffline(true);
  await expect(await ouvrirSuppression(page, manifestation)).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('menu')).toContainText('Connexion requise pour supprimer');
  await page.keyboard.press('Escape');
  await context.setOffline(false);
  await expect(await ouvrirSuppression(page, manifestation)).not.toHaveAttribute('aria-disabled', 'true');
});

test('US-042 CA-2 (US-057 CA-5) : un organisateur n’a pas « Supprimer… » pour une manifestation qui contient une compétition', async ({
  page,
}) => {
  test.skip(!process.env.BASE_URL, 'organisateur réel : preview uniquement (le compte local est un administrateur)');
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await creerManifestationSimple(page, manifestation);
  await ajouterCompetition(page, manifestation, competition);
  await ouvrirManifestation(page, manifestation);
  await expect(page.getByRole('button', { name: 'Modifier', exact: true })).toBeVisible();
  await menu(page, manifestation).click();
  await expect(page.getByRole('menuitem', { name: /^Supprimer…/ })).toHaveCount(0);
});
