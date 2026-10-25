// Réponses simulées du serveur pour les E2E (US-010, US-007) : utiles quand un vrai appel modifierait des données
// partagées par la CI (compte de test de la preview). La chaîne réelle est couverte par les tests d'intégration.
import type { Page, Route } from '@playwright/test';
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
      'Access-Control-Allow-Methods': 'GET, POST, PATCH',
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
