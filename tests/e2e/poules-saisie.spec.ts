// Saisir les scores des poules sur le PC (US-088, planche 10 ; US-091, boutons de la planche 14) : onglets, feuille de
// poule, match en cours (le second bouton enregistre et passe au suivant), contrôle, victoire au temps, correction,
// poule terminée, hors ligne.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import {
  boutonScore,
  casesScore,
  paveScore,
  carteSaisie,
  epreuveAvecPresentes,
  ouvrirPoules,
  repartir,
  saisirBoutons as saisir,
} from './poules-outils';

/** Répartit et lance les poules (US-086, US-087). */
async function lancer(page: Page, adresse: string) {
  await repartir(page, adresse);
  await page.getByRole('button', { name: 'Lancer les poules' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lancer les poules' }).click();
  await expect(page.getByRole('heading', { level: 3, name: /^Feuille de la poule 1/ })).toBeVisible();
}

const case_ = (page: Page, nom: string, adversaire: string) =>
  page.getByRole('button', { name: new RegExp(`^${nom} contre ${adversaire} : `) });

test('US-088 CA-1 à CA-3, CA-8 et US-091 CA-1, CA-7 : onglets, feuille, boutons dans l’ordre officiel', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1360, height: 1200 });
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page);
  await lancer(page, adresse);

  // CA-1 : l'entête et un onglet par poule, avec sa piste et son avancement.
  // US-107 CA-2 : l'étape tient sur une ligne ; l'infobulle de l'avancement dit quand s'ouvre le classement.
  const avancement = page.getByText(/^0 match sur 60$/);
  await expect(avancement).toBeVisible();
  await expect(page.getByTitle(/le classement après poules s’ouvre/)).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(4);
  await page.getByRole('tab', { name: /Poule 2/ }).click();
  await expect(page.getByRole('heading', { level: 3, name: 'Feuille de la poule 2 · piste 2' })).toBeVisible();

  // CA-3 et US-118 CA-1 : match 1 (1 contre 2), deux cases vides et le pavé 0 à 4 et « V », ouvert à gauche, sans
  // champ à taper.
  await expect(carteSaisie(page)).toHaveAccessibleName('Match 1 sur 15');
  await expect(carteSaisie(page)).toContainText('1 contre 2');
  await expect(carteSaisie(page).getByRole('group', { name: 'Score de DUBOIS Chloé' })).toBeVisible();
  await expect(paveScore(page).getByRole('button')).toHaveCount(6);
  await expect(casesScore(page)).toHaveText(['–', '–']);
  await expect(carteSaisie(page).getByRole('textbox')).toHaveCount(0);
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

test('US-091 CA-2 à CA-6 et US-088 CA-7 : deux clics, au temps, refus, correction, poule terminée', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 6);
  await lancer(page, adresse);
  const carte = carteSaisie(page);

  // US-091 CA-5, US-118 CA-3 : deux « V », puis deux chiffres égaux : refusés avec la raison, la saisie recommence.
  await boutonScore(page, 'V').click();
  await expect(casesScore(page)).toHaveText(['V', '–']);
  await boutonScore(page, 'V').click();
  await expect(carte.getByRole('alert')).toHaveText('Un seul vainqueur : choisissez « V » d’un seul côté');
  await expect(casesScore(page)).toHaveText(['–', '–']);
  await boutonScore(page, 2).click();
  await boutonScore(page, 2).click();
  await expect(carte.getByRole('alert')).toHaveText('Pas d’égalité : un des deux tireurs gagne');
  await expect(carte).toHaveAccessibleName('Match 1 sur 15');

  // US-091 CA-4 : sans « V », 4 contre 3 est une victoire au temps (« V4 »), en deux clics.
  await saisir(page, 4, 3);
  await expect(carte).toHaveAccessibleName('Match 2 sur 15');
  await expect(case_(page, 'MARTIN Léa', 'DUBOIS Chloé')).toHaveText('V4');

  // US-091 CA-6, US-118 CA-3 : la case rouvre le match, son score dans les cases, pavé fermé ; deux nouveaux choix
  // le remplacent.
  await case_(page, 'DUBOIS Chloé', 'MARTIN Léa').click();
  await expect(carte).toHaveAccessibleName('Match 1 sur 15');
  await expect(casesScore(page)).toHaveText(['4', '3']);
  await expect(paveScore(page)).toHaveCount(0);
  await saisir(page, 2, 5);
  await expect(case_(page, 'DUBOIS Chloé', 'MARTIN Léa')).toHaveText('V5');
  await expect(carte).toHaveAccessibleName('Match 2 sur 15');

  // US-088 CA-7 : le dernier match saisi, la poule est terminée.
  for (let i = 2; i <= 15; i += 1) await saisir(page, 5, i % 5);
  // US-107 CA-3 : une seule poule, pas d'onglet ; l'ordre des matchs montre le dernier score.
  await expect(page.getByRole('tab')).toHaveCount(0);
  await expect(
    page.getByText('Toutes les poules sont terminées : le classement après poules s’ouvre avec le tableau (E6)'),
  ).toBeVisible();
  await expect(page.getByText(/Tous les matchs de cette poule sont saisis/)).toBeVisible();
});

test('US-088 et US-091 hors ligne : saisir trois matchs et en corriger un sans réseau', async ({ page, context }) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 6);
  await lancer(page, adresse);
  await context.setOffline(true);
  await saisir(page, 5, 1);
  await saisir(page, 5, 2);
  await saisir(page, 3, 5);
  await case_(page, 'MARTIN Léa', 'DUBOIS Chloé').click();
  await saisir(page, 5, 4);
  await expect(case_(page, 'DUBOIS Chloé', 'MARTIN Léa')).toHaveText('4');
  await context.setOffline(false);
  await ouvrirPoules(page, adresse);
  await expect(case_(page, 'DUBOIS Chloé', 'MARTIN Léa')).toHaveText('4');
  await expect(page.getByText(/^3 matchs sur 15/)).toBeVisible();
});
