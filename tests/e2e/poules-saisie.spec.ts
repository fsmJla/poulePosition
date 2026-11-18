// Saisir les scores des poules sur le PC (US-088, planche 10) : onglets, feuille de poule, match en cours (Entrée valide
// et passe au suivant), contrôle du score, victoire au temps, correction, poule terminée, hors ligne.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { epreuveAvecPresentes, ouvrirPoules, repartir } from './poules-outils';

/** Répartit et lance les poules (US-086, US-087). */
async function lancer(page: Page, adresse: string) {
  await repartir(page, adresse);
  await page.getByRole('button', { name: 'Lancer les poules' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lancer les poules' }).click();
  await expect(page.getByRole('heading', { level: 3, name: /^Feuille de la poule 1/ })).toBeVisible();
}

const carteSaisie = (page: Page) => page.getByRole('region', { name: /^Match \d+ sur \d+$/ });

/** Saisit le match en cours : `a` touches pour le premier tireur, `b` pour le second, Entrée. */
async function saisir(page: Page, a: number, b: number) {
  const carte = carteSaisie(page);
  const titre = await carte.getByRole('heading').textContent();
  await carte.getByRole('textbox').nth(0).fill(String(a));
  await carte.getByRole('textbox').nth(1).fill(String(b));
  await carte.getByRole('textbox').nth(1).press('Enter');
  // Le match suivant s'ouvre (ou la carte disparaît après le dernier match).
  await expect(page.getByRole('region', { name: titre ?? '', exact: true })).toHaveCount(0);
}

const case_ = (page: Page, nom: string, adversaire: string) =>
  page.getByRole('button', { name: new RegExp(`^${nom} contre ${adversaire} : `) });

test('US-088 CA-1 à CA-3 et CA-8 : onglets, feuille, saisie dans l’ordre officiel (planche 10)', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1360, height: 1200 });
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page);
  await lancer(page, adresse);

  // CA-1 : l'entête et un onglet par poule, avec sa piste et son avancement.
  await expect(page.getByText(/^0 match sur 60 · le classement après poules/)).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(4);
  await page.getByRole('tab', { name: /Poule 2/ }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'Feuille de la poule 2 · piste 2' })).toBeVisible();

  // CA-3 : match 1 (1 contre 2), Entrée valide et passe au match 2 (4 contre 5).
  await expect(carteSaisie(page)).toHaveAccessibleName('Match 1 sur 15');
  await expect(carteSaisie(page)).toContainText('1 contre 2');
  await expect(carteSaisie(page)).toContainText('DUBOIS Chloé');
  await saisir(page, 5, 3);
  await expect(carteSaisie(page)).toHaveAccessibleName('Match 2 sur 15');
  await expect(carteSaisie(page)).toContainText('4 contre 5');
  for (const [a, b] of [
    [4, 5],
    [2, 5],
    [5, 1],
    [4, 5],
    [3, 5],
    [5, 4],
    [5, 2],
    [3, 5],
  ] as const) {
    await saisir(page, a, b);
  }

  // CA-2 : la feuille se remplit (V5 pour la victoire, les touches pour la défaite).
  await expect(case_(page, 'DUBOIS Chloé', 'DURAND Emma')).toHaveText('V5');
  await expect(case_(page, 'DURAND Emma', 'DUBOIS Chloé')).toHaveText('3');
  await expect(page.getByRole('tab', { name: /Poule 2/ })).toContainText('9/15 matchs');
  await expect(page.getByText(/^9 matchs sur 60/)).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Étapes de l’épreuve' }).getByRole('link', { name: /^Poules/ }),
  ).toContainText('9/60');
  await expect(page.getByRole('region', { name: 'Ordre des matchs' })).toContainText('en cours');
  await page.screenshot({ path: 'test-results/poules-saisie.png', fullPage: true });
});

test('US-088 CA-4 à CA-7 : contrôle, victoire au temps, correction, poule terminée', async ({ page }) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 6);
  await lancer(page, adresse);
  const carte = carteSaisie(page);

  // CA-4 : égalité, vainqueur sans ses 5 touches : refusés, avec la raison.
  await carte.getByRole('textbox').nth(0).fill('4');
  await carte.getByRole('textbox').nth(1).fill('4');
  await carte.getByRole('button', { name: 'Valider le score' }).click();
  await expect(carte.getByRole('alert')).toHaveText('Pas d’égalité : un des deux tireurs gagne');
  await carte.getByRole('textbox').nth(1).fill('3');
  await carte.getByRole('button', { name: 'Valider le score' }).click();
  await expect(carte.getByRole('alert')).toHaveText('Le vainqueur a 5 touches');
  await expect(carte).toHaveAccessibleName('Match 1 sur 15');

  // CA-5 : au temps, 4 contre 3 est accepté et s'écrit « V4 ».
  await carte.getByLabel('Victoire au temps').check();
  await carte.getByRole('button', { name: 'Valider le score' }).click();
  await expect(carte).toHaveAccessibleName('Match 2 sur 15');
  await expect(case_(page, 'MARTIN Léa', 'DUBOIS Chloé')).toHaveText('V4');

  // CA-6 : un clic sur la case rouvre le match, avec son score ; la validation le remplace.
  await case_(page, 'DUBOIS Chloé', 'MARTIN Léa').click();
  await expect(carte).toHaveAccessibleName('Match 1 sur 15');
  await expect(carte.getByRole('textbox').nth(0)).toHaveValue('4');
  await carte.getByLabel('Victoire au temps').uncheck();
  await carte.getByRole('textbox').nth(0).fill('2');
  await carte.getByRole('textbox').nth(1).fill('5');
  await carte.getByRole('textbox').nth(1).press('Enter');
  await expect(case_(page, 'DUBOIS Chloé', 'MARTIN Léa')).toHaveText('V5');
  await expect(carte).toHaveAccessibleName('Match 2 sur 15');

  // CA-7 : le dernier match saisi, la poule est terminée.
  for (let i = 2; i <= 15; i += 1) await saisir(page, 5, i % 5);
  await expect(page.getByRole('tab', { name: /Poule 1/ })).toContainText('Terminée · 15/15');
  await expect(
    page.getByText('Toutes les poules sont terminées : le classement après poules s’ouvre avec le tableau (E6)'),
  ).toBeVisible();
  await expect(page.getByText(/Tous les matchs de cette poule sont saisis/)).toBeVisible();
});

test('US-088 hors ligne : saisir trois matchs et en corriger un sans réseau', async ({ page, context }) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 6);
  await lancer(page, adresse);
  await context.setOffline(true);
  await saisir(page, 5, 1);
  await saisir(page, 5, 2);
  await saisir(page, 3, 5);
  await case_(page, 'MARTIN Léa', 'DUBOIS Chloé').click();
  await carteSaisie(page).getByRole('textbox').nth(1).fill('4');
  await carteSaisie(page).getByRole('textbox').nth(1).press('Enter');
  await expect(case_(page, 'DUBOIS Chloé', 'MARTIN Léa')).toHaveText('4');
  await context.setOffline(false);
  await ouvrirPoules(page, adresse);
  await expect(case_(page, 'DUBOIS Chloé', 'MARTIN Léa')).toHaveText('4');
  await expect(page.getByText(/^3 matchs sur 15/)).toBeVisible();
});
