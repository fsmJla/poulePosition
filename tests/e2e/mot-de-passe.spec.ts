// US-010 : changer son mot de passe. Les réponses du serveur au changement sont simulées (page.route) : un vrai
// changement modifierait le mot de passe du compte de test, partagé par les autres tests et par la CI. La chaîne
// réelle (serveur, cryptographie, version du mot de passe) est couverte par serveur/src/mot-de-passe.test.ts.
import { expect, test, type Page, type Route } from '@playwright/test';
import { compteTest, seConnecter } from './compte';

const MESSAGE_TEMPORAIRE = /mot de passe est temporaire/;

/** Réponse simulée d'une route du serveur (cross-origin : en-têtes CORS fournis, requête préalable comprise). */
async function simuler(page: Page, chemin: string, statut: number, corps: unknown, methode = 'POST') {
  await page.route(`**${chemin}`, async (route: Route) => {
    const origine = (await route.request().headerValue('origin')) ?? '*';
    const cors = {
      'Access-Control-Allow-Origin': origine,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (route.request().method() !== methode) return route.fallback();
    return route.fulfill({ status: statut, headers: cors, json: corps });
  });
}

function sessionSimulee(temporaire = false) {
  return {
    ok: true,
    jeton: 'jeton.simule.e2e',
    expireLe: Date.now() + 30 * 24 * 3600 * 1000,
    compte: { email: 'simule@poule-position.test', nom: 'Compte simulé', role: 'organisateur', temporaire },
  };
}

async function ouvrirChangement(page: Page) {
  await seConnecter(page);
  await page.getByRole('link', { name: 'Changer mon mot de passe' }).click();
  await expect(page).toHaveURL(/\/mot-de-passe$/);
}

async function remplir(page: Page, champs: { actuel?: string; nouveau: string; confirmation: string }) {
  if (champs.actuel !== undefined) await page.getByLabel('Mot de passe actuel').fill(champs.actuel);
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill(champs.nouveau);
  await page.getByLabel('Confirmation du nouveau mot de passe').fill(champs.confirmation);
  await page.getByRole('button', { name: 'Changer le mot de passe' }).click();
}

test('US-010 CA-1 : « Mot de passe modifié » s’affiche après le changement', async ({ page }) => {
  await ouvrirChangement(page);
  await simuler(page, '/compte/mot-de-passe', 200, sessionSimulee());
  await remplir(page, {
    actuel: compteTest().motDePasse,
    nouveau: 'nouveau-mot-de-passe-e2e',
    confirmation: 'nouveau-mot-de-passe-e2e',
  });
  await expect(page.getByRole('status')).toHaveText('Mot de passe modifié', { timeout: 20_000 });
});

test('US-010 CA-2 : chaque erreur s’affiche sous son champ, sans rien envoyer', async ({ page }) => {
  await ouvrirChangement(page);
  const envois: string[] = [];
  page.on('request', (requete) => {
    if (requete.url().includes('/compte/mot-de-passe')) envois.push(requete.url());
  });
  const actuel = compteTest().motDePasse;
  const nouveau = page.getByLabel('Nouveau mot de passe', { exact: true });

  await remplir(page, { actuel, nouveau: 'court', confirmation: 'court' });
  await expect(nouveau).toHaveAccessibleDescription('Le mot de passe doit faire au moins 10 caractères');

  await remplir(page, { actuel, nouveau: actuel, confirmation: actuel });
  await expect(nouveau).toHaveAccessibleDescription('Le nouveau mot de passe doit être différent de l’actuel');

  await remplir(page, { actuel, nouveau: 'nouveau-mot-de-passe-e2e', confirmation: 'autre-mot-de-passe-e2e' });
  await expect(page.getByLabel('Confirmation du nouveau mot de passe')).toHaveAccessibleDescription(
    'Les deux mots de passe sont différents',
  );
  expect(envois).toHaveLength(0);
});

test('US-010 CA-3 : un mot de passe actuel faux est refusé, et l’on reste connecté', async ({ page }) => {
  await ouvrirChangement(page);
  await simuler(page, '/compte/mot-de-passe', 403, { ok: false, erreur: 'MOT_DE_PASSE_INCORRECT' });
  await remplir(page, {
    actuel: 'pas-le-bon-mot-de-passe',
    nouveau: 'nouveau-mot-de-passe-e2e',
    confirmation: 'nouveau-mot-de-passe-e2e',
  });
  await expect(page.getByRole('alert')).toHaveText('Mot de passe actuel incorrect', { timeout: 20_000 });
  await expect(page).toHaveURL(/\/mot-de-passe$/);
  await page.getByRole('link', { name: "Retour à l'accueil de l'organisateur" }).click();
  await expect(page.getByRole('button', { name: 'Se déconnecter' })).toBeVisible();
});

test('US-010 CA-4 : après un mot de passe temporaire, on le change sans le ressaisir, puis on accède à l’application', async ({
  page,
}) => {
  await simuler(page, '/session/sel', 200, { ok: true, sel: 'AAAAAAAAAAAAAAAAAAAAAA' });
  await simuler(page, '/session', 200, sessionSimulee(true));
  await page.goto('/connexion');
  await page.getByLabel('E-mail').fill('simule@poule-position.test');
  await page.getByLabel('Mot de passe').fill('temporaire-123');
  await page.getByRole('button', { name: 'Se connecter' }).click();

  await expect(page).toHaveURL(/\/mot-de-passe$/, { timeout: 20_000 });
  await expect(page.getByText(MESSAGE_TEMPORAIRE)).toBeVisible();
  await expect(page.getByLabel('Mot de passe actuel')).toHaveCount(0);
  // Au rechargement, l'application revérifie la session : le serveur simulé la confirme, toujours temporaire.
  await simuler(page, '/session', 200, sessionSimulee(true), 'GET');
  await page.goto('/organisateur');
  await expect(page).toHaveURL(/\/mot-de-passe$/);
});

test('US-010 CA-4 : le changement d’un mot de passe temporaire ouvre l’accès à l’application', async ({ page }) => {
  await simuler(page, '/session/sel', 200, { ok: true, sel: 'AAAAAAAAAAAAAAAAAAAAAA' });
  await simuler(page, '/session', 200, sessionSimulee(true));
  await simuler(page, '/compte/mot-de-passe', 200, sessionSimulee(false));
  await page.goto('/connexion');
  await page.getByLabel('E-mail').fill('simule@poule-position.test');
  await page.getByLabel('Mot de passe').fill('temporaire-123');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/mot-de-passe$/, { timeout: 20_000 });

  await remplir(page, { nouveau: 'nouveau-mot-de-passe-e2e', confirmation: 'nouveau-mot-de-passe-e2e' });
  await expect(page.getByRole('status')).toHaveText('Mot de passe modifié', { timeout: 20_000 });
  await page.getByRole('link', { name: "Accueil de l'organisateur" }).click();
  await expect(page).toHaveURL(/\/organisateur$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bonjour, Compte simulé');
});

test('US-010 hors ligne : l’écran indique « Nécessite une connexion internet »', async ({ page, context }) => {
  await ouvrirChangement(page);
  await context.setOffline(true);
  await expect(page.getByRole('alert')).toHaveText('Nécessite une connexion internet');
  await expect(page.getByRole('button', { name: 'Changer le mot de passe' })).toBeDisabled();
  await context.setOffline(false);
  await expect(page.getByRole('alert')).toHaveCount(0);
});
