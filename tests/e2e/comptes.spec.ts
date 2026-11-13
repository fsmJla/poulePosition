// US-007 : lister, créer et modifier les comptes. Les réponses de /comptes sont simulées (page.route) : de vrais
// appels créeraient des comptes, impossibles à supprimer avant US-008, sur le serveur partagé de la preview. La chaîne
// réelle (serveur, droits, unicité, dernier administrateur) est couverte par serveur/src/comptes.test.ts.
// La connexion est simulée elle aussi, avec le rôle voulu : le compte E2E réel de la preview est un organisateur.
import { expect, test, type Page } from '@playwright/test';
import { ouvrirPageComptes } from './compte';
import { connecterSimule, simuler } from './simulation';

const ADMIN = {
  id: 'c1',
  email: 'admin@club.fr',
  nom: 'Alice Martin',
  role: 'administrateur',
  actif: true,
  temporaire: false,
  derniereConnexion: Date.UTC(2026, 9, 20, 18, 30),
};
const ORGA = {
  id: 'c2',
  email: 'orga@club.fr',
  nom: 'Bruno Petit',
  role: 'organisateur',
  actif: true,
  temporaire: true,
  derniereConnexion: null,
};

/** Administrateur connecté, sur la page « Comptes », avec une liste simulée. */
async function ouvrirComptes(page: Page) {
  await simuler(page, '/comptes', 200, { ok: true, comptes: [ADMIN, ORGA] }, 'GET');
  await connecterSimule(page, 'administrateur');
  await ouvrirPageComptes(page);
  await expect(page).toHaveURL(/\/comptes$/);
}

const ligne = (page: Page, nom: string) => page.getByRole('row').filter({ hasText: nom });

test('US-007 CA-1 : l’administrateur voit la liste des comptes', async ({ page }) => {
  await ouvrirComptes(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Comptes');
  await expect(ligne(page, 'Alice Martin')).toContainText('admin@club.fr');
  await expect(ligne(page, 'Alice Martin')).toContainText('Administrateur');
  await expect(ligne(page, 'Alice Martin')).toContainText('Actif');
  await expect(ligne(page, 'Alice Martin')).toContainText('20/10/2026');
  await expect(ligne(page, 'Bruno Petit')).toContainText('Organisateur');
  await expect(ligne(page, 'Bruno Petit')).toContainText('Jamais');
  await expect(ligne(page, 'Bruno Petit')).toContainText('mot de passe temporaire');
});

test('US-007 CA-2 : le mot de passe temporaire s’affiche une seule fois, avec « Copier » @reel', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await ouvrirComptes(page);
  let envoye: Record<string, unknown> = {};
  const nouveau = { ...ORGA, id: 'c3', email: 'claire@club.fr', nom: 'Claire Durand' };
  await simuler(page, '/comptes', 201, { ok: true, compte: nouveau }, 'POST', (corps) => {
    envoye = corps as Record<string, unknown>;
  });

  await page.getByLabel('E-mail').fill('Claire@Club.fr');
  await page.getByLabel('Nom').fill('Claire Durand');
  await page.getByLabel('Rôle').selectOption('organisateur');
  await page.getByRole('button', { name: 'Créer le compte' }).click();

  const motDePasse = page.getByTestId('mot-de-passe-temporaire');
  await expect(motDePasse).toHaveText(/^[A-Za-z2-9]{12}$/, { timeout: 20_000 });
  const valeur = (await motDePasse.textContent()) ?? '';
  expect(Object.keys(envoye).sort()).toEqual(['cle', 'email', 'nom', 'role', 'sel']);
  expect(envoye.email).toBe('claire@club.fr');
  expect(JSON.stringify(envoye)).not.toContain(valeur);
  await expect(ligne(page, 'Claire Durand')).toBeVisible();

  await page.getByRole('button', { name: 'Copier' }).click();
  await expect(page.getByRole('button', { name: 'Copié' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(valeur);

  await page.getByRole('button', { name: 'J’ai transmis le mot de passe' }).click();
  await expect(motDePasse).toHaveCount(0);
});

test('US-007 : e-mail mal formé ou nom vide : bouton inactif, message sous le champ', async ({ page }) => {
  await ouvrirComptes(page);
  const bouton = page.getByRole('button', { name: 'Créer le compte' });
  await expect(bouton).toBeDisabled();
  await page.getByLabel('E-mail').fill('pas-un-email');
  await page.getByLabel('Nom').fill('Claire');
  await expect(page.getByLabel('E-mail')).toHaveAccessibleDescription('E-mail invalide');
  await expect(bouton).toBeDisabled();
  await page.getByLabel('E-mail').fill('claire@club.fr');
  await expect(bouton).toBeEnabled();
});

test('US-007 CA-3 : un e-mail déjà utilisé est refusé', async ({ page }) => {
  await ouvrirComptes(page);
  await simuler(page, '/comptes', 409, { ok: false, erreur: 'EMAIL_DEJA_UTILISE' }, 'POST');
  await page.getByLabel('E-mail').fill('ORGA@club.fr');
  await page.getByLabel('Nom').fill('Doublon');
  await page.getByRole('button', { name: 'Créer le compte' }).click();
  await expect(page.getByRole('alert')).toHaveText('Un compte utilise déjà cet e-mail', { timeout: 20_000 });
  await expect(page.getByTestId('mot-de-passe-temporaire')).toHaveCount(0);
});

test('US-007 CA-4 : modification du nom et du rôle dans la liste', async ({ page }) => {
  await ouvrirComptes(page);
  let envoye: unknown;
  await simuler(
    page,
    '/comptes/c2',
    200,
    { ok: true, compte: { ...ORGA, nom: 'Bruno Petit-Jean', role: 'administrateur' } },
    'PATCH',
    (corps) => (envoye = corps),
  );
  await page.getByRole('button', { name: 'Modifier Bruno Petit' }).click();
  await page.getByRole('row').getByLabel('Nom').fill('Bruno Petit-Jean');
  await page.getByRole('row').getByLabel('Rôle').selectOption('administrateur');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(ligne(page, 'Bruno Petit-Jean')).toContainText('Administrateur');
  expect(envoye).toEqual({ nom: 'Bruno Petit-Jean', role: 'administrateur' });
});

test('US-007 CA-5 : le dernier administrateur ne peut pas devenir organisateur', async ({ page }) => {
  await ouvrirComptes(page);
  await simuler(page, '/comptes/c1', 409, { ok: false, erreur: 'DERNIER_ADMINISTRATEUR' }, 'PATCH');
  await page.getByRole('button', { name: 'Modifier Alice Martin' }).click();
  await page.getByRole('row').getByLabel('Rôle').selectOption('organisateur');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('alert')).toHaveText('Il doit rester au moins un administrateur actif');
});

test('US-007 CA-6 : pas d’entrée « Comptes » pour un organisateur, et /comptes le renvoie à son accueil', async ({
  page,
}) => {
  await connecterSimule(page, 'organisateur');
  await expect(page.getByRole('link', { name: 'Comptes' })).toHaveCount(0);
  await page.goto('/comptes');
  await expect(page).toHaveURL(/\/organisateur$/);
});

test('US-007 hors ligne : l’entrée « Comptes » est grisée avec « Nécessite une connexion internet »', async ({
  page,
  context,
}) => {
  // Écran large : « Comptes » est dans l'entête (sur un écran étroit, il est dans le menu de compte).
  await page.setViewportSize({ width: 1280, height: 800 });
  await connecterSimule(page, 'administrateur');
  await expect(page.getByRole('link', { name: 'Comptes' })).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByRole('link', { name: 'Comptes' })).toHaveCount(0);
  const entree = page.locator('[aria-disabled="true"]').filter({ hasText: 'Comptes' });
  // Dans l'entête, le motif est l'infobulle et la description accessible (pas de texte en double sur la page).
  await expect(entree).toHaveAttribute('title', 'Nécessite une connexion internet');
  await context.setOffline(false);
  await expect(page.getByRole('link', { name: 'Comptes' })).toBeVisible();
});
