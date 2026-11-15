// US-003 : se connecter et se déconnecter (en ligne). US-004 : aucun essai erroné réel sur le compte de test, qui
// serait bloqué 15 minutes pour les autres passages de la CI ; la vraie limitation est couverte par
// serveur/src/connexion.test.ts.
import { expect, test, type Page } from '@playwright/test';
import { boutonMenuCompte, choisirDansMenuCompte, compteTest, seConnecter } from './compte';
import { simuler } from './simulation';

async function essayer(page: Page, email: string, motDePasse: string) {
  await page.goto('/connexion');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(motDePasse);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

test('US-003 CA-1 (US-055 : nom dans l’entête, plus de « Bonjour » ni de rôle) : l’organisateur se connecte et voit son nom', async ({
  page,
}) => {
  const compte = compteTest();
  await seConnecter(page, compte);
  await expect(page.getByRole('heading', { level: 1, name: 'Manifestations et compétitions' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: compte.nom ? `Menu du compte de ${compte.nom}` : /^Menu du compte de / }),
  ).toBeVisible();
});

test('US-003 CA-2 : un e-mail inconnu affiche « E-mail ou mot de passe incorrect » @reel', async ({ page }) => {
  // Un e-mail différent à chaque passage : son compteur d'essais (US-004 CA-4) ne se remplit jamais.
  await essayer(page, `inconnu-${crypto.randomUUID()}@poule-position.test`, compteTest().motDePasse);
  await expect(page.getByRole('alert')).toHaveText('E-mail ou mot de passe incorrect', { timeout: 20_000 });
  await expect(page).toHaveURL(/\/connexion$/);
});

test('US-003 CA-2 : un mot de passe faux affiche le même message (réponse simulée)', async ({ page }) => {
  await simuler(page, '/session', 401, { ok: false, erreur: 'IDENTIFIANTS_INVALIDES' });
  await essayer(page, compteTest().email, 'pas-le-bon-mot-de-passe');
  await expect(page.getByRole('alert')).toHaveText('E-mail ou mot de passe incorrect', { timeout: 20_000 });
  await expect(page).toHaveURL(/\/connexion$/);
});

test('US-004 CA-1 : un compte bloqué affiche « Trop d’essais : réessayez dans 15 minutes » (réponse simulée)', async ({
  page,
}) => {
  await simuler(page, '/session', 429, { ok: false, erreur: 'TROP_D_ESSAIS' });
  await essayer(page, compteTest().email, compteTest().motDePasse);
  await expect(page.getByRole('alert')).toHaveText('Trop d’essais : réessayez dans 15 minutes', { timeout: 20_000 });
  // Le blocage du serveur ne fait pas basculer vers la connexion locale (US-005).
  await expect(page).toHaveURL(/\/connexion$/);
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

test('US-003 CA-4 : on reste connecté après un rechargement ou une réouverture @reel', async ({ page, context }) => {
  await seConnecter(page);
  await page.reload();
  await expect(page).toHaveURL(/\/organisateur$/);
  await expect(boutonMenuCompte(page)).toBeVisible();

  await page.close();
  const rouverte = await context.newPage();
  await rouverte.goto('/');
  await expect(rouverte.getByRole('link', { name: "Accueil de l'organisateur" })).toBeVisible();
  await rouverte.goto('/organisateur');
  await expect(boutonMenuCompte(rouverte)).toBeVisible();
});

test('US-003 CA-5 : « Se déconnecter » ramène à l’écran de connexion @reel', async ({ page }) => {
  await seConnecter(page);
  await choisirDansMenuCompte(page, 'Se déconnecter');
  await expect(page).toHaveURL(/\/connexion$/);
  await page.reload();
  await page.goto('/organisateur');
  await expect(page).toHaveURL(/\/connexion$/);
});

test('US-003 CA-6 : un visiteur voit l’accueil public, et une page réservée le renvoie à la connexion', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('Poule Position');
  await page.getByRole('link', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/connexion$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Se connecter');

  await page.goto('/organisateur');
  await expect(page).toHaveURL(/\/connexion$/);
});
