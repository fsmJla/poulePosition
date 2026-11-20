// Saisir et corriger un score du tableau sur le PC (US-111, planche 11) : carte de saisie, victoire au temps, égalité
// départagée par la priorité, scores invalides, correction, correction impossible, lecture seule, temps réel (US-110
// CA-5) et hors ligne.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import {
  importerEpreuve,
  nomDe,
  ordreDesQualifiees,
  ouvrirTableau,
  poulesJouees,
  resultatsPlanche11,
  saisirScoreTableau,
} from './tableau-outils';

const carte = (page: Page) => page.getByRole('region', { name: 'Saisie du match' });
const arbre = (page: Page) => page.getByRole('region', { name: /^Du |^Des |^Finale$|^Demi-finales$/ });
const pilules = (page: Page) => page.getByRole('group', { name: 'Tours du tableau' }).getByRole('button');

async function epreuvePlanche11(page: Page) {
  const poules = poulesJouees();
  const qualifies = ordreDesQualifiees(poules);
  const adresse = await importerEpreuve(page, [
    ...poules,
    { type: 'TableauCree', donnees: { qualifies } },
    ...resultatsPlanche11(qualifies),
  ]);
  return { adresse, nom: (rang: number) => nomDe(qualifies[rang - 1]!) };
}

const saisir = (page: Page, haut: string, bas: string) => saisirScoreTableau(page, Number(haut), Number(bas));
const colonne = (page: Page, i: 0 | 1) =>
  carte(page)
    .getByRole('group', { name: /^Score de / })
    .nth(i);

test('US-111 CA-1, CA-2, CA-6 et CA-9 : la carte du match choisi, valider, corriger (planche 11)', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'pc', 'La planche est à 1360 px : projet « pc » seulement');
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1360, height: 1100 });
  await seConnecter(page);
  const { nom } = await epreuvePlanche11(page);
  await ouvrirTableau(page);

  // CA-1 : d'office, le premier match en piste du tour en cours.
  await expect(carte(page).getByRole('heading', { name: 'Tableau de 16 · match 4' })).toBeVisible();
  await expect(carte(page)).toContainText(/Piste 4 · appelé à \d+ h \d\d/);

  // Le match 5, choisi dans l'arbre, comme sur la planche.
  await arbre(page)
    .getByRole('button', { name: `${nom(3)} contre ${nom(14)}, En piste 3` })
    .click();
  await expect(carte(page).getByRole('heading', { name: 'Tableau de 16 · match 5' })).toBeVisible();
  await expect(carte(page)).toContainText('(3)');
  await expect(carte(page)).toContainText('(14)');
  await expect(carte(page).getByRole('group', { name: `Score de ${nom(3)}` })).toBeVisible();
  // US-117 CA-3 : 0 est présélectionné des deux côtés.
  await expect(colonne(page, 0).getByRole('button', { name: /^0 pour / })).toHaveAttribute('aria-pressed', 'true');
  await expect(colonne(page, 1).getByRole('button', { name: /^0 pour / })).toHaveAttribute('aria-pressed', 'true');
  await expect(carte(page).getByRole('button', { name: 'Valider le score' })).toBeDisabled();
  await saisir(page, '15', '11');
  await page.screenshot({ path: 'test-results/tableau-saisir.png', fullPage: true });

  // CA-2 : le score est enregistré, le vainqueur passe en quart.
  await carte(page).getByRole('button', { name: 'Valider le score' }).click();
  const [court3, court14] = [nom(3).split(' ')[0], nom(14).split(' ')[0]];
  await expect(page.getByText(`${court3} 15–11 ${court14} enregistré`)).toBeVisible();
  await expect(arbre(page).getByRole('button', { name: `${nom(3)} contre ${nom(14)}, Terminé` })).toBeVisible();
  await expect(
    arbre(page).getByRole('button', { name: `${nom(3)} contre Vainqueur du match 6, En attente` }),
  ).toBeVisible();
  await expect(pilules(page).nth(1)).toHaveText('Tableau de 165/8');

  // CA-6 : correction d'un match terminé dont le match suivant n'est pas réglé ; le vainqueur change.
  await arbre(page)
    .getByRole('button', { name: `${nom(3)} contre ${nom(14)}, Terminé` })
    .click();
  await expect(colonne(page, 0).getByRole('button', { name: /^V pour / })).toHaveAttribute('aria-pressed', 'true');
  await saisir(page, '13', '15');
  await carte(page).getByRole('button', { name: 'Valider le score' }).click();
  await expect(
    arbre(page).getByRole('button', { name: `${nom(14)} contre Vainqueur du match 6, En attente` }),
  ).toBeVisible();
});

test('US-111 CA-3 à CA-5 : victoire au temps, égalité départagée par la priorité, score invalide', async ({ page }) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  const { nom } = await epreuvePlanche11(page);
  await ouvrirTableau(page);
  await expect(carte(page).getByRole('heading', { name: 'Tableau de 16 · match 4' })).toBeVisible();

  // CA-5 et US-117 CA-4 : deux « V » sont refusés ; aucun score ne dépasse les touches du tableau.
  await saisir(page, '15', '15');
  await expect(carte(page).getByRole('alert')).toHaveText('Un seul vainqueur : choisissez « V » d’un seul côté');
  await expect(carte(page).getByRole('button', { name: 'Valider le score' })).toBeDisabled();
  await expect(colonne(page, 0).getByRole('button')).toHaveCount(16);

  // CA-3 : victoire au temps.
  await saisir(page, '8', '6');
  await expect(carte(page).getByText(`Victoire au temps de ${nom(4).split(' ')[0]}`)).toBeVisible();

  // CA-4 : égalité, le vainqueur se désigne par la priorité.
  await saisir(page, '9', '9');
  const priorite = carte(page).getByRole('group', { name: 'Vainqueur par priorité' });
  await expect(priorite).toBeVisible();
  await expect(carte(page).getByRole('button', { name: 'Valider le score' })).toBeDisabled();
  await priorite.getByRole('radio', { name: nom(13) }).check();
  await carte(page).getByRole('button', { name: 'Valider le score' }).click();
  await expect(arbre(page).getByRole('button', { name: `${nom(4)} contre ${nom(13)}, Terminé` })).toBeVisible();
  await expect(arbre(page).getByRole('button', { name: new RegExp(`^${nom(12)} contre ${nom(13)}`) })).toBeVisible();
});

test('US-111 CA-7 : un match dont le match suivant est réglé ne se corrige plus', async ({ page }) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  const { nom } = await epreuvePlanche11(page);
  await ouvrirTableau(page);
  await pilules(page).first().click();
  await arbre(page)
    .getByRole('button', { name: `${nom(16)} contre ${nom(17)}, Terminé` })
    .click();
  await expect(carte(page)).toContainText('Corrigez d’abord le match suivant (tableau de 16 · match 1)');
  await expect(carte(page).getByRole('button', { name: 'Valider le score' })).toHaveCount(0);
  await expect(colonne(page, 0).getByRole('button', { name: /^0 pour / })).toBeDisabled();
  await carte(page).getByRole('button', { name: 'Tableau de 16 · match 1' }).click();
  await expect(carte(page).getByRole('heading', { name: 'Tableau de 16 · match 1' })).toBeVisible();
});

test('US-111 CA-8 et US-110 CA-5 : un second onglet est en lecture seule et suit les scores sans recharger', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  const { adresse, nom } = await epreuvePlanche11(page);
  await ouvrirTableau(page);
  await expect(carte(page).getByRole('button', { name: 'Valider le score' })).toBeVisible();

  const second = await page.context().newPage();
  await second.goto(`${adresse}/tableau`);
  await expect(carte(second).getByRole('heading', { name: 'Tableau de 16 · match 4' })).toBeVisible({
    timeout: 20_000,
  });
  // CA-8 : pas de saisie hors de l'onglet qui tient l'écriture.
  await expect(carte(second).getByRole('button', { name: 'Valider le score' })).toHaveCount(0);

  // US-110 CA-5 : un score saisi dans le premier onglet apparaît dans le second.
  await saisir(page, '15', '10');
  await carte(page).getByRole('button', { name: 'Valider le score' }).click();
  await expect(arbre(second).getByRole('button', { name: `${nom(4)} contre ${nom(13)}, Terminé` })).toBeVisible({
    timeout: 10_000,
  });
  await second.close();
});

test('US-111 hors ligne : les matchs se saisissent sans réseau jusqu’à la finale', async ({ page, context }) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  // 6 qualifiées : quarts de finale, 2 exemptes (rangs 1 et 2).
  const poules = poulesJouees({ nombre: 6 });
  const qualifies = ordreDesQualifiees(poules);
  await importerEpreuve(page, [...poules, { type: 'TableauCree', donnees: { qualifies } }]);
  const nom = (rang: number) => nomDe(qualifies[rang - 1]!);
  await ouvrirTableau(page);
  await context.setOffline(true);
  // Quarts (4-5 et 3-6), demies, finale : le meilleur rang gagne 15-5.
  for (let i = 0; i < 5; i += 1) {
    await expect(carte(page).getByRole('button', { name: 'Valider le score' })).toBeVisible();
    await saisir(page, '15', '5');
    await carte(page).getByRole('button', { name: 'Valider le score' }).click();
    await expect(page.getByText(/enregistré$/)).toBeVisible();
  }
  await pilules(page)
    .filter({ hasText: /^Finale/ })
    .click();
  await expect(arbre(page).getByRole('button', { name: `${nom(1)} contre ${nom(2)}, Terminé` })).toBeVisible();
  await context.setOffline(false);
});
