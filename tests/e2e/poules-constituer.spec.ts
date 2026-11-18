// Constituer les poules (US-086, planche 8) : nombre de poules proposé, serpentin, séparation des clubs, poules vides,
// pistes, répartir à nouveau, hors ligne.
import { expect, test } from '@playwright/test';
import { seConnecter } from './compte';
import { cartePoule, epreuveAvecPresentes, ouvrirPoules } from './poules-outils';

test('US-086 CA-1 à CA-4, CA-6 et CA-8 : 24 présentes, 4 poules de 6 en serpentin, clubs séparés (planche 8)', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1360, height: 1100 });
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page);

  // CA-1 : « Constituer les poules » de l'émargement mène à l'étape « Poules », livrée.
  await page.getByRole('button', { name: 'Constituer les poules' }).click();
  await expect(page).toHaveURL(/\/poules$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Constituer les poules' })).toBeVisible();
  await expect(page.getByText('24 tireurs présents')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Voir l’émargement' })).toHaveAttribute(
    'href',
    `${new URL(adresse).pathname}/emargement`,
  );

  // CA-2 : seule « 4 poules de 6 » tient dans 5 à 7, recommandée ; un autre nombre reste possible, signalé.
  await expect(page.getByRole('radio', { name: /^4 poules de 6/ })).toBeChecked();
  await expect(page.getByText('Recommandé · 15 matchs par poule')).toBeVisible();
  await expect(page.getByRole('radio', { name: /^3 poules de 8/ })).toHaveCount(0);
  await page.getByLabel('Nombre de poules choisi').fill('5');
  await expect(page.getByText('4 de 5 et 1 de 4 · Hors de 5 à 7 tireurs par poule')).toBeVisible();
  await page.getByRole('radio', { name: /^4 poules de 6/ }).check();

  // CA-8 : la planche 8, à 1360 px.
  await expect(page.getByRole('radio', { name: /^Automatique/ })).toBeChecked();
  await expect(page.getByLabel('Séparer les tireurs d’un même club autant que possible')).toBeChecked();
  await expect(page.getByRole('table', { name: 'Rang au classement placé dans chaque poule' })).toContainText('16');
  await page.screenshot({ path: 'test-results/poules-constituer.png' });

  // CA-3, CA-4 et CA-6 : serpentin, clubs séparés quand c'est possible, pistes 1 à 4.
  await page.getByRole('button', { name: 'Répartir les poules' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Poules' })).toBeVisible();
  await expect(page.getByText('4 poules de 6 · pistes 1 à 4 · répartition automatique')).toBeVisible();
  await expect(cartePoule(page, 1)).toContainText('MARTIN Léa');
  await expect(cartePoule(page, 1)).toContainText('Piste 1');
  await expect(cartePoule(page, 4)).toContainText('Piste 4');
  // Pessac (SPUC) a 5 tireuses pour 4 poules : une seule poule est signalée.
  await expect(page.getByText('2 tireurs de Pessac (SPUC) dans cette poule')).toHaveCount(1);
  await expect(
    page.getByRole('navigation', { name: 'Étapes de l’épreuve' }).getByRole('link', { name: /^Poules/ }),
  ).toHaveAttribute('aria-current', 'page');
  // La composition est dans le journal : elle se retrouve en rouvrant l'étape.
  await ouvrirPoules(page, adresse);
  await expect(page.getByText(/^4 poules de 6 · pistes 1 à 4/)).toBeVisible();
});

test('US-086 CA-5 et CA-7 : poules vides en manuel, première piste, puis répartir à nouveau', async ({ page }) => {
  test.setTimeout(120_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 12);
  await ouvrirPoules(page, adresse);
  await expect(page.getByRole('radio', { name: /^2 poules de 6/ })).toBeChecked();
  await page.getByRole('radio', { name: /^Manuelle/ }).check();
  await page.getByLabel('Première piste').fill('3');
  await page.getByRole('button', { name: 'Créer les poules vides' }).click();
  await expect(page.getByText(/pistes 3 à 4 · répartition manuelle/)).toBeVisible();
  await expect(cartePoule(page, 1)).toContainText('Aucun tireur');

  // CA-7 : rien n'est figé ; la composition actuelle sera remplacée.
  await page.getByRole('button', { name: 'Répartir à nouveau' }).click();
  await expect(page.getByText('La composition actuelle sera remplacée, avec vos ajustements.')).toBeVisible();
  await page.getByRole('button', { name: 'Répartir les poules' }).click();
  await expect(page.getByText('2 poules de 6 · pistes 1 à 2 · répartition automatique')).toBeVisible();
});

test('US-086 cas limites : moins de 3 présentes', async ({ page }) => {
  test.setTimeout(90_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 3, 2);
  await ouvrirPoules(page, adresse);
  await expect(page.getByText('Il faut au moins 3 présents pour constituer une poule.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Répartir les poules' })).toHaveCount(0);
});

test('US-086 hors ligne : les poules se constituent sans réseau', async ({ page, context }) => {
  test.setTimeout(120_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 6);
  await ouvrirPoules(page, adresse);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Répartir les poules' }).click();
  await expect(page.getByText('1 poule de 6 · piste 1 · répartition automatique')).toBeVisible();
  await context.setOffline(false);
  await ouvrirPoules(page, adresse);
  await expect(page.getByText('1 poule de 6 · piste 1 · répartition automatique')).toBeVisible();
});
