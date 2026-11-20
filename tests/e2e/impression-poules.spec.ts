// Documents imprimés des poules (US-122 à US-125, planches 24 à 27) : feuilles de poule à remplir (QR code des arbitres),
// avec résultats, poules par piste, classement des poules ; depuis l'étape « Impressions » et les menus « ⋯ », sans
// réseau aussi.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { importerEpreuve, poulesJouees } from './tableau-outils';

/** La fenêtre d'impression ne s'ouvre pas pendant les tests : on compte ses appels. */
async function compterImpressions(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { impressions: number }).impressions = 0;
    window.print = () => {
      (window as unknown as { impressions: number }).impressions += 1;
    };
  });
}
const impressions = (page: Page) => page.evaluate(() => (window as unknown as { impressions: number }).impressions);

async function ouvrirImpressions(page: Page) {
  await page
    .getByRole('navigation', { name: 'Étapes de l’épreuve' })
    .getByRole('link', { name: /^Impressions/ })
    .click();
  await expect(page.getByRole('heading', { level: 2, name: 'Impressions' })).toBeVisible({ timeout: 20_000 });
}

const ligne = (page: Page, nom: string) => page.getByRole('listitem').filter({ hasText: nom });
const feuilles = (page: Page) => page.getByRole('region', { name: /^Poule \d · Piste \d · Poule \d \/ 4$/ });

test('US-122 CA-1, CA-3 et CA-4 : une feuille à remplir par poule, ou la poule choisie', async ({ page }) => {
  test.setTimeout(120_000);
  await compterImpressions(page);
  await seConnecter(page);
  await importerEpreuve(page, poulesJouees({ aTirer: 6 }));
  await ouvrirImpressions(page);
  await page.getByRole('button', { name: 'Imprimer : Feuilles de poule à remplir' }).click();

  // CA-1 et CA-3 : les 4 poules, une par page, dans l'ordre ; l'impression s'ouvre.
  await expect(feuilles(page)).toHaveCount(4);
  await expect.poll(() => impressions(page)).toBe(1);
  const premiere = feuilles(page).first();
  await expect(premiere).toHaveAccessibleName('Poule 1 · Piste 1 · Poule 1 / 4');
  await expect(premiere).toContainText('6 tireurs · 15 matchs en 5 touches · début : ____ h ____');
  // Grille vide de 6 lignes, ordre des 15 matchs, cadres Arbitre et Fin de poule.
  await expect(premiere.getByRole('rowheader')).toHaveCount(6);
  await expect(premiere.getByRole('row').nth(1)).not.toContainText(/V\d|\d–\d/);
  await expect(premiere.getByRole('region', { name: 'Ordre des matchs' }).getByRole('listitem')).toHaveCount(15);
  await expect(premiere).toContainText('Arbitre');
  await expect(premiere).toContainText('Fin de poule');
  // CA-2 : sans jeton des arbitres gardé sur ce PC, pas de QR code.
  await expect(premiere.getByRole('img', { name: /^QR code des arbitres/ })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/impression-poules-vierges.png', fullPage: true });

  // La poule choisie seulement.
  await page.getByRole('button', { name: 'Retour aux impressions' }).click();
  await ligne(page, 'Feuilles de poule à remplir').getByRole('button', { name: '2', exact: true }).click();
  await page.getByRole('button', { name: 'Imprimer : Feuilles de poule à remplir' }).click();
  await expect(feuilles(page)).toHaveCount(1);
  await expect(feuilles(page)).toHaveAccessibleName('Poule 2 · Piste 2 · Poule 2 / 4');
});

test('US-122 CA-2 : le QR code des arbitres, une fois la main prise et le lien créé', async ({ page }) => {
  test.setTimeout(150_000);
  await compterImpressions(page);
  await seConnecter(page);
  const adresse = await importerEpreuve(page, poulesJouees());
  await page.locator('[data-reprise]').getByRole('button', { name: 'Prendre la main et envoyer' }).click();
  await expect(page.locator('[data-retour="reprise"]')).toContainText('Main prise', { timeout: 20_000 });
  await page.goto(`${adresse}/parametres`);
  const acces = page.getByRole('region', { name: 'Accès par QR code' });
  await expect(acces.getByLabel('Lien des arbitres')).toHaveText(/#j=/, { timeout: 20_000 });
  await page.goto(adresse);
  await ouvrirImpressions(page);
  await page.getByRole('button', { name: 'Imprimer : Feuilles de poule à remplir' }).click();
  await expect(feuilles(page).first().getByRole('img', { name: 'QR code des arbitres, poule 1' })).toBeVisible();
  await expect(feuilles(page).first()).toContainText('Arbitre : scannez pour saisir les scores sur votre téléphone.');
});

test('US-122 : « ⋯ › Imprimer les feuilles de poule » des Poules ; sans réseau', async ({ page, context }) => {
  test.setTimeout(120_000);
  await compterImpressions(page);
  await seConnecter(page);
  await importerEpreuve(page, poulesJouees({ aTirer: 6 }));
  await page
    .getByRole('navigation', { name: 'Étapes de l’épreuve' })
    .getByRole('link', { name: /^Poules/ })
    .click();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Autres actions pour Poules' }).click();
  await page.getByRole('menuitem', { name: /Imprimer les feuilles de poule/ }).click();
  await expect(feuilles(page)).toHaveCount(4);
  await expect.poll(() => impressions(page)).toBe(1);
  await context.setOffline(false);
});

test('US-123 CA-1 à CA-3 : les feuilles de poule avec résultats, provisoires ou terminées, et un retrait', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await compterImpressions(page);
  await seConnecter(page);
  // 6 matchs de la poule 4 restent à tirer ; t4 (poule 4) abandonne.
  await importerEpreuve(page, [
    ...poulesJouees({ aTirer: 6 }),
    { type: 'TireurRetireDesPoules', donnees: { tireurId: 't4', motif: 'abandon' } },
  ]);
  await ouvrirImpressions(page);
  await page.getByRole('button', { name: 'Imprimer : Feuilles de poule avec résultats' }).click();
  await expect(feuilles(page)).toHaveCount(4);
  await expect.poll(() => impressions(page)).toBe(1);

  // CA-1 : la grille remplie (V5), V, V/M, TD, TR, Ind, Rg, l'ordre des matchs avec les scores, la légende.
  const premiere = feuilles(page).first();
  await expect(premiere.getByRole('cell', { name: 'V5' }).first()).toBeVisible();
  await expect(premiere.getByRole('region', { name: 'Ordre des matchs' })).toContainText(/\d–\d/);
  await expect(premiere).toContainText('Ind : indice (TD − TR)');
  // CA-2 : terminée, ou provisoire.
  await expect(premiere).toContainText('Terminée');
  await expect(feuilles(page).last()).toContainText(/Provisoire · \d+ matchs sur 15/);
  // CA-3 : le motif du tireur retiré.
  await expect(feuilles(page).last().getByRole('rowheader').filter({ hasText: 'abandon' })).toHaveCount(1);
  await page.screenshot({ path: 'test-results/impression-poules-resultats.png', fullPage: true });
});

test('US-124 CA-1 : les poules par piste, une page pour 4 poules, sans réseau', async ({ page, context }) => {
  test.setTimeout(120_000);
  await compterImpressions(page);
  await seConnecter(page);
  await importerEpreuve(page, poulesJouees());
  await context.setOffline(true);
  await ouvrirImpressions(page);
  await page.getByRole('button', { name: 'Imprimer : Poules par piste' }).click();
  const feuille = page.getByRole('region', { name: 'Les poules · Page 1 / 1' });
  await expect(feuille).toBeVisible();
  await expect.poll(() => impressions(page)).toBe(1);
  await expect(feuille).toContainText('4 poules · rendez-vous sur votre piste');
  for (const n of [1, 2, 3, 4]) {
    await expect(feuille.getByRole('region', { name: `Poule ${n} · Piste ${n}` }).getByRole('listitem')).toHaveCount(6);
  }
  await page.screenshot({ path: 'test-results/impression-poules-pistes.png', fullPage: true });
  await context.setOffline(false);
});

test('US-125 CA-1 et CA-2 : le classement après les poules, depuis le menu « ⋯ » du Classement', async ({ page }) => {
  test.setTimeout(120_000);
  await compterImpressions(page);
  await seConnecter(page);
  await importerEpreuve(page, [
    ...poulesJouees({ aTirer: 6 }),
    { type: 'TireurRetireDesPoules', donnees: { tireurId: 't4', motif: 'abandon' } },
  ]);
  await page
    .getByRole('navigation', { name: 'Étapes de l’épreuve' })
    .getByRole('link', { name: /^Classement/ })
    .click();
  await page
    .getByRole('button', { name: /^Autres actions pour / })
    .first()
    .click();
  await page.getByRole('menuitem', { name: /Imprimer le classement/ }).click();
  const feuille = page.getByRole('region', { name: 'Classement après les poules · Page 1 / 1' });
  await expect(feuille).toBeVisible();
  await expect.poll(() => impressions(page)).toBe(1);
  // CA-1 : une ligne par tireur, « Provisoire » tant qu'un match reste à tirer.
  await expect(feuille.getByRole('rowheader')).toHaveCount(24);
  await expect(feuille).toContainText(/Provisoire · \d+ matchs sur 60/);
  // CA-2 : le tireur retiré est en fin de liste, sans rang, avec son motif.
  await expect(feuille.getByRole('row').last()).toContainText('—');
  await expect(feuille.getByRole('row').last()).toContainText('Abandon');
  await page.screenshot({ path: 'test-results/impression-classement-poules.png', fullPage: true });
});
