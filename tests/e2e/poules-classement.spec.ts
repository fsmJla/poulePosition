// Classement des poules (US-092, planche 20) : étape grisée avant le lancement, tableau de tous les tireurs, ordre,
// ex aequo, retirés en fin, mise à jour en temps réel, provisoire puis définitif, hors ligne.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { epreuveAvecPresentes, ouvrirPoules, repartir, saisirBoutons } from './poules-outils';

const etapeClassement = (page: Page) =>
  page.getByRole('navigation', { name: 'Étapes de l’épreuve' }).getByText('Classement', { exact: true });
const lignes = (page: Page) => page.getByRole('region', { name: /tireurs · \d+ poule/ }).locator('tbody tr');

async function lancer(page: Page, adresse: string) {
  await repartir(page, adresse);
  // CA-1 : avant le lancement, l'étape est grisée « À venir ».
  await expect(
    page.getByRole('navigation', { name: 'Étapes de l’épreuve' }).getByRole('link', { name: /^Classement/ }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Lancer les poules' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lancer les poules' }).click();
  await expect(page.getByRole('heading', { level: 3, name: /^Feuille de la poule 1/ })).toBeVisible();
}

async function ouvrirClassement(page: Page) {
  await page
    .getByRole('navigation', { name: 'Étapes de l’épreuve' })
    .getByRole('link', { name: /^Classement/ })
    .click();
  await expect(page.getByRole('heading', { level: 2, name: 'Classement des poules' })).toBeVisible();
}

test('US-092 CA-1 à CA-3 et CA-6 : l’étape, tous les tireurs, l’ordre (planche 20)', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1360, height: 1500 });
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page);
  await lancer(page, adresse);
  // Poule 1 : MARTIN, PETIT, LEROY, DAVID, BERTRAND, MERCIER (planche 9) ; deux matchs.
  await saisirBoutons(page, 5, 2); // MARTIN 5 – 2 PETIT
  await saisirBoutons(page, 5, 4); // DAVID 5 – 4 BERTRAND

  // CA-1 : l'étape s'ouvre et porte « provisoire ».
  await expect(
    page.getByRole('navigation', { name: 'Étapes de l’épreuve' }).getByRole('link', { name: /^Classement/ }),
  ).toContainText('provisoire');
  await ouvrirClassement(page);
  await expect(page).toHaveURL(/\/classement$/);
  await expect(page.getByText('Provisoire · 2 matchs sur 60')).toBeVisible();

  // CA-2 et CA-3 : 24 lignes ; MARTIN (+3) puis DAVID (+1), puis les tireurs sans match, ex aequo.
  await expect(lignes(page)).toHaveCount(24);
  await expect(lignes(page).nth(0)).toContainText('MARTIN Léa');
  await expect(lignes(page).nth(0)).toContainText('1,00');
  await expect(lignes(page).nth(1)).toContainText('DAVID Agathe');
  await expect(lignes(page).nth(2)).toContainText('3=');
  await expect(lignes(page).nth(0)).toContainText('4 matchs à tirer');
  await page.screenshot({ path: 'test-results/poules-classement.png', fullPage: true });
});

test('US-092 CA-3 à CA-5 : en temps réel, retirés en fin, définitif', async ({ page }) => {
  test.setTimeout(180_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 6);
  await lancer(page, adresse);
  await ouvrirClassement(page);
  await expect(page.getByText('Provisoire · 0 match sur 15')).toBeVisible();

  // CA-4 : un second onglet saisit un score ; le classement se met à jour sans recharger.
  const saisie = await page.context().newPage();
  await ouvrirPoules(saisie, adresse);
  await saisirBoutons(saisie, 2, 5); // MARTIN 2 – 5 DUBOIS
  await expect(lignes(page).nth(0)).toContainText('DUBOIS Chloé', { timeout: 10_000 });

  // CA-3 : un tireur retiré passe en fin, sans rang.
  await saisie.getByRole('button', { name: 'Autres actions pour DUBOIS Chloé' }).click();
  await saisie.getByRole('menuitem', { name: /^Abandon…/ }).click();
  await saisie.getByRole('dialog').getByRole('button', { name: 'Retirer', exact: true }).click();
  await expect(lignes(page).last()).toContainText('DUBOIS Chloé', { timeout: 10_000 });
  await expect(lignes(page).last()).toContainText('Abandon');
  await expect(lignes(page).last().locator('td').first()).toHaveText('—');

  // CA-5 : tous les matchs réglés, le classement est définitif.
  // 15 matchs : 1 tiré, 4 réglés par le retrait de DUBOIS, 10 à saisir.
  for (let i = 0; i < 10; i += 1) await saisirBoutons(saisie, 5, i % 5);
  await saisie.close();
  await expect(page.getByText('Définitif', { exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(etapeClassement(page)).toBeVisible();
});

test('US-092 hors ligne : le classement suit un score saisi sans réseau', async ({ page, context }) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 6);
  await lancer(page, adresse);
  await context.setOffline(true);
  await saisirBoutons(page, 5, 1);
  await ouvrirClassement(page);
  await expect(lignes(page).nth(0)).toContainText('MARTIN Léa');
  await expect(page.getByText('Provisoire · 1 match sur 15')).toBeVisible();
  await context.setOffline(false);
});

test('US-092 cas limite : avant le lancement, l’adresse du classement renvoie aux poules', async ({ page }) => {
  test.setTimeout(120_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 6);
  await page.goto(`${adresse}/classement`);
  await expect(page).toHaveURL(/\/poules$/, { timeout: 20_000 });
});
