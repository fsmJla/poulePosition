// Match pour la 3e place (US-114, planche 11) : sous-titre, pilule « 3e place » et match sous la finale, saisie, activé
// après la finale, refus de le retirer une fois tiré.
import { expect, test, type Page } from '@playwright/test';
import type { Proposition } from '@poule-position/domaine';
import { seConnecter } from './compte';
import {
  importerEpreuve,
  nomDe,
  ordreDesQualifiees,
  ouvrirTableau,
  poulesJouees,
  saisirScoreTableau,
} from './tableau-outils';

const carte = (page: Page) => page.getByRole('region', { name: 'Saisie du match' });
const pilules = (page: Page) => page.getByRole('group', { name: 'Tours du tableau' }).getByRole('button');
const arbre = (page: Page) => page.getByRole('region', { name: /^Du |^Des |^Finale$|^Demi-finales$/ });

/** 6 qualifiées (quarts de finale, rangs 1 et 2 exempts), quarts et demies tirés : le meilleur rang gagne. */
function jusquAuxDemies(troisieme: boolean): { propositions: Proposition[]; nom: (rang: number) => string } {
  const poules = poulesJouees({ nombre: 6 });
  const q = ordreDesQualifiees(poules);
  const score = (match: string, a: number, b: number): Proposition => ({
    type: 'ScoreTableauSaisi',
    donnees: { match, tireurA: q[a - 1]!, tireurB: q[b - 1]!, touchesA: 15, touchesB: 9 },
  });
  return {
    propositions: [
      ...poules,
      ...(troisieme ? [{ type: 'FormuleModifiee', donnees: { matchTroisieme: true } } as Proposition] : []),
      { type: 'TableauCree', donnees: { qualifies: q } },
      score('8-2', 4, 5),
      score('8-3', 3, 6),
      score('4-1', 1, 4),
      score('4-2', 2, 3),
    ],
    nom: (rang) => nomDe(q[rang - 1]!),
  };
}

test('US-114 CA-1 à CA-3 : le match pour la 3e place, sous la finale, se saisit comme les autres', async ({ page }) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  const { propositions, nom } = jusquAuxDemies(true);
  await importerEpreuve(page, propositions);
  await ouvrirTableau(page);
  await expect(page.getByText('Quarts de finale · 6 qualifiés, 2 exempts · match pour la 3e place')).toBeVisible();
  await expect(pilules(page).filter({ hasText: /^3e place/ })).toHaveText('3e place0/1');
  await expect(
    arbre(page).getByRole('button', { name: `${nom(3)} contre ${nom(4)}, À tirer · piste à attribuer` }),
  ).toBeVisible();
  await pilules(page)
    .filter({ hasText: /^3e place/ })
    .click();
  await expect(carte(page).getByRole('heading', { name: 'Match pour la 3e place' })).toBeVisible();
  await saisirScoreTableau(page, 15, 12);
  await carte(page).getByRole('button', { name: 'Valider le score' }).click();
  await expect(pilules(page).filter({ hasText: /^3e place/ })).toHaveText('3e placeterminé');
  await expect(arbre(page).getByRole('button', { name: `${nom(3)} contre ${nom(4)}, Terminé` })).toBeVisible();
});

test('US-114 CA-4 et CA-5 : activé après la finale, il apparaît ; tiré, il ne se retire plus', async ({ page }) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  const { propositions, nom } = jusquAuxDemies(false);
  const adresse = await importerEpreuve(page, propositions);
  await ouvrirTableau(page);
  await expect(
    page.getByText('Quarts de finale · 6 qualifiés, 2 exempts · pas de match pour la 3e place'),
  ).toBeVisible();
  await expect(pilules(page)).toHaveCount(4);
  await expect(pilules(page).filter({ hasText: /^3e place/ })).toHaveCount(0);

  // CA-4 : activé tard, depuis la page « Formule ».
  await page.goto(`${adresse}/formule`);
  await page.getByLabel('Match pour la 3e place').check();
  await page.getByRole('button', { name: 'Enregistrer la formule' }).click();
  await expect(
    page.getByText('Poules en 5 touches, sans élimination · Tableau en 15 touches · Match pour la 3e place'),
  ).toBeVisible();
  await page.goto(`${adresse}/tableau`);
  await expect(pilules(page).filter({ hasText: /^3e place/ })).toHaveText('3e place0/1', { timeout: 20_000 });

  // Il se tire…
  await pilules(page)
    .filter({ hasText: /^3e place/ })
    .click();
  await saisirScoreTableau(page, 15, 3);
  await carte(page).getByRole('button', { name: 'Valider le score' }).click();
  await expect(arbre(page).getByRole('button', { name: `${nom(3)} contre ${nom(4)}, Terminé` })).toBeVisible();

  // CA-5 : … puis ne se retire plus.
  await page.goto(`${adresse}/formule`);
  await page.getByLabel('Match pour la 3e place').uncheck();
  await page.getByRole('button', { name: 'Enregistrer la formule' }).click();
  await expect(page.getByText('Le match pour la 3e place est déjà tiré')).toBeVisible();
});
