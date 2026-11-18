// L'attente d'envoi ne décale plus l'écran (US-090) : rien ne bouge quand un score part au serveur ; hors ligne, la
// pastille flottante apparaît après 3 secondes.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { epreuveAvecPresentes, repartir } from './poules-outils';

async function lancer(page: Page, adresse: string) {
  await repartir(page, adresse);
  await page.getByRole('button', { name: 'Lancer les poules' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lancer les poules' }).click();
  await expect(page.getByRole('heading', { level: 3, name: /^Feuille de la poule 1/ })).toBeVisible();
}

/** Saisit le match en cours (champs de US-088, ou boutons de US-091). */
async function saisir(page: Page) {
  const carte = page.getByRole('region', { name: /^Match \d+ sur \d+$/ });
  const titre = (await carte.getByRole('heading').textContent()) ?? '';
  const champs = carte.getByRole('textbox');
  if ((await champs.count()) > 0) {
    await champs.nth(0).fill('5');
    await champs.nth(1).fill('2');
    await champs.nth(1).press('Enter');
  } else {
    await carte
      .getByRole('button', { name: /^V pour / })
      .first()
      .click();
    await carte
      .getByRole('button', { name: /^2 pour / })
      .last()
      .click();
  }
  await expect(page.getByRole('region', { name: titre, exact: true })).toHaveCount(0);
}

const feuille = (page: Page) => page.getByRole('tabpanel', { name: /^Feuille de la poule/ });
const pastille = (page: Page) => page.getByText(/en attente d’envoi/);

test('US-090 CA-1 et CA-2 : en ligne, l’écran ne bouge pas quand un score part au serveur', async ({ page }) => {
  test.setTimeout(120_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 6);
  await lancer(page, adresse);
  const avant = await feuille(page).boundingBox();
  for (let i = 0; i < 3; i += 1) {
    await saisir(page);
    expect(await feuille(page).boundingBox()).toEqual(avant);
  }
  // CA-2 : une attente courte (en ligne) n'est pas signalée.
  await expect(pastille(page)).toHaveCount(0);
});

test('US-090 hors ligne : la pastille apparaît après 3 secondes, sans décaler la feuille', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 6);
  await lancer(page, adresse);
  const avant = await feuille(page).boundingBox();
  await context.setOffline(true);
  await saisir(page);
  await expect(pastille(page)).toBeVisible({ timeout: 8_000 });
  expect(await feuille(page).boundingBox()).toEqual(avant);
  await context.setOffline(false);
  await expect(pastille(page)).toHaveCount(0, { timeout: 30_000 });
});
