// US-003 : se connecter et se déconnecter (en ligne).
import { expect, test } from '@playwright/test';
import { compteTest, seConnecter } from './compte';

test('US-003 CA-1 : l’organisateur se connecte et voit son nom et son rôle', async ({ page }) => {
  const compte = compteTest();
  await seConnecter(page, compte);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    compte.nom ? `Bonjour, ${compte.nom}` : /^Bonjour, .+/,
  );
  await expect(page.getByText(/^(Administrateur|Organisateur)$/)).toBeVisible();
});

test('US-003 CA-2 : des identifiants refusés affichent « E-mail ou mot de passe incorrect »', async ({ page }) => {
  const compte = compteTest();
  for (const essai of [
    { email: compte.email, motDePasse: 'pas-le-bon-mot-de-passe' },
    { email: 'inconnu@poule-position.test', motDePasse: compte.motDePasse },
  ]) {
    await page.goto('/connexion');
    await page.getByLabel('E-mail').fill(essai.email);
    await page.getByLabel('Mot de passe').fill(essai.motDePasse);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page.getByRole('alert')).toHaveText('E-mail ou mot de passe incorrect', { timeout: 20_000 });
    await expect(page).toHaveURL(/\/connexion$/);
  }
});

test('US-003 : le bouton « Se connecter » reste inactif tant qu’un champ est vide', async ({ page }) => {
  await page.goto('/connexion');
  const bouton = page.getByRole('button', { name: 'Se connecter' });
  await expect(bouton).toBeDisabled();
  await page.getByLabel('E-mail').fill('orga@club.fr');
  await expect(bouton).toBeDisabled();
  await page.getByLabel('Mot de passe').fill('un mot de passe');
  await expect(bouton).toBeEnabled();
});

test('US-003 CA-4 : on reste connecté après un rechargement ou une réouverture', async ({ page, context }) => {
  await seConnecter(page);
  await page.reload();
  await expect(page).toHaveURL(/\/organisateur$/);
  await expect(page.getByRole('button', { name: 'Se déconnecter' })).toBeVisible();

  await page.close();
  const rouverte = await context.newPage();
  await rouverte.goto('/');
  await expect(rouverte.getByRole('link', { name: "Accueil de l'organisateur" })).toBeVisible();
  await rouverte.goto('/organisateur');
  await expect(rouverte.getByRole('button', { name: 'Se déconnecter' })).toBeVisible();
});

test('US-003 CA-5 : « Se déconnecter » ramène à l’écran de connexion', async ({ page }) => {
  await seConnecter(page);
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page).toHaveURL(/\/connexion$/);
  await page.reload();
  await page.goto('/organisateur');
  await expect(page).toHaveURL(/\/connexion$/);
});

test('US-003 CA-6 : un visiteur voit l’accueil public, et une page réservée le renvoie à la connexion', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('poulePosition');
  await page.getByRole('link', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/connexion$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Se connecter');

  await page.goto('/organisateur');
  await expect(page).toHaveURL(/\/connexion$/);
});
