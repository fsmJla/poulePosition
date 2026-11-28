// Saisir et corriger un score du tableau sur le PC (US-111, planche 11 ; US-117, afficheur et pavé à la demande) :
// carte de saisie, deux choix enregistrent, égalité départagée par la priorité, deux « V » refusés, victoire au temps,
// correction, correction impossible, lecture seule, temps réel (US-110 CA-5) et hors ligne.
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

const saisir = (page: Page, haut: number, bas: number) => saisirScoreTableau(page, haut, bas);
const pave = (page: Page) => carte(page).getByRole('group', { name: /^Score de / });
const cases = (page: Page) => carte(page).getByRole('button', { name: /^Score de .* : / });

test('US-111 CA-1, CA-2, CA-6 et CA-9 : la carte du match choisi, deux choix enregistrent, corriger (planche 11)', async ({
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
  // US-117 : deux cases vides, le pavé ouvert sur le tireur de gauche ; pas de bouton « Valider ».
  await expect(cases(page)).toHaveText(['–', '–']);
  await expect(carte(page).getByRole('group', { name: `Score de ${nom(3)}` })).toBeVisible();
  await expect(carte(page).getByRole('button', { name: 'Valider le score' })).toHaveCount(0);
  await carte(page)
    .getByRole('button', { name: /^V pour / })
    .click();
  // Le pavé passe à droite.
  await expect(carte(page).getByRole('group', { name: `Score de ${nom(14)}` })).toBeVisible();
  await page.screenshot({ path: 'test-results/tableau-saisir.png', fullPage: true });

  // CA-2 : le second choix enregistre ; le vainqueur passe en quart.
  await carte(page)
    .getByRole('button', { name: /^11 pour / })
    .click();
  const [court3, court14] = [nom(3).split(' ')[0], nom(14).split(' ')[0]];
  await expect(page.getByText(`${court3} 15–11 ${court14} enregistré`)).toBeVisible();
  await expect(arbre(page).getByRole('button', { name: `${nom(3)} contre ${nom(14)}, Terminé` })).toBeVisible();
  await expect(
    arbre(page).getByRole('button', { name: `${nom(3)} contre Vainqueur du match 6, En attente` }),
  ).toBeVisible();
  await expect(pilules(page).nth(1)).toHaveText('Tableau de 165/8');
  // US-119 CA-1 et CA-2 : la carte des saisies reçues, sous l'arbre, note le score saisi sur ce PC.
  const recues = page.getByRole('region', { name: 'Saisies reçues des smartphones' });
  await expect(recues.getByRole('listitem').first()).toContainText(
    `Tableau de 16 · match 5 : ${court3} 15 – 11 ${court14}`,
  );
  await expect(recues.getByRole('listitem').first()).toContainText('saisi sur ce PC');
  await expect(recues.getByRole('listitem').first()).toContainText('Enregistrée');

  // CA-6 : correction d'un match terminé dont le match suivant n'est pas réglé ; le vainqueur change.
  await arbre(page)
    .getByRole('button', { name: `${nom(3)} contre ${nom(14)}, Terminé` })
    .click();
  await expect(cases(page)).toHaveText(['11', '15']);
  await expect(pave(page)).toHaveCount(0);
  await saisir(page, 13, 15);
  await expect(
    arbre(page).getByRole('button', { name: `${nom(14)} contre Vainqueur du match 6, En attente` }),
  ).toBeVisible();
  // US-119 CA-2 : la correction dit le score qu'elle remplace.
  await expect(recues.getByRole('listitem').first()).toContainText(
    'Tableau de 16 · match 5 : correction de 15–11 en 13–15',
  );
});

test('US-111 CA-3 à CA-5 : deux « V » refusés, égalité départagée par la priorité, victoire au temps', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  const { nom } = await epreuvePlanche11(page);
  await ouvrirTableau(page);
  await expect(carte(page).getByRole('heading', { name: 'Tableau de 16 · match 4' })).toBeVisible();

  // CA-5 et US-117 : deux « V » sont refusés, la saisie recommence ; aucun score ne dépasse les touches du tableau.
  await expect(pave(page).getByRole('button')).toHaveCount(16);
  await saisir(page, 15, 15);
  await expect(carte(page).getByRole('alert')).toHaveText('Un seul vainqueur : choisissez « V » d’un seul côté');
  await expect(cases(page)).toHaveText(['–', '–']);
  await expect(carte(page).getByRole('group', { name: `Score de ${nom(4)}` })).toBeVisible();

  // CA-4 : égalité, le vainqueur se désigne par la priorité, et ce choix enregistre.
  await saisir(page, 9, 9);
  const priorite = carte(page).getByRole('group', { name: 'Vainqueur par priorité' });
  await expect(priorite).toBeVisible();
  await priorite.getByRole('button', { name: nom(13) }).click();
  await expect(arbre(page).getByRole('button', { name: `${nom(4)} contre ${nom(13)}, Terminé` })).toBeVisible();
  await expect(arbre(page).getByRole('button', { name: new RegExp(`^${nom(12)} contre ${nom(13)}`) })).toBeVisible();

  // CA-3 : victoire au temps, sur le match suivant de la carte.
  await expect(cases(page)).toHaveText(['–', '–']);
  await saisir(page, 8, 6);
  await expect(page.getByText(/ 8–6 .* enregistré$/)).toBeVisible();
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
  await expect(pave(page)).toHaveCount(0);
  await expect(cases(page).first()).toBeDisabled();
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
  await expect(pave(page)).toBeVisible();

  const second = await page.context().newPage();
  await second.goto(`${adresse}/tableau`);
  await expect(carte(second).getByRole('heading', { name: 'Tableau de 16 · match 4' })).toBeVisible({
    timeout: 20_000,
  });
  // CA-8 : pas de saisie hors de l'onglet qui tient l'écriture.
  await expect(pave(second)).toHaveCount(0);
  await expect(cases(second).first()).toBeDisabled();

  // US-110 CA-5 : un score saisi dans le premier onglet apparaît dans le second.
  await saisir(page, 15, 10);
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
    await expect(pave(page)).toBeVisible();
    await expect(cases(page)).toHaveText(['–', '–']);
    await saisir(page, 15, 5);
    await expect(page.getByText(/enregistré$/)).toBeVisible();
  }
  // US-119 hors ligne : la liste se lit dans le journal local ; plus d'appareils connus.
  const recues = page.getByRole('region', { name: 'Saisies reçues des smartphones' });
  await expect(recues).toContainText('Hors ligne : aucun appareil');
  await expect(recues.getByRole('listitem')).toHaveCount(5);
  await pilules(page)
    .filter({ hasText: /^Finale/ })
    .click();
  await expect(arbre(page).getByRole('button', { name: `${nom(1)} contre ${nom(2)}, Terminé` })).toBeVisible();
  await context.setOffline(false);
});
