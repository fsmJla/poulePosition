// WebSocket du pilote (US-094, ADR-0028) : le PC pilote garde une connexion au serveur pour chaque épreuve du jour.
// Quand le réseau tombe, il l'annonce et continue tout en local ; au retour, la connexion se rétablit d'elle-même.
import { expect, test } from '@playwright/test';
import { seConnecter } from './compte';

const MOTIF_PAGE_EPREUVE = /\/epreuves\/[0-9a-f-]{36}$/;
const HORS_LIGNE = 'Hors ligne : la compétition continue sur ce PC';

test('US-094 CA-3 : réseau coupé puis rétabli, le pilote continue seul puis se reconnecte', async ({
  page,
  context,
}) => {
  await seConnecter(page);
  // Une épreuve sans date, en préparation : elle se tire aujourd'hui, ce PC ouvre sa WebSocket.
  await page.goto('/epreuves/nouvelle?seule');
  await page.getByLabel('Nom de la compétition et de son épreuve').fill(`E2E ${crypto.randomUUID().slice(0, 8)}`);
  await page.getByLabel('Arme').selectOption('sabre');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(MOTIF_PAGE_EPREUVE);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByText(HORS_LIGNE)).toBeHidden();

  await context.setOffline(true);
  await expect(page.getByText(HORS_LIGNE)).toBeVisible({ timeout: 10_000 });
  // La compétition continue sur ce PC : une modification s'enregistre et attend le réseau.
  await page.getByRole('link', { name: 'Modifier', exact: true }).click();
  await page.getByLabel('Nom', { exact: true }).fill(`E2E ${crypto.randomUUID().slice(0, 8)}`);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('1 modification en attente d’envoi')).toBeVisible();
  await expect(page.getByText(HORS_LIGNE)).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText(HORS_LIGNE)).toBeHidden({ timeout: 20_000 });
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
});
