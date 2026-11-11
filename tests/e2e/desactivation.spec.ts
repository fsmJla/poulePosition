// US-008 : désactiver, réactiver ou supprimer un compte. Réponses de /comptes simulées (même raison qu'US-007 : ne pas
// modifier les comptes réels de la preview) ; la chaîne réelle est couverte par serveur/src/comptes.test.ts.
import { expect, test, type Page } from '@playwright/test';
import { ouvrirPageComptes } from './compte';
import { connecterSimule, sessionSimulee, simuler } from './simulation';

const ORGA = {
  id: 'c2',
  email: 'orga@club.fr',
  nom: 'Bruno Petit',
  role: 'organisateur',
  actif: true,
  temporaire: false,
  derniereConnexion: Date.UTC(2026, 9, 21, 9, 0),
};
/** Compte de la session simulée : l'administrateur connecté lui-même. */
const MOI = { ...ORGA, id: 'c1', email: sessionSimulee().compte.email, nom: 'Compte simulé', role: 'administrateur' };

async function ouvrirComptes(page: Page, comptes: unknown[] = [ORGA]) {
  await simuler(page, '/comptes', 200, { ok: true, comptes }, 'GET');
  await connecterSimule(page, 'administrateur');
  await ouvrirPageComptes(page);
  await expect(page).toHaveURL(/\/comptes$/);
}

const ligne = (page: Page, nom: string) => page.getByRole('row').filter({ hasText: nom });

test('US-008 CA-1 : désactivation confirmée, le compte apparaît désactivé', async ({ page }) => {
  await ouvrirComptes(page);
  let envoye: unknown = null;
  await simuler(page, '/comptes/c2', 200, { ok: true, compte: { ...ORGA, actif: false } }, 'PATCH', (corps) => {
    envoye = corps;
  });

  await page.getByRole('button', { name: 'Désactiver Bruno Petit' }).click();
  expect(envoye).toBeNull();
  await page.getByRole('button', { name: 'Confirmer la désactivation' }).click();
  await expect(ligne(page, 'Bruno Petit')).toContainText('Désactivé');
  expect(envoye).toEqual({ actif: false });
  await expect(page.getByRole('button', { name: 'Réactiver Bruno Petit' })).toBeVisible();
});

test('US-008 CA-2 : réactivation d’un compte désactivé', async ({ page }) => {
  await ouvrirComptes(page, [{ ...ORGA, actif: false }]);
  let envoye: unknown = null;
  await simuler(page, '/comptes/c2', 200, { ok: true, compte: ORGA }, 'PATCH', (corps) => (envoye = corps));
  await page.getByRole('button', { name: 'Réactiver Bruno Petit' }).click();
  await expect(ligne(page, 'Bruno Petit')).toContainText('Actif');
  expect(envoye).toEqual({ actif: true });
});

test('US-008 CA-3 : suppression possible seulement une fois l’e-mail recopié', async ({ page }) => {
  await ouvrirComptes(page);
  let supprime = false;
  await simuler(page, '/comptes/c2', 200, { ok: true }, 'DELETE', () => (supprime = true));

  await page.getByRole('button', { name: 'Supprimer Bruno Petit' }).click();
  await expect(
    page.getByText('Pour supprimer définitivement ce compte, saisissez son e-mail : orga@club.fr'),
  ).toBeVisible();
  const champ = page.getByRole('textbox', { name: 'E-mail du compte à supprimer' });
  const bouton = page.getByRole('button', { name: 'Supprimer définitivement' });
  await expect(bouton).toBeDisabled();
  await champ.fill('orga@club.com');
  await expect(bouton).toBeDisabled();
  await champ.fill(' Orga@Club.fr ');
  await expect(bouton).toBeEnabled();
  await bouton.click();
  await expect(ligne(page, 'Bruno Petit')).toHaveCount(0);
  expect(supprime).toBe(true);
});

test('US-008 CA-3 : « Annuler » renonce à la suppression', async ({ page }) => {
  await ouvrirComptes(page);
  await page.getByRole('button', { name: 'Supprimer Bruno Petit' }).click();
  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByRole('button', { name: 'Supprimer définitivement' })).toHaveCount(0);
  await expect(ligne(page, 'Bruno Petit')).toHaveCount(1);
});

test('US-008 CA-4 : le refus du dernier administrateur est affiché', async ({ page }) => {
  await ouvrirComptes(page, [MOI]);
  await simuler(page, '/comptes/c1', 409, { ok: false, erreur: 'DERNIER_ADMINISTRATEUR' }, 'PATCH');
  await page.getByRole('button', { name: 'Désactiver Compte simulé' }).click();
  await page.getByRole('button', { name: 'Confirmer la désactivation' }).click();
  await expect(page.getByRole('alert')).toHaveText('Il doit rester au moins un administrateur actif');
  await expect(ligne(page, 'Compte simulé')).toContainText('Actif');
});

test('US-008 : un administrateur qui se désactive est déconnecté aussitôt', async ({ page }) => {
  await ouvrirComptes(page, [MOI, ORGA]);
  await simuler(page, '/comptes/c1', 200, { ok: true, compte: { ...MOI, actif: false } }, 'PATCH');
  await page.getByRole('button', { name: 'Désactiver Compte simulé' }).click();
  await page.getByRole('button', { name: 'Confirmer la désactivation' }).click();
  await expect(page).toHaveURL(/\/connexion$/);
});

test('US-036 CA-1 : US-008 hors ligne : désactivation et suppression sont grisées', async ({ page, context }) => {
  await ouvrirComptes(page);
  const boutons = [
    page.getByRole('button', { name: 'Désactiver Bruno Petit' }),
    page.getByRole('button', { name: 'Supprimer Bruno Petit' }),
  ];
  // La liste est chargée au montage de la page : couper le réseau avant son arrivée la ferait échouer (US-036).
  for (const bouton of boutons) await expect(bouton).toBeVisible();
  await context.setOffline(true);
  for (const bouton of boutons) {
    await expect(bouton).toBeDisabled();
    await expect(bouton).toHaveAttribute('title', 'Nécessite une connexion internet');
  }
  await context.setOffline(false);
  for (const bouton of boutons) await expect(bouton).toBeEnabled();
});
