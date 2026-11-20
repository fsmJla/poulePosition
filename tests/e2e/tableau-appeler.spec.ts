// Appeler un match du tableau sur une piste (US-112, planche 11) : piste proposée (libre, sinon occupée depuis le plus
// longtemps), autre numéro, file d'une piste occupée, changement et retrait de la piste, hors ligne.
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

test('US-112 CA-1 à CA-4 : piste proposée, file d’une piste occupée, changer et retirer la piste', async ({ page }) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  const nom = await epreuvePlanche11(page);
  await ouvrirTableau(page);

  // CA-1 : les quatre pistes des poules sont occupées : la proposition est la piste 4, occupée depuis le plus longtemps.
  await arbre(page)
    .getByRole('button', { name: `${nom(1)} contre ${nom(8)}, À tirer · piste à attribuer` })
    .click();
  await expect(carte(page).getByRole('heading', { name: 'Quarts de finale · match 1' })).toBeVisible();
  await expect(carte(page)).toContainText('Piste à attribuer');
  // US-117 CA-1 : une pastille par piste ; la piste proposée est soulignée, les occupées marquées.
  const pistes = carte(page).getByRole('group', { name: 'Piste' });
  await expect(pistes.getByRole('button', { name: /^Appeler sur la piste [0-9]/ })).toHaveCount(4);
  await expect(pistes.getByRole('button', { name: 'Appeler sur la piste 4 (occupée)' })).toHaveClass(/proposee/);
  // Un autre numéro se saisit par « Autre… ».
  await pistes.getByRole('button', { name: 'Autre…' }).click();
  await pistes.getByLabel('Autre…').fill('7');
  await expect(pistes.getByRole('button', { name: 'Appeler sur la piste 7' })).toBeEnabled();

  // CA-2 et CA-3 : appelé sur la piste 4, encore occupée : le match attend.
  await pistes.getByRole('button', { name: 'Appeler sur la piste 4 (occupée)' }).click();
  await expect(page.getByText('Quarts de finale · match 1 appelé sur la piste 4')).toBeVisible();
  await expect(
    arbre(page).getByRole('button', { name: `${nom(1)} contre ${nom(8)}, À tirer · piste 4` }),
  ).toBeVisible();
  await expect(carte(page)).toContainText('Piste 4 · en attente de la piste');

  // CA-3 : le match de la piste 4 se termine : le quart passe « En piste 4 ».
  await arbre(page)
    .getByRole('button', { name: `${nom(4)} contre ${nom(13)}, En piste 4` })
    .click();
  await saisirScoreTableau(page, 15, 9);
  await carte(page).getByRole('button', { name: 'Valider le score' }).click();
  await expect(arbre(page).getByRole('button', { name: `${nom(1)} contre ${nom(8)}, En piste 4` })).toBeVisible();

  // CA-4 : changer de piste, puis la retirer.
  await arbre(page)
    .getByRole('button', { name: `${nom(1)} contre ${nom(8)}, En piste 4` })
    .click();
  await expect(carte(page)).toContainText(/Piste 4 · appelé à \d+ h \d\d/);
  await expect(pistes.getByRole('button', { name: 'Piste 4 : le match y est appelé' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await pistes.getByRole('button', { name: 'Autre…' }).click();
  await pistes.getByLabel('Autre…').fill('5');
  await pistes.getByRole('button', { name: 'Appeler sur la piste 5' }).click();
  await expect(arbre(page).getByRole('button', { name: `${nom(1)} contre ${nom(8)}, En piste 5` })).toBeVisible();
  await pistes.getByRole('button', { name: 'Retirer' }).click();
  await expect(
    arbre(page).getByRole('button', { name: `${nom(1)} contre ${nom(8)}, À tirer · piste à attribuer` }),
  ).toBeVisible();
});

test('US-112 CA-1 et hors ligne : la plus petite piste libre est proposée, l’appel marche sans réseau', async ({
  page,
  context,
}) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  // Deux poules de 6 (pistes 1 et 2) ; tableau de 16 pour 12 qualifiées.
  const poules = poulesJouees({ nombre: 12 });
  const qualifies = ordreDesQualifiees(poules);
  await importerEpreuve(page, [...poules, { type: 'TableauCree', donnees: { qualifies } }]);
  await ouvrirTableau(page);
  await context.setOffline(true);
  await expect(carte(page).getByRole('button', { name: 'Appeler sur la piste 1' })).toBeVisible();
  await carte(page).getByRole('button', { name: 'Appeler sur la piste 1' }).click();
  await expect(carte(page)).toContainText(/Piste 1 · appelé à \d+ h \d\d/);
  // Le match suivant à appeler se voit proposer la piste 2.
  const suivant = arbre(page)
    .getByRole('button', { name: /À tirer · piste à attribuer$/ })
    .first();
  await suivant.click();
  await expect(carte(page).getByRole('button', { name: 'Appeler sur la piste 2' })).toBeVisible();
  await context.setOffline(false);
});
