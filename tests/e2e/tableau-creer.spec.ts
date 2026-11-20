// Créer le tableau (US-109, planche 11) : étape grisée avant le lancement, avis tant que les poules se tirent, aperçu du
// premier tour avec exempts et ex aequo, création qui fige les poules, prochaine étape, hors ligne.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { epreuveAvecPresentes } from './poules-outils';
import { importerEpreuve, nomDe, ouvrirTableau, poulesJouees, ID } from './tableau-outils';

const navigation = (page: Page) => page.getByRole('navigation', { name: 'Étapes de l’épreuve' });
const premierTour = (page: Page) => page.getByRole('region', { name: /^Premier tour/ });

test('US-109 CA-1 : l’étape « Tableau » est grisée avant le lancement des poules, et son adresse renvoie aux poules', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 6);
  await page.goto(adresse);
  await expect(navigation(page).getByRole('link', { name: /^Tableau/ })).toHaveCount(0);
  await expect(navigation(page).getByText('Tableau', { exact: true })).toBeVisible();
  await page.goto(`${adresse}/tableau`);
  await expect(page).toHaveURL(/\/poules$/, { timeout: 20_000 });
});

test('US-109 CA-2 : tant que les poules se tirent, l’étape l’annonce sans action', async ({ page }) => {
  test.setTimeout(120_000);
  await seConnecter(page);
  await importerEpreuve(page, poulesJouees({ aTirer: 18 }));
  await ouvrirTableau(page);
  await expect(
    page.getByText('Le tableau se crée quand toutes les poules sont terminées · 42 matchs sur 60'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Créer le tableau' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Voir les poules' }).click();
  await expect(page).toHaveURL(/\/poules$/);
});

test('US-109 CA-3, CA-5, CA-6 et CA-8 : aperçu du premier tour, création, poules figées (planche 11)', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1360, height: 1100 });
  await seConnecter(page);
  const adresse = await importerEpreuve(page, poulesJouees());

  // CA-6 : le Résumé propose de créer le tableau.
  const bandeau = page.getByRole('region', { name: 'Prochaine étape' });
  await expect(bandeau).toContainText('Les poules sont terminées : créer le tableau');
  await bandeau.getByRole('button', { name: 'Créer le tableau' }).click();
  await expect(page).toHaveURL(/\/tableau$/);

  // CA-3 : l'entête et le premier tour, rangs entre parenthèses, exemptes.
  await expect(page.getByRole('heading', { level: 2, name: 'Tableau' })).toBeVisible();
  await expect(page.getByText('Tableau de 32 · 24 qualifiés, 8 exempts · pas de match pour la 3e place')).toBeVisible();
  await expect(page.getByText('À créer', { exact: true })).toBeVisible();
  const lignes = premierTour(page).getByRole('listitem');
  await expect(lignes).toHaveCount(16);
  await expect(lignes.first()).toContainText('(1)');
  await expect(lignes.first()).toContainText('Exempt');
  await expect(lignes.nth(1)).toContainText('(16)');
  await expect(lignes.nth(1)).toContainText('contre');
  await expect(lignes.nth(1)).toContainText('(17)');
  await expect(page.getByRole('note')).toHaveCount(0);
  // CA-8 : la capture de l'entête, à comparer à la planche 11 pendant la recette.
  await page.screenshot({ path: 'test-results/tableau-creer.png', fullPage: true });

  // CA-5 : la création, confirmée, fige les poules.
  await premierTour(page).getByRole('button', { name: 'Créer le tableau' }).click();
  const dialogue = page.getByRole('dialog');
  await expect(dialogue).toContainText('ne pourront plus être modifiés');
  await dialogue.getByRole('button', { name: 'Créer le tableau' }).click();
  await expect(page.getByText('Tableau créé')).toBeVisible();
  await expect(page.getByText('En cours', { exact: true }).last()).toBeVisible();
  await expect(premierTour(page).getByRole('button', { name: 'Créer le tableau' })).toHaveCount(0);

  await page.goto(`${adresse}/poules`);
  await expect(page.getByText('Le tableau est créé : les poules sont en lecture seule')).toBeVisible({
    timeout: 20_000,
  });
  // Le bandeau ne propose plus de créer le tableau.
  await page.goto(adresse);
  await expect(page.getByText('Les poules sont terminées : créer le tableau')).toHaveCount(0);
});

test('US-109 CA-4 : les ex aequo sont signalés, puis départagés au sort à la création', async ({ page }) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  await importerEpreuve(page, poulesJouees({ nombre: 12, classement: 'exaequo' }));
  await ouvrirTableau(page);
  // Deux poules identiques : les deux premières sont 1res ex aequo, etc.
  const alertes = page.getByRole('note');
  await expect(alertes).toHaveCount(6);
  await expect(alertes.first()).toContainText('1er ex aequo');
  await expect(alertes.first()).toContainText(nomDe(ID(0)).split(' ')[0]!);
  await expect(alertes.first()).toContainText('départagés par tirage au sort');
  await page.getByRole('button', { name: 'Créer le tableau' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Créer le tableau' }).click();
  await expect(page.getByText('Tableau créé')).toBeVisible();
  await expect(page.getByRole('note')).toHaveCount(0);
});

test('US-109 hors ligne : le tableau se crée sans réseau et fige les poules', async ({ page, context }) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  await importerEpreuve(page, poulesJouees({ nombre: 6 }));
  await ouvrirTableau(page);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Créer le tableau' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Créer le tableau' }).click();
  await expect(page.getByText('Tableau créé')).toBeVisible();
  // Les poules sont figées, et le tableau se retrouve en revenant sur l'étape.
  await navigation(page)
    .getByRole('link', { name: /^Poules/ })
    .click();
  await expect(page.getByText('Le tableau est créé : les poules sont en lecture seule')).toBeVisible();
  await ouvrirTableau(page);
  await expect(
    page.getByText('Quarts de finale · 6 qualifiés, 2 exempts · pas de match pour la 3e place'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Créer le tableau' })).toHaveCount(0);
  await context.setOffline(false);
});
