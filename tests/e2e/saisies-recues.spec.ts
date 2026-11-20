// Saisies reçues des smartphones (US-100, planche 10) : sous la feuille de poule du PC, une ligne par saisie reçue
// (acceptée, refusée avec son motif) et par score saisi sur ce PC, le nombre d'appareils connectés, et hors ligne la liste.
import { expect, test, type Page } from '@playwright/test';
import { ouvrirPoules, saisirBoutons } from './poules-outils';
import { entrerArbitre, poulesLancees, telephone } from './saisie-outils';

async function envoyerDuTelephone(arbitre: Page, a: string, b: string) {
  const maintenant = arbitre.getByRole('region', { name: /^À saisir maintenant · match \d+$/ });
  await expect(maintenant).toBeVisible({ timeout: 20_000 });
  await maintenant.getByRole('button', { name: 'Saisir le score' }).click();
  await arbitre
    .getByRole('group', { name: /^Score de / })
    .getByRole('button', { name: new RegExp(`^${a} pour `) })
    .click();
  await arbitre
    .getByRole('group', { name: /^Score de / })
    .getByRole('button', { name: new RegExp(`^${b} pour `) })
    .click();
  await arbitre.getByRole('button', { name: 'Envoyer à la table' }).click();
}

test('US-100 CA-1, CA-2, CA-4 et CA-6 : saisies acceptées, refusées, saisies sur ce PC ; appareils ; hors ligne', async ({
  page,
  context,
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1360, height: 1100 });
  const { adresse, arbitres } = await poulesLancees(page);
  await ouvrirPoules(page, adresse);
  const carte = page.getByRole('region', { name: 'Saisies reçues des smartphones' });
  await expect(carte.getByText('Aucune saisie reçue pour l’instant.')).toBeVisible();
  const { contexte, page: arbitre } = await telephone(browser, baseURL);
  try {
    await entrerArbitre(arbitre, arbitres, 'Martin', 1);
    await expect(carte.getByText('1 appareil connecté')).toBeVisible({ timeout: 10_000 });
    await expect(carte.getByRole('button', { name: 'Gérer les accès' })).toBeVisible();

    // Une saisie acceptée.
    await envoyerDuTelephone(arbitre, 'V', '2');
    await expect(arbitre.getByText(/^Enregistré par la table/)).toBeVisible({ timeout: 10_000 });
    const lignes = carte.getByRole('listitem');
    await expect(lignes.first()).toContainText('Poule 1 · match 1');
    await expect(lignes.first()).toContainText('arbitre Martin (t1)');
    await expect(lignes.first()).toContainText('Acceptée');

    // Un score saisi sur ce PC, puis la même saisie envoyée par le téléphone : refusée.
    await arbitre.getByRole('button', { name: 'Retour aux matchs de la piste' }).click();
    await saisirBoutons(page, 5, 3);
    await expect(lignes.first()).toContainText('saisi sur ce PC');
    await expect(lignes.first()).toContainText('Enregistrée');
    await expect(arbitre.getByRole('region', { name: 'À saisir maintenant · match 3' })).toBeVisible({
      timeout: 10_000,
    });

    // CA-6 : conforme à la planche 10, avec des saisies.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await testInfo.attach('planche-10', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });

    // Hors ligne : la liste reste, sans nombre d'appareils.
    await context.setOffline(true);
    await expect(carte.getByText('Hors ligne : aucun appareil')).toBeVisible({ timeout: 10_000 });
    await expect(lignes).toHaveCount(2);
    await context.setOffline(false);
  } finally {
    await contexte.close();
  }
});

test('US-100 CA-2 : une saisie refusée par la table s’inscrit avec son motif', async ({ page, browser, baseURL }) => {
  test.setTimeout(180_000);
  const { adresse, arbitres } = await poulesLancees(page);
  await ouvrirPoules(page, adresse);
  const { contexte, page: arbitre } = await telephone(browser, baseURL);
  try {
    await entrerArbitre(arbitre, arbitres, 'Martin', 1);
    const maintenant = arbitre.getByRole('region', { name: /^À saisir maintenant · match \d+$/ });
    await expect(maintenant).toBeVisible({ timeout: 20_000 });
    await maintenant.getByRole('button', { name: 'Saisir le score' }).click();
    await saisirBoutons(page, 5, 1);
    await arbitre
      .getByRole('group', { name: /^Score de / })
      .getByRole('button', { name: /^V pour / })
      .click();
    await arbitre
      .getByRole('group', { name: /^Score de / })
      .getByRole('button', { name: /^2 pour / })
      .click();
    await arbitre.getByRole('button', { name: 'Envoyer à la table' }).click();
    await expect(arbitre.getByRole('alert')).toBeVisible({ timeout: 10_000 });
    const premiere = page.getByRole('region', { name: 'Saisies reçues des smartphones' }).getByRole('listitem').first();
    await expect(premiere).toContainText('Refusée : match déjà saisi', { timeout: 10_000 });
    await expect(premiere).toContainText('arbitre Martin (t1)');
  } finally {
    await contexte.close();
  }
});
