// Suppression de plusieurs épreuves d'un coup (US-040) : l'administrateur coche des épreuves dans la liste, les
// supprime en une confirmation, et voit un compte rendu. Les cases à cocher n'existent que pour un administrateur :
// le compte local l'est, celui de la preview est un organisateur. « Tout cocher » n'est pas cliqué ici (il viserait les
// épreuves des autres tests, lancés en parallèle) : il est couvert en unitaire.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';

/** Nom unique, pour reconnaître l’épreuve de ce test parmi celles du club. */
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

const MOTIF_PAGE_EPREUVE = /\/epreuves\/[0-9a-f-]{36}$/;
const AVEC_ADMINISTRATEUR = 'administrateur réel : local uniquement (le compte de la preview est un organisateur)';

/** Crée une épreuve par le formulaire et attend que le serveur l'ait reçue. */
async function creerEpreuve(page: Page, nom: string) {
  await page.goto('/epreuves/nouvelle');
  await page.getByLabel('Nom', { exact: true }).fill(nom);
  await page.getByLabel('Arme').selectOption('sabre');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(MOTIF_PAGE_EPREUVE);
  await expect(page.getByText('Ce PC est le pilote', { exact: true })).toBeVisible();
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
}

const case_ = (page: Page, nom: string) => page.getByRole('checkbox', { name: `Sélectionner l’épreuve ${nom}` });

/** Deux épreuves créées, puis la liste de l'organisateur. */
async function deuxEpreuves(page: Page) {
  const noms = [nomUnique(), nomUnique()] as const;
  await seConnecter(page);
  for (const nom of noms) await creerEpreuve(page, nom);
  await page.goto('/organisateur');
  await expect(page.getByRole('link', { name: noms[0], exact: true })).toBeVisible({ timeout: 20_000 });
  return noms;
}

test('US-040 CA-1 : cocher des épreuves affiche la barre et leur nombre', async ({ page }) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const [premiere, seconde] = await deuxEpreuves(page);

  await case_(page, premiere).check();
  await expect(page.getByText('1 épreuve sélectionnée')).toBeVisible();
  await case_(page, seconde).check();
  await expect(page.getByText('2 épreuves sélectionnées')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Supprimer définitivement…' })).toBeEnabled();
  await case_(page, seconde).uncheck();
  await expect(page.getByText('1 épreuve sélectionnée')).toBeVisible();
});

test('US-040 CA-3 et CA-4 : une confirmation unique supprime les épreuves cochées, avec un compte rendu', async ({
  page,
}) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const [premiere, seconde] = await deuxEpreuves(page);
  await case_(page, premiere).check();
  await case_(page, seconde).check();

  await page.getByRole('button', { name: 'Supprimer définitivement…' }).click();
  const fenetre = page.getByRole('group', { name: 'Supprimer définitivement ces 2 épreuves ?' });
  await expect(fenetre.getByText(premiere)).toBeVisible();
  await expect(fenetre.getByText(seconde)).toBeVisible();
  const valider = fenetre.getByRole('button', { name: 'Supprimer définitivement', exact: true });
  await expect(valider).toBeDisabled();
  await fenetre.getByLabel('Saisissez SUPPRIMER pour confirmer').fill('supprimer');
  await expect(valider).toBeDisabled();
  await fenetre.getByLabel('Saisissez SUPPRIMER pour confirmer').fill('SUPPRIMER');
  await expect(valider).toBeEnabled();
  await valider.click();

  await expect(page.getByText('2 épreuves supprimées')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('link', { name: premiere, exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: seconde, exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('link', { name: premiere, exact: true })).toHaveCount(0);
});

test('US-040 hors ligne : cases et bouton sont grisés, avec « Connexion requise pour supprimer »', async ({
  page,
  context,
}) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const [premiere] = await deuxEpreuves(page);

  await context.setOffline(true);
  await expect(case_(page, premiere)).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Supprimer définitivement…' })).toBeDisabled();
  await expect(page.getByText('Connexion requise pour supprimer')).toBeVisible();
  await context.setOffline(false);
  await expect(case_(page, premiere)).toBeEnabled();
});

test('US-040 CA-5 : un organisateur n’a ni case ni barre de suppression', async ({ page }) => {
  test.skip(!process.env.BASE_URL, 'organisateur réel : preview uniquement (le compte local est un administrateur)');
  const nom = nomUnique();
  await seConnecter(page);
  await creerEpreuve(page, nom);
  await page.goto('/organisateur');
  await expect(page.getByRole('link', { name: nom, exact: true })).toBeVisible();
  await expect(case_(page, nom)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Supprimer définitivement…' })).toHaveCount(0);
});
