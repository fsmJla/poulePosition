// US-016 : modifier son profil (nom et avatar). Réponses du serveur simulées : on ne modifie pas le compte de test de
// la preview ; la chaîne réelle est couverte par serveur/src/profil.test.ts.
import { expect, test, type Page } from '@playwright/test';
import { connecterSimule, sessionSimulee, simuler } from './simulation';

async function ouvrirProfil(page: Page) {
  await connecterSimule(page, 'organisateur');
  await page.getByRole('link', { name: 'Mon profil' }).click();
  await expect(page).toHaveURL(/\/profil$/);
}

const avatar = (page: Page) => page.getByRole('img', { name: /^Avatar de / });

test('US-016 CA-1 et CA-2 : la page montre l’avatar, le nom, l’e-mail, le rôle et l’accès au mot de passe', async ({
  page,
}) => {
  await ouvrirProfil(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mon profil');
  await expect(avatar(page)).toHaveText('CS');
  await expect(page.getByLabel('Nom', { exact: true })).toHaveValue('Compte simulé');
  await expect(page.getByText('simule@poule-position.test')).toBeVisible();
  await expect(page.getByText('Organisateur', { exact: true })).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(8);
  await page.getByRole('link', { name: 'Changer mon mot de passe' }).click();
  await expect(page).toHaveURL(/\/mot-de-passe$/);
});

test('US-016 CA-3 et CA-4 : nom et couleur enregistrés, affichés aussitôt', async ({ page }) => {
  await ouvrirProfil(page);
  const apres = sessionSimulee(false, 'organisateur');
  let envoye: unknown = null;
  await simuler(
    page,
    '/compte',
    200,
    { ...apres, compte: { ...apres.compte, nom: 'Nouveau Nom', avatar: 'prune' } },
    'PATCH',
    (corps) => (envoye = corps),
  );

  const enregistrer = page.getByRole('button', { name: 'Enregistrer' });
  await expect(enregistrer).toBeDisabled();
  await page.getByLabel('Nom', { exact: true }).fill('Nouveau Nom');
  await page.getByRole('radio', { name: 'Couleur prune' }).check();
  await expect(avatar(page)).toHaveText('NN');
  await enregistrer.click();
  await expect(page.getByRole('status')).toHaveText('Profil enregistré');
  expect(envoye).toEqual({ nom: 'Nouveau Nom', avatar: 'prune' });
  await expect(avatar(page)).toHaveAttribute('data-couleur', 'prune');

  await page.getByRole('link', { name: "Retour à l'accueil de l'organisateur" }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bonjour, Nouveau Nom');
});

test('US-016 CA-6 : la tuile « Mon profil » remplace « Changer mon mot de passe », et le mot de passe y ramène', async ({
  page,
}) => {
  await connecterSimule(page, 'organisateur');
  const actions = page.getByRole('navigation', { name: 'Actions' });
  await expect(actions.getByRole('link', { name: 'Mon profil' })).toBeVisible();
  await expect(actions.getByRole('link', { name: 'Changer mon mot de passe' })).toHaveCount(0);
  await page.goto('/mot-de-passe');
  await page.getByRole('link', { name: 'Retour à mon profil' }).click();
  await expect(page).toHaveURL(/\/profil$/);
});

test('US-016 : un nom vide bloque l’enregistrement, avec un message sous le champ', async ({ page }) => {
  await ouvrirProfil(page);
  await page.getByLabel('Nom', { exact: true }).fill('   ');
  await expect(page.getByText('Le nom est obligatoire')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
});

test('US-016 hors ligne : la page s’affiche, l’enregistrement est grisé', async ({ page, context }) => {
  await ouvrirProfil(page);
  await page.getByLabel('Nom', { exact: true }).fill('Autre nom');
  await context.setOffline(true);
  await expect(page.getByRole('alert')).toHaveText('Nécessite une connexion internet');
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
  await expect(avatar(page)).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByRole('button', { name: 'Enregistrer' })).toBeEnabled();
});
