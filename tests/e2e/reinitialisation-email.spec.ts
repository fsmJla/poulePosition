// US-019 : réinitialiser son mot de passe par e-mail. Réponses du serveur simulées : aucun e-mail réel ne part en CI ;
// la chaîne réelle (e-mail reçu, jeton, nouveau mot de passe) est couverte par serveur/src/reinitialisation.test.ts,
// et l'e-mail réel est vérifié en recette.
import { expect, test, type Page } from '@playwright/test';
import { sessionSimulee, simuler } from './simulation';

/** Jeton canonique de 32 octets en base64url (43 caractères). */
const JETON = 'A'.repeat(43);

async function remplirNouveau(page: Page, nouveau: string, confirmation = nouveau) {
  await page.getByLabel('Nouveau mot de passe', { exact: true }).fill(nouveau);
  await page.getByLabel('Confirmation du nouveau mot de passe').fill(confirmation);
  await page.getByRole('button', { name: 'Enregistrer le mot de passe' }).click();
}

test('US-019 CA-1 : depuis la connexion, la demande affiche toujours le même message', async ({ page }) => {
  let envoye: unknown = null;
  await simuler(page, '/mot-de-passe-oublie', 200, { ok: true }, 'POST', (corps) => (envoye = corps));
  await page.goto('/connexion');
  await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click();
  await expect(page).toHaveURL(/\/mot-de-passe-oublie$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Mot de passe oublié');

  const bouton = page.getByRole('button', { name: 'Recevoir un lien' });
  await page.getByLabel('E-mail').fill('pas-un-email');
  await expect(bouton).toBeDisabled();
  await page.getByLabel('E-mail').fill(' Orga@Club.fr ');
  await bouton.click();
  await expect(page.getByRole('status')).toHaveText(
    'Si un compte existe pour cet e-mail, un lien vient d’y être envoyé',
  );
  expect(envoye).toEqual({ email: 'orga@club.fr' });
  await expect(
    page.getByText('Vous pouvez aussi demander à un administrateur du club de réinitialiser votre mot de passe'),
  ).toBeVisible();
});

test('US-019 CA-4 : le lien permet de choisir un nouveau mot de passe, puis connecte directement', async ({ page }) => {
  let envoye: Record<string, unknown> = {};
  await simuler(page, '/mot-de-passe-oublie/nouveau', 200, sessionSimulee(false, 'organisateur'), 'POST', (corps) => {
    envoye = corps as Record<string, unknown>;
  });
  await simuler(page, '/session', 200, sessionSimulee(false, 'organisateur'), 'GET');
  await page.goto(`/reinitialisation#${JETON}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Choisir un nouveau mot de passe');
  await remplirNouveau(page, 'nouveau-mot-de-passe-e2e');

  await expect(page).toHaveURL(/\/organisateur$/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { level: 1, name: 'Manifestations et compétitions' })).toBeVisible();
  expect(Object.keys(envoye).sort()).toEqual(['cle', 'jeton', 'sel']);
  expect(envoye.jeton).toBe(JETON);
  expect(JSON.stringify(envoye)).not.toContain('nouveau-mot-de-passe-e2e');
});

test('US-019 CA-4 : les règles du nouveau mot de passe sont vérifiées avant tout envoi', async ({ page }) => {
  let appels = 0;
  await simuler(page, '/mot-de-passe-oublie/nouveau', 200, sessionSimulee(), 'POST', () => appels++);
  await page.goto(`/reinitialisation#${JETON}`);
  await remplirNouveau(page, 'court');
  await expect(page.getByText('Le mot de passe doit faire au moins 10 caractères')).toBeVisible();
  await remplirNouveau(page, 'nouveau-mot-de-passe-e2e', 'autre-mot-de-passe-e2e');
  await expect(page.getByText('Les deux mots de passe sont différents')).toBeVisible();
  expect(appels).toBe(0);
});

test('US-019 CA-3 : un lien tronqué invite à faire une nouvelle demande', async ({ page }) => {
  await page.goto(`/reinitialisation#${JETON.slice(5)}`);
  await expect(page.getByRole('alert')).toHaveText('Ce lien n’est plus valable : faites une nouvelle demande');
  await page.getByRole('link', { name: 'Faire une nouvelle demande' }).click();
  await expect(page).toHaveURL(/\/mot-de-passe-oublie$/);
});

test('US-019 CA-3 : un lien expiré ou déjà utilisé (refusé par le serveur) donne le même message', async ({ page }) => {
  await simuler(page, '/mot-de-passe-oublie/nouveau', 400, { ok: false, erreur: 'LIEN_INVALIDE' });
  await page.goto(`/reinitialisation#${JETON}`);
  await remplirNouveau(page, 'nouveau-mot-de-passe-e2e');
  await expect(page.getByRole('alert')).toHaveText('Ce lien n’est plus valable : faites une nouvelle demande', {
    timeout: 20_000,
  });
  await expect(page.getByRole('link', { name: 'Faire une nouvelle demande' })).toBeVisible();
});

test('US-019 hors ligne : la demande et le lien exigent le réseau', async ({ page, context }) => {
  await page.goto('/mot-de-passe-oublie');
  await page.getByLabel('E-mail').fill('orga@club.fr');
  await context.setOffline(true);
  await expect(page.getByRole('alert')).toHaveText('Nécessite une connexion internet');
  await expect(page.getByRole('button', { name: 'Recevoir un lien' })).toBeDisabled();
  await context.setOffline(false);

  await page.goto(`/reinitialisation#${JETON}`);
  await context.setOffline(true);
  await expect(page.getByRole('alert')).toHaveText('Nécessite une connexion internet');
  await expect(page.getByRole('button', { name: 'Enregistrer le mot de passe' })).toBeDisabled();
  await context.setOffline(false);
});
