import { expect, test, type Page } from '@playwright/test';
import { compteTest, seConnecter } from './compte';
import { connecterSimule, simuler } from './simulation';

/** Première visite : le service worker s'installe et précache l'application, puis prend le contrôle. */
async function installerHorsLigne(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
}

test('US-001 hors ligne : la page s’affiche après une première visite et indique « serveur injoignable »', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await installerHorsLigne(page);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName('Poule Position');
  await expect(page.getByRole('status')).toHaveText('Serveur injoignable');
  await context.setOffline(false);
});

test('US-005 CA-3 : hors ligne, un compte jamais venu sur l’appareil ne peut pas se connecter', async ({
  page,
  context,
}) => {
  await page.goto('/connexion');
  await installerHorsLigne(page);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('alert')).toHaveText(
    'Hors ligne : connexion possible uniquement sur un appareil déjà utilisé',
  );
  await page.getByLabel('E-mail').fill('orga@club.fr');
  await page.getByLabel('Mot de passe').fill('un mot de passe');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('alert')).toHaveText('Première connexion impossible hors ligne sur cet appareil');
  await expect(page).toHaveURL(/\/connexion$/);
  await context.setOffline(false);
});

/** Connexion en ligne puis déconnexion : l'appareil connaît désormais le compte (vérificateur local). */
async function appareilConnu(page: Page, compte = compteTest()) {
  await seConnecter(page, compte);
  await installerHorsLigne(page);
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page).toHaveURL(/\/connexion$/);
  return compte;
}

async function saisir(page: Page, email: string, motDePasse: string) {
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(motDePasse);
  await page.getByRole('button', { name: 'Se connecter' }).click();
}

const bandeauLocal = (page: Page) => page.getByRole('status').filter({ hasText: 'Hors ligne : connexion locale' });

test('US-005 CA-1 et CA-5 : reconnexion hors ligne avec le bandeau, puis revalidation au retour du réseau', async ({
  page,
  context,
}) => {
  const compte = await appareilConnu(page);

  await context.setOffline(true);
  await page.reload();
  await saisir(page, compte.email, compte.motDePasse);
  await expect(page).toHaveURL(/\/organisateur$/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Bonjour, .+/);
  await expect(bandeauLocal(page)).toBeVisible();

  await context.setOffline(false);
  await expect(bandeauLocal(page)).toHaveCount(0, { timeout: 20_000 });
  await expect(page).toHaveURL(/\/organisateur$/);
});

test('US-005 CA-4 : hors ligne, un mot de passe faux est refusé', async ({ page, context }) => {
  const compte = await appareilConnu(page);
  await context.setOffline(true);
  await saisir(page, compte.email, 'pas le bon mot de passe');
  await expect(page.getByRole('alert')).toHaveText('E-mail ou mot de passe incorrect', { timeout: 20_000 });
  await expect(page).toHaveURL(/\/connexion$/);
  await context.setOffline(false);
});

test('US-005 CA-6 : compte modifié pendant la coupure : retour à la connexion avec l’explication', async ({
  page,
  context,
}) => {
  // Réponses simulées : on ne modifie pas le compte réel de la preview.
  await connecterSimule(page, 'organisateur');
  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await expect(page).toHaveURL(/\/connexion$/);

  await context.setOffline(true);
  await saisir(page, 'simule@poule-position.test', 'mot-de-passe-simule');
  await expect(bandeauLocal(page)).toBeVisible({ timeout: 20_000 });

  // Le mot de passe a changé sur le serveur : la clé gardée est refusée au retour en ligne.
  await simuler(page, '/session', 401, { ok: false, erreur: 'IDENTIFIANTS_INVALIDES' });
  await context.setOffline(false);
  await expect(page).toHaveURL(/\/connexion$/, { timeout: 20_000 });
  await expect(page.getByRole('alert')).toHaveText('Votre compte a été modifié : reconnectez-vous');

  // Le vérificateur local a été effacé : hors ligne, le compte est redevenu inconnu de l'appareil.
  await context.setOffline(true);
  await saisir(page, 'simule@poule-position.test', 'mot-de-passe-simule');
  await expect(page.getByRole('alert')).toHaveText('Première connexion impossible hors ligne sur cet appareil');
  await context.setOffline(false);
});

test('US-003 hors ligne : une session déjà ouverte reste utilisable sans réseau', async ({ page, context }) => {
  await seConnecter(page);
  await installerHorsLigne(page);

  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveURL(/\/organisateur$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^Bonjour, .+/);
  await context.setOffline(false);
});

const boutonOublier = (page: Page) => page.getByRole('button', { name: 'Se déconnecter et oublier cet appareil' });

test('US-006 CA-1, CA-3 et hors ligne : oublier l’appareil, puis la reconnexion hors ligne est refusée', async ({
  page,
  context,
}) => {
  const compte = await appareilConnu(page);
  await context.setOffline(true);
  await saisir(page, compte.email, compte.motDePasse);
  await expect(bandeauLocal(page)).toBeVisible({ timeout: 20_000 });

  // L'oubli fonctionne sans réseau : l'effacement est purement local.
  await boutonOublier(page).click();
  await expect(boutonOublier(page)).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Les compétitions enregistrées sur cet appareil sont conservées.')).toBeVisible();
  await page.getByRole('button', { name: 'Oublier cet appareil', exact: true }).click();
  await expect(page).toHaveURL(/\/connexion$/);

  await saisir(page, compte.email, compte.motDePasse);
  await expect(page.getByRole('alert')).toHaveText('Première connexion impossible hors ligne sur cet appareil');
  await context.setOffline(false);
});

test('US-006 : « Annuler » n’efface rien, la reconnexion hors ligne reste possible', async ({ page, context }) => {
  const compte = compteTest();
  await seConnecter(page, compte);
  await installerHorsLigne(page);
  await boutonOublier(page).click();
  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByRole('button', { name: 'Oublier cet appareil', exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/\/organisateur$/);

  await page.getByRole('button', { name: 'Se déconnecter', exact: true }).click();
  await context.setOffline(true);
  await saisir(page, compte.email, compte.motDePasse);
  await expect(bandeauLocal(page)).toBeVisible({ timeout: 20_000 });
  await context.setOffline(false);
});
