// US-130 : au retour du réseau, la pastille « Hors ligne » laisse place au résumé de la resynchronisation, qui s'efface
// seul. Les saisies des smartphones récupérées dans la boîte du serveur sont comptées par les tests unitaires
// (`retour-en-ligne.test.ts`) ; leur parcours complet est celui d'US-102 (`saisie-suspendue.spec.ts`).
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';

const MOTIF_PAGE_EPREUVE = /\/epreuves\/[0-9a-f-]{36}$/;
const HORS_LIGNE = 'Hors ligne : la compétition continue sur ce PC';

/** Une épreuve du jour pilotée ici, déjà envoyée au serveur : sa WebSocket est ouverte. */
async function epreuveDuJour(page: Page) {
  await page.goto('/epreuves/nouvelle?seule');
  await page.getByLabel('Nom de la compétition et de son épreuve').fill(`E2E ${crypto.randomUUID().slice(0, 8)}`);
  await page.getByLabel('Arme').selectOption('sabre');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(MOTIF_PAGE_EPREUVE);
  // La pastille d'attente n'apparaît qu'après 3 s (US-090) : on attend d'abord l'envoi de la création au serveur.
  await expect(page.getByText(/Pas encore envoyée/)).toHaveCount(0, { timeout: 20_000 });
  await page.waitForTimeout(3_500);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
}

async function renommer(page: Page) {
  await page.getByRole('link', { name: 'Modifier', exact: true }).click();
  await page.getByLabel('Nom', { exact: true }).fill(`E2E ${crypto.randomUUID().slice(0, 8)}`);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page).toHaveURL(MOTIF_PAGE_EPREUVE);
}

test('US-130 CA-1 et CA-5 : de retour en ligne, le résumé compte les modifications envoyées puis s’efface', async ({
  page,
  context,
}) => {
  await seConnecter(page);
  await epreuveDuJour(page);

  await context.setOffline(true);
  await expect(page.getByText(HORS_LIGNE)).toBeVisible({ timeout: 10_000 });
  await renommer(page);
  await renommer(page);
  await expect(page.getByText('2 modifications en attente d’envoi')).toBeVisible({ timeout: 10_000 });

  await context.setOffline(false);
  const resume = page.getByRole('status').filter({ hasText: /^De retour en ligne : 2 modifications envoyées$/ });
  await expect(resume).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(HORS_LIGNE)).toBeHidden();
  // CA-5 : annoncé sans prendre le focus.
  await expect(resume).toHaveAttribute('aria-live', 'polite');
  // CA-1 : il disparaît seul, au bout de 8 s.
  await expect(resume).toBeHidden({ timeout: 15_000 });
});

test('US-130 CA-3 : une coupure sans modification se résume à « De retour en ligne »', async ({ page, context }) => {
  await seConnecter(page);
  await epreuveDuJour(page);
  await context.setOffline(true);
  await expect(page.getByText(HORS_LIGNE)).toBeVisible({ timeout: 10_000 });
  await context.setOffline(false);
  await expect(page.getByRole('status').filter({ hasText: /^De retour en ligne$/ })).toBeVisible({ timeout: 30_000 });
});
