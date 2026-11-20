// Étape « Impressions » (US-120, planche 22) : les documents de l'épreuve par groupe, leur disponibilité, les QR codes ;
// la page s'ouvre sans réseau.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { importerEpreuve, poulesJouees } from './tableau-outils';

/** Une épreuve aux poules jouées, tableau pas encore créé ; ce PC en est le pilote. */
async function epreuveAuxPoulesJouees(page: Page) {
  await seConnecter(page);
  return importerEpreuve(page, poulesJouees({ nombre: 6 }));
}

async function ouvrirImpressions(page: Page) {
  await page
    .getByRole('navigation', { name: 'Étapes de l’épreuve' })
    .getByRole('link', { name: /^Impressions/ })
    .click();
  await expect(page.getByRole('heading', { level: 2, name: 'Impressions' })).toBeVisible({ timeout: 20_000 });
}

const ligne = (page: Page, nom: string) => page.getByRole('listitem').filter({ hasText: nom });

test('US-120 CA-1, CA-2 et CA-4 : les documents par groupe, les indisponibles grisés, les QR codes', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await epreuveAuxPoulesJouees(page);
  await ouvrirImpressions(page);

  // CA-1 : trois groupes, une ligne par document, l'explication en tête.
  await expect(page.getByText(/Tout s’imprime depuis ce PC, avec ou sans internet/)).toBeVisible();
  for (const groupe of ['Avant les poules', 'Poules', 'Tableau']) {
    await expect(page.getByRole('region', { name: groupe, exact: true })).toBeVisible();
  }
  await expect(page.getByRole('button', { name: /^Imprimer : / })).toHaveCount(9);

  // CA-2 : un document pas encore livré est grisé « À venir » (la raison d'un document livré mais sans données,
  // « Après la création du tableau », est vérifiée par le domaine et par les E2E des documents, US-121 à US-128).
  await expect(ligne(page, 'Feuilles de match')).toContainText('À venir');
  await expect(page.getByRole('button', { name: 'Imprimer : Feuilles de match' })).toBeDisabled();

  // CA-4 : les QR codes ouvrent la page d'impression d'US-096.
  await page.evaluate(() => (window.print = () => undefined));
  await page.getByRole('button', { name: 'Imprimer : QR codes des arbitres et des tireurs' }).click();
  await expect(page).toHaveURL(/\/acces\/imprimer$/);
});

test('US-120 hors ligne : l’étape « Impressions » s’ouvre sans réseau', async ({ page, context }) => {
  test.setTimeout(120_000);
  await epreuveAuxPoulesJouees(page);
  await context.setOffline(true);
  await ouvrirImpressions(page);
  await expect(page.getByRole('region', { name: 'Poules', exact: true })).toBeVisible();
  await context.setOffline(false);
});
