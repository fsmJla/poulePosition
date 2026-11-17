// Reprendre en main toutes les épreuves d'une compétition (US-080 CA-3 à CA-5) : menu « ⋯ » de la compétition sur
// l'accueil, une seule confirmation, puis ce PC pilote chaque épreuve (comme US-029).
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { ajouterCompetition, ajouterEpreuve, creerManifestationSimple } from './planche';

const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;
const menuDe = (page: Page, nom: string) => page.getByRole('button', { name: `Autres actions pour ${nom}` });
const entree = (page: Page) => page.getByRole('menuitem', { name: /^Tout reprendre en main/ });

/** Une compétition avec deux épreuves écrites au serveur par un autre appareil : ce PC n'en est pas le pilote. */
async function creerCompetition(page: Page) {
  const manifestation = nomUnique();
  const competition = nomUnique();
  await creerManifestationSimple(page, manifestation);
  const competitionId = await ajouterCompetition(page, manifestation, competition);
  await ajouterEpreuve(page, competitionId, `${competition} M13`, '2027-03-14', { categorie: 'M13', sexe: 'dames' });
  await ajouterEpreuve(page, competitionId, `${competition} M15`, '2027-03-15', { categorie: 'M15', sexe: 'dames' });
  await page.goto('/organisateur');
  const carte = page.getByRole('article', { name: manifestation });
  await expect(carte).toBeVisible({ timeout: 20_000 });
  await expect(carte.getByRole('img', { name: /^Lecture seule/ })).toHaveCount(2, { timeout: 20_000 });
  return { carte, competition };
}

test('US-080 CA-3, CA-4 et CA-5 : tout reprendre en main depuis le menu « ⋯ », après une seule confirmation', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await seConnecter(page);
  const { carte, competition } = await creerCompetition(page);

  // CA-4 : la confirmation dit combien d'épreuves passent sur ce PC ; « Annuler » ne change rien.
  await menuDe(page, competition).click();
  await entree(page).click();
  const fenetre = page.getByRole('dialog');
  await expect(fenetre).toContainText(`Tout reprendre en main « ${competition} » ?`, { timeout: 20_000 });
  await expect(fenetre).toContainText('2 épreuves pilotées par un autre PC passent sur ce PC.');
  await fenetre.getByRole('button', { name: 'Annuler' }).click();
  await expect(fenetre).toHaveCount(0);
  await expect(carte.getByRole('img', { name: /^Lecture seule/ })).toHaveCount(2);

  // CA-5 : confirmée, ce PC pilote les deux épreuves ; un message le dit.
  await menuDe(page, competition).click();
  await entree(page).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Tout reprendre en main' }).click();
  await expect(page.getByRole('status').filter({ hasText: '2 épreuves reprises en main' })).toBeVisible({
    timeout: 30_000,
  });
  await expect(carte.getByRole('img', { name: 'Ce PC est le pilote' })).toHaveCount(2);

  // CA-3 : ce PC pilote tout, l'entrée n'est plus proposée.
  await menuDe(page, competition).click();
  await expect(page.getByRole('menuitem', { name: /^Ajouter des épreuves/ })).toBeVisible();
  await expect(entree(page)).toHaveCount(0);
});

test('US-080 hors ligne : « Tout reprendre en main » est grisé sans réseau', async ({ page, context }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await seConnecter(page);
  const { competition } = await creerCompetition(page);

  await context.setOffline(true);
  await expect(page.getByText(/^Hors ligne : liste du /)).toBeVisible({ timeout: 20_000 });
  await menuDe(page, competition).click();
  await expect(entree(page)).toBeDisabled();
  await expect(entree(page)).toHaveAccessibleDescription('Nécessite une connexion internet');
  await context.setOffline(false);
});
