// Feuille de présence (US-121, planche 23) et gabarit commun des documents imprimés (US-120 CA-3) : les inscrits par
// ordre alphabétique, la case « Présent » cochée pour les pointés, plusieurs pages, l'en-tête et le pied ; la fenêtre
// d'impression s'ouvre ; à l'impression, seule la feuille reste. Sans réseau aussi.
import { expect, test, type Page } from '@playwright/test';
import type { Proposition } from '@poule-position/domaine';
import { seConnecter } from './compte';
import { importerEpreuve, poulesJouees } from './tableau-outils';

/** 24 tireuses pointées (poules jouées) et 6 inscrites absentes, aux noms en fin d'alphabet : 30 lignes, 2 pages. */
function inscrits(): Proposition[] {
  const absentes: Proposition[] = Array.from({ length: 6 }, (_, i) => ({
    type: 'TireurInscrit',
    donnees: {
      tireurId: `t${100 + i}`,
      nom: `ZORN${'ABCDEF'[i]}`,
      prenom: 'Absente',
      club: 'Pessac',
    },
  }));
  return [...absentes, ...poulesJouees()];
}

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

// Les impressions se lancent depuis le PC pilote (ADR-0009) : la navigation des étapes y est latérale.
test.skip(({ isMobile }) => isMobile, 'Impressions : projet « pc » seulement');

test('US-121 CA-1 à CA-3 et US-120 CA-3 : la feuille de présence, en deux pages, avec en-tête et pied', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await compterImpressions(page);
  await seConnecter(page);
  await importerEpreuve(page, inscrits());
  await ouvrirImpressions(page);
  await page.getByRole('button', { name: 'Imprimer : Feuille de présence' }).click();
  await expect(page).toHaveURL(/\/imprimer\?document=presence$/);

  // US-120 CA-3 : deux feuilles, chacune avec l'en-tête (titre) et le pied (date, page n / N) ; l'impression s'ouvre.
  const feuilles = page.getByRole('region', { name: /^Feuille de présence · Page \d \/ 2$/ });
  await expect(feuilles).toHaveCount(2);
  await expect(feuilles.first()).toContainText('Poule Position ·');
  await expect(feuilles.first()).toContainText(/Imprimé le \d{2}\/\d{2}\/\d{4} à \d+ h \d{2}/);
  await expect(feuilles.first()).toContainText('24 présents sur 30 au moment de l’impression');
  await expect.poll(() => impressions(page)).toBe(1);

  // CA-1 : par ordre alphabétique, 28 lignes puis 2 ; CA-3 : l'en-tête du tableau est répété.
  await expect(feuilles.first().getByRole('row')).toHaveCount(29);
  await expect(feuilles.last().getByRole('row')).toHaveCount(3);
  await expect(feuilles.last().getByRole('columnheader', { name: 'Signature' })).toBeVisible();
  const noms = await page.getByRole('rowheader').allTextContents();
  expect(noms).toEqual([...noms].sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' })));
  // CA-2 : les tireuses pointées ont leur case cochée, les absentes non.
  await expect(page.getByRole('img', { name: 'pointé à l’émargement' })).toHaveCount(24);
  await expect(feuilles.last().getByRole('row', { name: /ZORNF Absente/ })).not.toContainText('✕');

  // À l'impression, ni l'entête de l'application ni les boutons.
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('button', { name: 'Retour aux impressions' })).toBeHidden();
  await expect(page.getByRole('link', { name: 'Poule Position' }).first()).toBeHidden();
  await page.emulateMedia({ media: 'screen' });
  await page.screenshot({ path: 'test-results/impression-presence.png', fullPage: true });
});

test('US-121 : « ⋯ › Imprimer la feuille de présence » de l’Émargement ; sans réseau', async ({ page, context }) => {
  test.setTimeout(120_000);
  await compterImpressions(page);
  await seConnecter(page);
  await importerEpreuve(page, poulesJouees());
  await page
    .getByRole('navigation', { name: 'Étapes de l’épreuve' })
    .getByRole('link', { name: /^Émargement/ })
    .click();
  await context.setOffline(true);
  await page
    .getByRole('button', { name: /^Autres actions pour / })
    .first()
    .click();
  await page.getByRole('menuitem', { name: /Imprimer la feuille de présence/ }).click();
  await expect(page.getByRole('region', { name: 'Feuille de présence · Page 1 / 1' })).toBeVisible();
  await expect.poll(() => impressions(page)).toBe(1);
  await context.setOffline(false);
});
