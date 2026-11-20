// Documents imprimés du tableau (US-126 à US-128, planches 28 à 30) : feuilles de match d'un tour, deux par page ;
// le tableau à afficher ; le classement final. Depuis l'étape « Impressions » et les menus « ⋯ », sans réseau aussi.
import { expect, test, type Page } from '@playwright/test';
import type { Proposition } from '@poule-position/domaine';
import { seConnecter } from './compte';
import { importerEpreuve, matchEntre, nomDe, ordreDesQualifiees, poulesJouees } from './tableau-outils';

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

/** 24 qualifiées : tableau de 32 (8 exempts, 8 matchs à tirer) ; le match 9 contre 24 appelé sur la piste 3. */
function tableauDe32(): { propositions: Proposition[]; nom: (rang: number) => string } {
  const poules = poulesJouees();
  const qualifies = ordreDesQualifiees(poules);
  return {
    propositions: [
      ...poules,
      { type: 'TableauCree', donnees: { qualifies } },
      { type: 'MatchTableauAppele', donnees: { match: matchEntre(qualifies, 32, [9, 24]), piste: 3 } },
    ],
    nom: (rang) => nomDe(qualifies[rang - 1]!),
  };
}

test('US-126 CA-1 à CA-3 et US-120 CA-2 : les feuilles de match du tour, deux par page', async ({ page }) => {
  test.setTimeout(150_000);
  await compterImpressions(page);
  await seConnecter(page);

  // US-120 CA-2 : sans tableau, la ligne est grisée avec la raison.
  await importerEpreuve(page, poulesJouees());
  await ouvrirImpressions(page);
  await expect(page.getByRole('listitem').filter({ hasText: 'Feuilles de match' })).toContainText(
    'Après la création du tableau',
  );
  await expect(page.getByRole('button', { name: 'Imprimer : Feuilles de match' })).toBeDisabled();

  const { propositions, nom } = tableauDe32();
  await importerEpreuve(page, propositions);
  await ouvrirImpressions(page);
  const ligne = page.getByRole('listitem').filter({ hasText: 'Feuilles de match' });
  await expect(ligne.getByRole('button', { name: 'Tableau de 32' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Imprimer : Feuilles de match' }).click();

  // CA-1 : 8 matchs à tirer, deux par page, « couper ici » entre les deux ; l'impression s'ouvre.
  const pages = page.getByRole('region', { name: /^Feuilles de match · Tableau de 32 · Page \d \/ 4$/ });
  await expect(pages).toHaveCount(4);
  await expect.poll(() => impressions(page)).toBe(1);
  await expect(page.getByRole('region', { name: /^Tableau de 32 · match \d+$/ })).toHaveCount(8);
  await expect(pages.first()).toContainText('couper ici');
  const premiere = pages.first().getByRole('region').first();
  await expect(premiere).toContainText('À gauche');
  await expect(premiere).toContainText('À droite');
  await expect(premiere).toContainText('Le vainqueur passe au tour suivant : Tableau de 16.');
  // CA-2 : le match appelé porte sa piste ; les autres « Piste ____ ».
  const appele = page.getByRole('region', { name: /^Tableau de 32 · match \d+$/ }).filter({ hasText: nom(24) });
  await expect(appele).toContainText('Piste 3 · ___ h ___');
  await expect(appele).toContainText(`(9) ${nom(9)}`);
  await expect(page.getByText('Piste ____ · ___ h ___')).toHaveCount(7);
  await page.screenshot({ path: 'test-results/impression-feuilles-match.png', fullPage: true });
});

test('US-126 hors ligne : les feuilles de match s’impriment sans réseau', async ({ page, context }) => {
  test.setTimeout(120_000);
  await compterImpressions(page);
  await seConnecter(page);
  await importerEpreuve(page, tableauDe32().propositions);
  await context.setOffline(true);
  await ouvrirImpressions(page);
  await page.getByRole('button', { name: 'Imprimer : Feuilles de match' }).click();
  await expect(page.getByRole('region', { name: /^Feuilles de match · Tableau de 32 · Page/ })).toHaveCount(4);
  await context.setOffline(false);
});
