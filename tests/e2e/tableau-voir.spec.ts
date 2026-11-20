// Voir le tableau (US-110, planche 11) : tours en pilules avec leur avancement, arbre du tour choisi à la finale, état
// de chaque match, choix d'un match, légende, smartphone et hors ligne.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import {
  importerEpreuve,
  nomDe,
  ordreDesQualifiees,
  ouvrirTableau,
  poulesJouees,
  resultatsPlanche11,
} from './tableau-outils';

const pilules = (page: Page) => page.getByRole('group', { name: 'Tours du tableau' }).getByRole('button');
const arbre = (page: Page) => page.getByRole('region', { name: /^Du tableau de 16 à la finale$|^Des |^Du / });

/** L'épreuve de la planche 11 : 24 qualifiées, tableau de 32 terminé, tableau de 16 à 4/8. */
async function epreuvePlanche11(page: Page) {
  const poules = poulesJouees();
  const qualifies = ordreDesQualifiees(poules);
  await importerEpreuve(page, [
    ...poules,
    { type: 'TableauCree', donnees: { qualifies } },
    ...resultatsPlanche11(qualifies),
  ]);
  return (rang: number) => nomDe(qualifies[rang - 1]!);
}

test('US-110 CA-1 à CA-4, CA-6 et CA-8 : pilules, arbre, états, choix d’un match (planche 11)', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'pc', 'La planche est à 1360 px : projet « pc » seulement');
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1360, height: 1100 });
  await seConnecter(page);
  const nom = await epreuvePlanche11(page);
  await ouvrirTableau(page);
  await expect(page.getByText('Tableau de 32 · 24 qualifiés, 8 exempts · pas de match pour la 3e place')).toBeVisible();

  // CA-1 : une pilule par tour, avec son avancement ; le tour en cours est choisi.
  await expect(pilules(page)).toHaveText(['Tableau de 32terminé', 'Tableau de 164/8', 'Quarts0/4', 'Demies', 'Finale']);
  await expect(pilules(page).nth(1)).toHaveAttribute('aria-pressed', 'true');

  // CA-2 : l'arbre du tableau de 16 à la finale, en quatre colonnes.
  const region = page.getByRole('region', { name: 'Du tableau de 16 à la finale' });
  await expect(region.getByRole('heading', { level: 4 })).toHaveText([
    'Tableau de 16',
    'Quarts de finale',
    'Demi-finales',
    'Finale',
  ]);

  // CA-3 : l'état de chaque match.
  await expect(region.getByRole('button', { name: `${nom(1)} contre ${nom(16)}, Terminé` })).toBeVisible();
  await expect(region.getByRole('button', { name: `${nom(4)} contre ${nom(13)}, En piste 4` })).toBeVisible();
  await expect(
    region.getByRole('button', { name: `${nom(1)} contre ${nom(8)}, À tirer · piste à attribuer` }),
  ).toBeVisible();
  await expect(
    region.getByRole('button', { name: `${nom(12)} contre Vainqueur du match 4, En attente` }),
  ).toBeVisible();
  await expect(
    region.getByRole('button', { name: 'Vainqueur du quart 1 contre Vainqueur du quart 2, En attente' }),
  ).toBeVisible();
  // Le vainqueur est en gras, le score affiché.
  await expect(region.getByRole('button', { name: new RegExp(`^${nom(12)} contre`) }).first()).toBeVisible();

  // CA-6 : une légende unique.
  await expect(page.getByText('(n) : rang au classement après poules.', { exact: false })).toHaveCount(1);
  await page.screenshot({ path: 'test-results/tableau-voir.png', fullPage: true });

  // CA-4 : un clic choisit le match.
  const match = region.getByRole('button', { name: `${nom(3)} contre ${nom(14)}, En piste 3` });
  await match.click();
  await expect(match).toHaveAttribute('aria-pressed', 'true');

  // CA-1 : choisir une autre pilule montre l'arbre à partir de ce tour.
  await pilules(page).first().click();
  await expect(page.getByRole('region', { name: 'Du tableau de 32 aux demi-finales' })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`^${nom(1)}, Exempt$`) })).toBeVisible();
  await expect(arbre(page)).toHaveCount(1);
});

test('US-110 CA-7 : à 390 px, les pilules et l’arbre défilent dans leur cadre', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await seConnecter(page);
  await epreuvePlanche11(page);
  await page.goto(`${page.url()}/tableau`);
  await expect(page.getByRole('heading', { level: 2, name: 'Tableau' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('region', { name: 'Du tableau de 16 à la finale' })).toBeVisible();
  const largeurPage = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(largeurPage).toBeLessThanOrEqual(390);
  const pilule = pilules(page).first();
  const boite = await pilule.boundingBox();
  expect(boite!.height).toBeGreaterThanOrEqual(40);
});

test('US-110 hors ligne : l’arbre s’affiche depuis le journal local', async ({ page, context }) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  const nom = await epreuvePlanche11(page);
  await context.setOffline(true);
  await ouvrirTableau(page);
  await expect(page.getByRole('button', { name: `${nom(1)} contre ${nom(16)}, Terminé` })).toBeVisible();
  await context.setOffline(false);
});
