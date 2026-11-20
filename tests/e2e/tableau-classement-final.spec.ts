// Classement final et fin de l'épreuve (US-115, gabarit de la planche 20) : pilule « Classement final », places acquises,
// ex aequo et retraits, « Terminer l'épreuve », podium du Résumé, prochaine étape, un seul qualifié, hors ligne.
import { expect, test, type Page } from '@playwright/test';
import type { Proposition } from '@poule-position/domaine';
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
const classement = (page: Page) => page.getByRole('region', { name: /^Classement final · / });
const lignes = (page: Page) => classement(page).locator('tbody tr');

/** 6 qualifiées, tableau entier tiré : le meilleur rang gagne, sauf l'abandon de la 6e en quart. */
function tableauTire(): { propositions: Proposition[]; nom: (rang: number) => string } {
  const poules = poulesJouees({ nombre: 6 });
  const q = ordreDesQualifiees(poules);
  const score = (match: string, a: number, b: number): Proposition => ({
    type: 'ScoreTableauSaisi',
    donnees: { match, tireurA: q[a - 1]!, tireurB: q[b - 1]!, touchesA: 15, touchesB: 9 },
  });
  return {
    propositions: [
      ...poules,
      { type: 'TableauCree', donnees: { qualifies: q } },
      score('8-2', 4, 5),
      { type: 'TireurRetireDuTableau', donnees: { match: '8-3', tireurId: q[5]!, motif: 'abandon' } },
      score('4-1', 1, 4),
      score('4-2', 2, 3),
      score('2-1', 1, 2),
    ],
    nom: (rang) => nomDe(q[rang - 1]!),
  };
}

test('US-115 CA-1, CA-2, CA-4, CA-7 et CA-8 : le classement provisoire, au gabarit de la planche 20', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'pc', 'La planche est à 1360 px : projet « pc » seulement');
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1360, height: 1480 });
  await seConnecter(page);
  const poules = poulesJouees();
  const qualifies = ordreDesQualifiees(poules);
  await importerEpreuve(page, [
    ...poules,
    { type: 'TableauCree', donnees: { qualifies } },
    ...resultatsPlanche11(qualifies),
  ]);
  await ouvrirTableau(page);
  // CA-1 : la pilule « Classement final » suit la finale, « provisoire ».
  await expect(pilules(page).last()).toHaveText('Classement finalprovisoire');
  await pilules(page).last().click();
  await expect(pilules(page).last()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('region', { name: 'Saisie du match' })).toHaveCount(0);

  // CA-4 : provisoire ; seules les places du tableau de 32, terminé, sont données (17 à 24).
  await expect(classement(page).getByText('Provisoire · 12 matchs sur 23')).toBeVisible();
  await expect(lignes(page)).toHaveCount(24);
  await expect(lignes(page).first().locator('td').first()).toHaveText('—');
  await expect(lignes(page).first()).toContainText('En lice');
  const dix7 = lignes(page).filter({ hasText: nomDe(qualifies[16]!) });
  await expect(dix7.locator('td').first()).toHaveText('17');
  await expect(dix7).toContainText('Tableau de 32');
  // Les éliminées du tableau de 16 attendent la fin du tour.
  await expect(lignes(page).filter({ hasText: nomDe(qualifies[15]!) })).toContainText('Place à venir');

  // CA-7 : l'impression du classement final est livrée par US-128.
  await page.getByRole('button', { name: 'Autres actions pour Tableau' }).click();
  await expect(page.getByRole('menuitem', { name: /^Imprimer le classement final/ })).not.toHaveAttribute(
    'aria-disabled',
    'true',
  );
  await page.keyboard.press('Escape');
  await page.screenshot({ path: 'test-results/tableau-classement-final.png', fullPage: true });
});

test('US-115 CA-3, CA-5 et CA-6 : terminer l’épreuve, places, podium et prochaine étape', async ({ page }) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  const { propositions, nom } = tableauTire();
  const adresse = await importerEpreuve(page, propositions);

  // CA-6 : le Résumé propose de terminer l'épreuve.
  const bandeau = page.getByRole('region', { name: 'Prochaine étape' });
  await expect(bandeau).toContainText('Tous les matchs du tableau sont tirés : terminer l’épreuve');
  await bandeau.getByRole('button', { name: 'Terminer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/tableau$/);
  await pilules(page).last().click();

  // CA-3 : 1re, 2e, deux 3es ex aequo, puis les quarts par rang ; l'abandon garde sa place.
  await expect(classement(page).getByText('Définitif', { exact: true })).toBeVisible();
  await expect(lignes(page).locator('td:first-child')).toHaveText(['1', '2', '3=', '3=', '5', '6']);
  await expect(lignes(page).first()).toContainText(nom(1));
  await expect(lignes(page).first()).toContainText('Vainqueur');
  await expect(lignes(page).last()).toContainText(nom(6));
  await expect(lignes(page).last()).toContainText('Abandon');

  // CA-5 : terminer l'épreuve, confirmé.
  await page.getByRole('button', { name: 'Terminer l’épreuve' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Terminer l’épreuve' }).click();
  await expect(page.getByText('Épreuve terminée', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Terminer l’épreuve' })).toHaveCount(0);
  await expect(page.getByText('Terminé', { exact: true })).toBeVisible();

  // Le Résumé montre le podium, sans prochaine étape.
  await page.goto(adresse);
  const podium = page.getByRole('region', { name: 'Podium' });
  await expect(podium.getByRole('listitem')).toHaveCount(4, { timeout: 20_000 });
  await expect(podium.getByRole('listitem').first()).toContainText(nom(1));
  await expect(page.getByRole('region', { name: 'Prochaine étape' })).toHaveCount(0);
});

test('US-115 cas limite et hors ligne : un seul qualifié remporte l’épreuve, terminée sans réseau', async ({
  page,
  context,
}) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  const poules = poulesJouees({ nombre: 6 });
  const retraits: Proposition[] = ['t2', 't3', 't4', 't5', 't6'].map((tireurId) => ({
    type: 'TireurRetireDesPoules',
    donnees: { tireurId, motif: 'forfait' },
  }));
  await importerEpreuve(page, [...poules, ...retraits]);
  await ouvrirTableau(page);
  await context.setOffline(true);
  await expect(page.getByText('Un seul tireur qualifié : il remporte l’épreuve.')).toBeVisible();
  await expect(lignes(page).first()).toContainText(nomDe('t1'));
  await expect(lignes(page).first().locator('td').first()).toHaveText('1');
  await expect(lignes(page).last()).toContainText('Forfait');
  await page.getByRole('button', { name: 'Terminer l’épreuve' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Terminer l’épreuve' }).click();
  await expect(page.getByText('Épreuve terminée', { exact: true })).toBeVisible();
  await context.setOffline(false);
});
