// Déroulé assoupli (US-158) : créer le tableau avant la fin des poules, terminer l'épreuve avant la fin du tableau (menu
// « ⋯ » de l'étape « Tableau »), 3e place à trois qualifiées, hors ligne. Le champ « Pistes » est dans
// poules-constituer.spec.ts.
import { expect, test, type Page } from '@playwright/test';
import type { Proposition } from '@poule-position/domaine';
import { seConnecter } from './compte';
import { importerEpreuve, nomDe, ordreDesQualifiees, ouvrirTableau, poulesJouees } from './tableau-outils';

const menuTableau = (page: Page) => page.getByRole('button', { name: 'Autres actions pour Tableau' });
const classement = (page: Page) => page.getByRole('region', { name: /^Classement final · / });
const pilules = (page: Page) => page.getByRole('group', { name: 'Tours du tableau' }).getByRole('button');

async function ouvrirEtape(page: Page, etape: RegExp, titre: string) {
  await page.getByRole('navigation', { name: 'Étapes de l’épreuve' }).getByRole('link', { name: etape }).click();
  await expect(page.getByRole('heading', { level: 2, name: titre })).toBeVisible({ timeout: 20_000 });
}

test('US-158 CA-1 à CA-4 et hors ligne : créer le tableau sans attendre la fin des poules', async ({
  page,
  context,
}) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  await importerEpreuve(page, poulesJouees({ nombre: 6, aTirer: 2 }));
  await ouvrirTableau(page);
  // CA-1 : l'action principale reste absente ; le menu « ⋯ » propose la création anticipée.
  await expect(page.getByRole('button', { name: 'Créer le tableau', exact: true })).toHaveCount(0);
  await context.setOffline(true);
  await menuTableau(page).click();
  await page.getByRole('menuitem', { name: 'Créer le tableau sans attendre la fin des poules…' }).click();
  // CA-2 : la confirmation compte les matchs non tirés, par poule ; « Annuler » ne change rien.
  const fenetre = page.getByRole('dialog');
  await expect(fenetre).toContainText('2 matchs non tirés : poule 1 (2)');
  await fenetre.getByRole('button', { name: 'Annuler' }).click();
  await expect(fenetre).toHaveCount(0);
  await menuTableau(page).click();
  await page.getByRole('menuitem', { name: 'Créer le tableau sans attendre la fin des poules…' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Créer le tableau' }).click();
  // CA-3 : le tableau est créé, hors ligne, sur le classement des matchs tirés.
  await expect(page.getByRole('status').filter({ hasText: 'Tableau créé' })).toBeVisible();
  await expect(pilules(page).first()).toBeVisible();

  // CA-4 : les poules sont figées, les matchs restants « Non tiré » ; le classement est définitif.
  await ouvrirEtape(page, /^Poules/, 'Poules');
  await expect(page.getByText('Non tiré', { exact: true })).toHaveCount(2);
  await ouvrirEtape(page, /^Classement/, 'Classement des poules');
  await expect(page.getByText('Définitif · 2 matchs non tirés')).toBeVisible();
  await context.setOffline(false);
});

test('US-158 CA-5, CA-6 et hors ligne : terminer l’épreuve sans attendre la fin du tableau', async ({
  page,
  context,
}) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  const poules = poulesJouees({ nombre: 6 });
  const q = ordreDesQualifiees(poules);
  // 6 qualifiées, tableau de 8 : seul le match 4-5 est tiré, gagné par la 5e.
  await importerEpreuve(page, [
    ...poules,
    { type: 'TableauCree', donnees: { qualifies: q } },
    {
      type: 'ScoreTableauSaisi',
      donnees: { match: '8-2', tireurA: q[4]!, tireurB: q[3]!, touchesA: 15, touchesB: 9 },
    },
  ]);
  await ouvrirTableau(page);
  await context.setOffline(true);
  await menuTableau(page).click();
  await page.getByRole('menuitem', { name: 'Terminer l’épreuve sans attendre la fin du tableau…' }).click();
  // CA-5 : la confirmation compte les matchs non tirés (8-3, deux demies, finale).
  await expect(page.getByRole('dialog')).toContainText('4 matchs non tirés.');
  await page.getByRole('dialog').getByRole('button', { name: 'Terminer l’épreuve' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Épreuve terminée' })).toBeVisible();

  // CA-6 : chaque match est départagé par le rang après poules ; le classement final porte la mention.
  await pilules(page).last().click();
  await expect(classement(page)).toContainText('Épreuve terminée avant la fin du tableau');
  await expect(classement(page)).toContainText('Définitif');
  const lignes = classement(page).locator('tbody tr');
  await expect(lignes.nth(0)).toContainText(nomDe(q[0]!));
  await expect(lignes.nth(1)).toContainText(nomDe(q[1]!));
  await pilules(page).first().click();
  await expect(page.getByText('Non tiré').first()).toBeVisible();
  await context.setOffline(false);
});

test('US-158 CA-7 : à trois qualifiées, pas de match pour la 3e place, l’épreuve se termine', async ({ page }) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  const poules = poulesJouees({ nombre: 6 });
  const retraits: Proposition[] = ['t4', 't5', 't6'].map((tireurId) => ({
    type: 'TireurRetireDesPoules',
    donnees: { tireurId, motif: 'forfait' },
  }));
  const q = ordreDesQualifiees([...poules, ...retraits]);
  expect(q).toHaveLength(3);
  const score = (match: string, a: number, b: number): Proposition => ({
    type: 'ScoreTableauSaisi',
    donnees: { match, tireurA: q[a - 1]!, tireurB: q[b - 1]!, touchesA: 15, touchesB: 9 },
  });
  await importerEpreuve(page, [
    ...poules,
    ...retraits,
    { type: 'FormuleModifiee', donnees: { matchTroisieme: true } },
    { type: 'TableauCree', donnees: { qualifies: q } },
    score('4-2', 2, 3),
    score('2-1', 1, 2),
  ]);
  await ouvrirTableau(page);
  await expect(page.getByRole('button', { name: /^3e place/ })).toHaveCount(0);
  await pilules(page).last().click();
  await expect(page.getByRole('button', { name: 'Terminer l’épreuve', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Terminer l’épreuve', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Terminer l’épreuve' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Épreuve terminée' })).toBeVisible();
  const lignes = classement(page).locator('tbody tr');
  await expect(lignes.nth(2)).toContainText(nomDe(q[2]!));
  await expect(lignes.nth(2).locator('td').first()).toHaveText('3');
});
