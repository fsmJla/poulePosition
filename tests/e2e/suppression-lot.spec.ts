// Suppression par lot de manifestations, d'épreuves et de compétitions (US-043) : l'administrateur coche des éléments de
// tous types dans la liste de l'accueil et les supprime en une confirmation. Le compte local est administrateur, celui de
// la preview un organisateur : seul CA-7 y tourne. « Tout cocher » n'est pas cliqué ici (il viserait les données des
// autres tests, lancés en parallèle) : il est couvert en unitaire.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';

/** Nom unique, pour reconnaître les données de ce test parmi celles du club. */
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

const AVEC_ADMINISTRATEUR = 'administrateur réel : local uniquement (le compte de la preview est un organisateur)';

const caseManifestation = (page: Page, nom: string) =>
  page.getByRole('checkbox', { name: `Sélectionner la manifestation ${nom}` });
const caseEpreuve = (page: Page, nom: string) => page.getByRole('checkbox', { name: `Sélectionner l’épreuve ${nom}` });
const caseCompetition = (page: Page, nom: string) =>
  page.getByRole('checkbox', { name: `Sélectionner la compétition ${nom}` });

/** Crée une manifestation du 14 au 15 mars 2027 et une épreuve au sabre, et attend qu'elles soient dans la liste. */
async function creerManifestationEtEpreuve(page: Page, manifestation: string, epreuve: string) {
  await page.goto('/manifestations');
  await page.getByRole('button', { name: 'Nouvelle manifestation' }).click();
  await page.getByLabel('Nom', { exact: true }).fill(manifestation);
  await page.getByLabel('Date de début').fill('2027-03-14');
  await page.getByLabel('Date de fin').fill('2027-03-15');
  await page.getByLabel('Lieu').fill('Salle Bellegrave');
  await page.getByRole('button', { name: 'Créer la manifestation' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: manifestation }).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: `Ajouter une épreuve à ${manifestation}` }).click();
  await page.getByLabel('Nom de l’épreuve').fill(epreuve);
  await page.getByLabel('Arme').selectOption('sabre');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(
    page
      .getByRole('region', { name: `Épreuves de ${manifestation}` })
      .getByRole('listitem')
      .filter({ hasText: epreuve }),
  ).toBeVisible({ timeout: 20_000 });
}

/** Crée, par le formulaire, une compétition rattachée à la manifestation (et à l'épreuve si elle est donnée), ou isolée. */
async function creerCompetition(page: Page, manifestation: string | null, epreuve: string | null, nom: string) {
  await page.goto('/competitions/nouvelle');
  if (manifestation) await page.getByLabel('Manifestation', { exact: true }).selectOption({ label: manifestation });
  if (epreuve) await page.getByLabel('Épreuve', { exact: true }).selectOption({ label: epreuve });
  await page.getByLabel('Nom', { exact: true }).fill(nom);
  if (!epreuve) await page.getByLabel('Arme').selectOption('sabre');
  if (manifestation) await page.getByRole('button', { name: 'lundi 15 mars 2027' }).click();
  await page.getByRole('button', { name: 'Créer la compétition' }).click();
  await expect(page).toHaveURL(/\/competitions\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
}

/** Une manifestation avec une épreuve et une compétition dedans, une compétition directe, et une compétition isolée. */
async function preparer(page: Page) {
  const donnees = {
    manifestation: nomUnique(),
    epreuve: nomUnique(),
    dansEpreuve: nomUnique(),
    directe: nomUnique(),
    isolee: nomUnique(),
  };
  await seConnecter(page);
  await creerManifestationEtEpreuve(page, donnees.manifestation, donnees.epreuve);
  await creerCompetition(page, donnees.manifestation, donnees.epreuve, donnees.dansEpreuve);
  await creerCompetition(page, donnees.manifestation, null, donnees.directe);
  await creerCompetition(page, null, null, donnees.isolee);
  await ouvrirLaListe(page, donnees.manifestation, donnees.isolee);
  return donnees;
}

/** La liste de l'accueil, avec la manifestation dépliée (celle de 2027 est repliée par défaut). */
async function ouvrirLaListe(page: Page, manifestation: string, isolee: string) {
  await page.goto('/organisateur');
  await expect(page.getByRole('link', { name: isolee, exact: true })).toBeVisible({ timeout: 20_000 });
  await page.locator('summary').filter({ hasText: manifestation }).click();
}

test('US-043 CA-1, CA-2 et CA-4 : cocher une manifestation couvre son contenu, et une confirmation unique supprime tout', async ({
  page,
}) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const { manifestation, epreuve, dansEpreuve, directe, isolee } = await preparer(page);

  // CA-1 : une case sur chaque type.
  for (const laCase of [
    caseManifestation(page, manifestation),
    caseEpreuve(page, epreuve),
    caseCompetition(page, dansEpreuve),
    caseCompetition(page, directe),
    caseCompetition(page, isolee),
  ]) {
    await expect(laCase).toBeEnabled();
  }

  // CA-2 : cocher la manifestation verrouille son contenu, et le compteur est par type.
  await caseManifestation(page, manifestation).check();
  for (const laCase of [
    caseEpreuve(page, epreuve),
    caseCompetition(page, dansEpreuve),
    caseCompetition(page, directe),
  ]) {
    await expect(laCase).toBeChecked();
    await expect(laCase).toBeDisabled();
  }
  await expect(page.getByText('1 manifestation, 1 épreuve, 2 compétitions', { exact: true })).toBeVisible();
  await caseCompetition(page, isolee).check();
  await expect(page.getByText('1 manifestation, 1 épreuve, 3 compétitions', { exact: true })).toBeVisible();

  // CA-2 : décocher la manifestation libère son contenu.
  await caseManifestation(page, manifestation).uncheck();
  await expect(caseEpreuve(page, epreuve)).toBeEnabled();
  await expect(caseEpreuve(page, epreuve)).not.toBeChecked();
  await expect(page.getByText('1 compétition sélectionnée')).toBeVisible();
  await caseManifestation(page, manifestation).check();

  // CA-4 : la confirmation donne le décompte et ne liste que les éléments cochés directement.
  await page.getByRole('button', { name: 'Supprimer définitivement…' }).click();
  const fenetre = page.getByRole('group', {
    name: 'Supprimer définitivement 1 manifestation, 1 épreuve, 3 compétitions ?',
  });
  await expect(fenetre.getByText(manifestation)).toBeVisible();
  await expect(fenetre.getByText(isolee)).toBeVisible();
  await expect(fenetre.getByText(epreuve)).toHaveCount(0);
  await expect(fenetre.getByText(dansEpreuve)).toHaveCount(0);
  const valider = fenetre.getByRole('button', { name: 'Supprimer définitivement', exact: true });
  await expect(valider).toBeDisabled();
  await fenetre.getByLabel('Saisissez SUPPRIMER pour confirmer').fill('SUPPRIMER');
  await expect(valider).toBeEnabled();
  await valider.click();

  // CA-5 et CA-6 : tout est supprimé, avec un compte rendu, et la liste se relit.
  await expect(page.getByText('Supprimé : 1 manifestation, 1 compétition')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('summary').filter({ hasText: manifestation })).toHaveCount(0);
  for (const nom of [epreuve, dansEpreuve, directe, isolee]) {
    await expect(page.getByRole('link', { name: nom, exact: true })).toHaveCount(0);
  }
  await expect(caseEpreuve(page, epreuve)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('link', { name: isolee, exact: true })).toHaveCount(0);
  await expect(page.locator('summary').filter({ hasText: manifestation })).toHaveCount(0);
});

test('US-043 CA-5 : une épreuve et des compétitions cochées sans leur manifestation se suppriment sans la toucher', async ({
  page,
}) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const { manifestation, epreuve, dansEpreuve, directe, isolee } = await preparer(page);

  await caseEpreuve(page, epreuve).check();
  await caseCompetition(page, dansEpreuve).check();
  await caseCompetition(page, isolee).check();
  await expect(page.getByText('1 épreuve, 2 compétitions', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Supprimer définitivement…' }).click();
  const fenetre = page.getByRole('group', { name: 'Supprimer définitivement 1 épreuve, 2 compétitions ?' });
  await fenetre.getByLabel('Saisissez SUPPRIMER pour confirmer').fill('SUPPRIMER');
  await fenetre.getByRole('button', { name: 'Supprimer définitivement', exact: true }).click();

  await expect(page.getByText('Supprimé : 1 épreuve, 1 compétition')).toBeVisible({ timeout: 60_000 });
  await expect(caseEpreuve(page, epreuve)).toHaveCount(0);
  await expect(page.getByRole('link', { name: isolee, exact: true })).toHaveCount(0);
  // La manifestation et sa compétition directe restent (la liste relue replie la manifestation).
  await page.locator('summary').filter({ hasText: manifestation }).click();
  await expect(page.getByRole('link', { name: directe, exact: true })).toBeVisible();
});

test('US-043 hors ligne : cases et bouton sont grisés, avec « Connexion requise pour supprimer »', async ({
  page,
  context,
}) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const { manifestation, isolee } = await preparer(page);

  await context.setOffline(true);
  await expect(caseManifestation(page, manifestation)).toBeDisabled();
  await expect(caseCompetition(page, isolee)).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Supprimer définitivement…' })).toBeDisabled();
  await expect(page.getByText('Connexion requise pour supprimer')).toBeVisible();
  await context.setOffline(false);
  await expect(caseManifestation(page, manifestation)).toBeEnabled();
});

test('US-043 CA-7 : un organisateur n’a aucune case ni barre de suppression', async ({ page }) => {
  test.skip(!process.env.BASE_URL, 'organisateur réel : preview uniquement (le compte local est un administrateur)');
  const manifestation = nomUnique();
  await seConnecter(page);
  await creerManifestationEtEpreuve(page, manifestation, nomUnique());
  await page.goto('/organisateur');
  await expect(page.locator('summary').filter({ hasText: manifestation })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('checkbox', { name: /^Sélectionner/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Supprimer définitivement…' })).toHaveCount(0);
});
