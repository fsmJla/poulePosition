// US-009 : réinitialiser le mot de passe d'un compte. Réponses de /comptes simulées (même raison qu'US-007 : ne pas
// modifier les comptes réels de la preview) ; la chaîne réelle est couverte par serveur/src/comptes.test.ts.
import { expect, test, type Page } from '@playwright/test';
import { ouvrirPageComptes } from './compte';
import { connecterSimule, simuler } from './simulation';

const ORGA = {
  id: 'c2',
  email: 'orga@club.fr',
  nom: 'Bruno Petit',
  role: 'organisateur',
  actif: true,
  temporaire: false,
  derniereConnexion: Date.UTC(2026, 9, 21, 9, 0),
};

async function ouvrirComptes(page: Page) {
  await simuler(page, '/comptes', 200, { ok: true, comptes: [ORGA] }, 'GET');
  await connecterSimule(page, 'administrateur');
  await ouvrirPageComptes(page);
  await expect(page).toHaveURL(/\/comptes$/);
}

test('US-009 CA-1 : réinitialisation confirmée, mot de passe temporaire affiché une fois avec « Copier »', async ({
  page,
}) => {
  await ouvrirComptes(page);
  let envoye: Record<string, unknown> = {};
  await simuler(
    page,
    '/comptes/c2/mot-de-passe',
    200,
    { ok: true, compte: { ...ORGA, temporaire: true } },
    'POST',
    (corps) => (envoye = corps as Record<string, unknown>),
  );

  await page.getByRole('button', { name: 'Réinitialiser le mot de passe de Bruno Petit' }).click();
  // Rien n'est envoyé avant la confirmation.
  expect(envoye).toEqual({});
  await page.getByRole('button', { name: 'Confirmer la réinitialisation' }).click();

  const motDePasse = page.getByTestId('mot-de-passe-temporaire');
  await expect(motDePasse).toHaveText(/^[A-Za-z2-9]{12}$/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Mot de passe réinitialisé' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Copier' })).toBeVisible();
  expect(Object.keys(envoye).sort()).toEqual(['cle', 'sel']);
  expect(JSON.stringify(envoye)).not.toContain((await motDePasse.textContent()) ?? '');
  await expect(page.getByRole('row').filter({ hasText: 'Bruno Petit' })).toContainText('mot de passe temporaire');

  await page.getByRole('button', { name: 'J’ai transmis le mot de passe' }).click();
  await expect(motDePasse).toHaveCount(0);
});

test('US-009 CA-1 : « Annuler » renonce à la réinitialisation', async ({ page }) => {
  await ouvrirComptes(page);
  await page.getByRole('button', { name: 'Réinitialiser le mot de passe de Bruno Petit' }).click();
  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByRole('button', { name: 'Confirmer la réinitialisation' })).toHaveCount(0);
  await expect(page.getByTestId('mot-de-passe-temporaire')).toHaveCount(0);
});

// US-019 : « Mot de passe oublié ? » mène désormais à la demande d'un lien par e-mail, qui garde la mention de
// l'administrateur (US-009 CA-4).
test('US-009 CA-4 : « Mot de passe oublié ? » rappelle qu’un administrateur peut réinitialiser le mot de passe', async ({
  page,
}) => {
  await page.goto('/connexion');
  await page.getByRole('link', { name: 'Mot de passe oublié ?' }).click();
  await expect(page).toHaveURL(/\/mot-de-passe-oublie$/);
  await expect(
    page.getByText('Vous pouvez aussi demander à un administrateur du club de réinitialiser votre mot de passe'),
  ).toBeVisible();
});

test('US-009 hors ligne : le bouton de réinitialisation est grisé', async ({ page, context }) => {
  await ouvrirComptes(page);
  const bouton = page.getByRole('button', { name: 'Réinitialiser le mot de passe de Bruno Petit' });
  await expect(bouton).toBeEnabled();
  await context.setOffline(true);
  await expect(bouton).toBeDisabled();
  await expect(bouton).toHaveAttribute('title', 'Nécessite une connexion internet');
  await context.setOffline(false);
  await expect(bouton).toBeEnabled();
});
