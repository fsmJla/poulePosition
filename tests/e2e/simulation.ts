// Réponses simulées du serveur pour les E2E (US-010, US-007) : utiles quand un vrai appel modifierait des données
// partagées par la CI (compte de test de la preview). La chaîne réelle est couverte par les tests d'intégration.
import { expect, type Page, type Route } from '@playwright/test';
import type { Role } from '@poule-position/domaine';

/** Réponse simulée d'une route du serveur (cross-origin : en-têtes CORS fournis, requête préalable comprise). */
export async function simuler(
  page: Page,
  chemin: string,
  statut: number,
  corps: unknown,
  methode = 'POST',
  surRequete?: (corps: unknown) => void,
) {
  await page.route(`**${chemin}`, async (route: Route) => {
    const origine = (await route.request().headerValue('origin')) ?? '*';
    const cors = {
      'Access-Control-Allow-Origin': origine,
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE',
    };
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (route.request().method() !== methode) return route.fallback();
    surRequete?.(route.request().postDataJSON());
    return route.fulfill({ status: statut, headers: cors, json: corps });
  });
}

/** Session simulée, renvoyée par une connexion ou une revalidation simulées. */
export function sessionSimulee(temporaire = false, role: Role = 'organisateur') {
  return {
    ok: true,
    jeton: 'jeton.simule.e2e',
    expireLe: Date.now() + 30 * 24 * 3600 * 1000,
    compte: { email: 'simule@poule-position.test', nom: 'Compte simulé', role, temporaire },
  };
}

/** Connexion simulée avec le rôle voulu (revalidation au rechargement comprise). */
export async function connecterSimule(page: Page, role: Role) {
  await simuler(page, '/session/sel', 200, { ok: true, sel: 'AAAAAAAAAAAAAAAAAAAAAA' });
  await simuler(page, '/session', 200, sessionSimulee(false, role));
  await simuler(page, '/session', 200, sessionSimulee(false, role), 'GET');
  await page.goto('/connexion');
  await page.getByLabel('E-mail').fill('simule@poule-position.test');
  await page.getByLabel('Mot de passe', { exact: true }).fill('mot-de-passe-simule');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/organisateur$/, { timeout: 20_000 });
}
