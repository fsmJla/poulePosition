// Publier ou dépublier toutes les épreuves d'une compétition (US-079 CA-3 à CA-5) : menu « ⋯ » de la compétition sur
// l'accueil et sur la page de la manifestation, et section « Publication » de l'écran de modification.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { ajouterCompetition, ajouterEpreuve, creerManifestationSimple, ouvrirManifestation } from './planche';

const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;
const menuDe = (page: Page, nom: string) => page.getByRole('button', { name: `Autres actions pour ${nom}` });
const entree = (page: Page, nom: string) => page.getByRole('menuitem', { name: new RegExp(`^${nom}`) });

/**
 * Une manifestation et sa compétition avec deux épreuves pilotées par ce PC (grille) et une d'un autre PC (écrite au
 * serveur) ; la page de la manifestation reste ouverte.
 */
async function creerCompetition(page: Page) {
  const manifestation = nomUnique();
  const competition = nomUnique();
  await creerManifestationSimple(page, manifestation);
  const competitionId = await ajouterCompetition(page, manifestation, competition);
  await ajouterEpreuve(page, competitionId, `${competition} autre PC`, '2027-03-14');
  await ouvrirManifestation(page, manifestation);
  await page.getByRole('link', { name: `Ajouter des épreuves à ${competition}` }).click();
  await page.getByRole('button', { name: 'M13 Dames', exact: true }).click();
  await page.getByRole('button', { name: 'M13 Hommes', exact: true }).click();
  await page.getByRole('button', { name: 'Créer les 2 épreuves' }).click();
  await expect(page).toHaveURL(/\/organisateur$/);
  return { manifestation, competition };
}

test('US-079 CA-3 et CA-4 : publier puis dépublier toutes les épreuves depuis le menu « ⋯ » de l’accueil', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await seConnecter(page);
  const { manifestation, competition } = await creerCompetition(page);
  const carte = page.getByRole('article', { name: manifestation });
  await expect(carte).toBeVisible({ timeout: 20_000 });

  // CA-3 : rien n'est publié, « Publier toutes les épreuves » est proposé, pas « Dépublier ».
  await menuDe(page, competition).click();
  await expect(entree(page, 'Dépublier toutes les épreuves')).toHaveCount(0);
  await entree(page, 'Publier toutes les épreuves').click();
  await expect(page.getByRole('status').filter({ hasText: '2 épreuves publiées' })).toContainText(
    '1 épreuve n’a pas été publiée : un autre PC est le pilote',
    { timeout: 20_000 },
  );
  await expect(carte.getByRole('img', { name: 'Publiée', exact: true })).toHaveCount(2);

  // CA-4 : « Dépublier toutes les épreuves » remet les épreuves de ce PC en non publiées.
  await menuDe(page, competition).click();
  await entree(page, 'Dépublier toutes les épreuves').click();
  await expect(page.getByRole('status').filter({ hasText: '2 épreuves dépubliées' })).toBeVisible({ timeout: 20_000 });
  await expect(carte.getByRole('img', { name: 'Publiée', exact: true })).toHaveCount(0);
});

test('US-079 CA-3 et CA-5 : le menu de la page de la manifestation et la section « Publication » de la modification', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await seConnecter(page);
  const { manifestation, competition } = await creerCompetition(page);
  await ouvrirManifestation(page, manifestation);
  await expect(page.getByRole('article', { name: competition })).toBeVisible({ timeout: 20_000 });

  // CA-5 : l'écran de modification compte les épreuves publiées et propose « Publier toutes les épreuves ».
  await page.getByRole('button', { name: `Modifier ${competition}` }).click();
  const section = page.getByRole('region', { name: 'Publication' });
  await expect(section).toContainText('0 épreuve publiée sur 3');
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeVisible();
  await section.getByRole('button', { name: 'Publier toutes les épreuves' }).click();
  await expect(section.getByRole('status')).toContainText('2 épreuves publiées');
  await expect(section).toContainText('2 épreuves publiées sur 3');

  // CA-3 : le menu de la carte propose maintenant « Dépublier », et encore « Publier » (l'épreuve de l'autre PC),
  // grisé : aucune épreuve à publier n'est pilotée ici.
  await menuDe(page, competition).click();
  await expect(entree(page, 'Dépublier toutes les épreuves')).toBeVisible();
  await expect(entree(page, 'Publier toutes les épreuves')).toBeDisabled();
  await expect(entree(page, 'Publier toutes les épreuves')).toHaveAccessibleDescription(
    'Lecture seule : un autre PC est le pilote',
  );
});

test('US-079 hors ligne : publier toutes les épreuves s’écrit dans les journaux locaux et attend le réseau', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await seConnecter(page);
  const { manifestation, competition } = await creerCompetition(page);
  const carte = page.getByRole('article', { name: manifestation });
  await expect(carte).toBeVisible({ timeout: 20_000 });
  // La liste ne se rafraîchit pas seule à l'envoi : on la relit jusqu'à ce que les épreuves soient parties.
  await expect(async () => {
    await page.goto('/organisateur');
    await expect(page.getByText('Pas encore envoyée')).toHaveCount(0, { timeout: 3_000 });
  }).toPass({ timeout: 40_000 });

  await context.setOffline(true);
  await expect(page.getByText(/^Hors ligne : liste du /)).toBeVisible({ timeout: 20_000 });
  await menuDe(page, competition).click();
  await entree(page, 'Publier toutes les épreuves').click();
  await expect(page.getByRole('status').filter({ hasText: '2 épreuves publiées' })).toContainText(
    'Publication en attente d’envoi',
    { timeout: 20_000 },
  );
  await expect(carte.getByRole('img', { name: 'Publiée', exact: true })).toHaveCount(2);

  // Au retour du réseau, les deux épreuves partent : la liste relue les montre toujours publiées.
  await context.setOffline(false);
  await expect(async () => {
    await page.goto('/organisateur');
    await expect(
      page.getByRole('article', { name: manifestation }).getByRole('img', { name: 'Publiée', exact: true }),
    ).toHaveCount(2, { timeout: 5_000 });
  }).toPass({ timeout: 40_000 });
});
