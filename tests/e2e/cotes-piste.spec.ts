// Côtés de piste réglementaires (US-159, FIE t.22.1) : le premier appelé à droite de l'arbitre, le second à gauche ;
// le bouton « Intervertir les tireurs » les échange (un gaucher appelé en premier) ; chaque match repart aux côtés
// réglementaires ; hors ligne. Saisie des poules sur le PC (le pavé et ses appelants sont communs aux autres saisies).
import { expect, test, type Locator, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { boutonScore, carteSaisie, casesScore, epreuveAvecPresentes, paveScore, repartir } from './poules-outils';

const caseDe = (page: Page, nom: string) =>
  carteSaisie(page).getByRole('button', { name: new RegExp(`^Score de ${nom} : `) });
const x = async (l: Locator) => (await l.boundingBox())!.x;

/** Les noms des deux tireurs du match en cours : le premier appelé (pavé ouvert sur lui), puis le second. */
async function tireursDuMatch(page: Page) {
  const premier = ((await paveScore(page).getAttribute('aria-label')) ?? '').replace(/^Score de /, '');
  const noms = await casesScore(page).evaluateAll((cases) =>
    cases.map((c) => (c.getAttribute('aria-label') ?? '').replace(/^Score de (.*?) : .*$/, '$1')),
  );
  const second = noms.find((n) => n !== premier)!;
  return { premier, second };
}

test('US-159 CA-1 à CA-3 et hors ligne : premier appelé à droite, intervertir, retour au match suivant', async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1360, height: 1200 });
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page);
  await repartir(page, adresse);
  await page.getByRole('button', { name: 'Lancer les poules' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lancer les poules' }).click();
  await expect(carteSaisie(page)).toHaveAccessibleName('Match 1 sur 15');
  await context.setOffline(true);

  // CA-1 : « 1 contre 2 » : le 1 à droite (« à droite »), le 2 à gauche (« à gauche »).
  const { premier, second } = await tireursDuMatch(page);
  expect(await x(caseDe(page, premier))).toBeGreaterThan(await x(caseDe(page, second)));
  await expect(carteSaisie(page).getByText('à droite')).toHaveCount(1);
  await expect(carteSaisie(page).getByText('à gauche')).toHaveCount(1);

  // CA-2 : le bouton échange les côtés, sans perdre le score en cours ; nom accessible, infobulle, 44 px.
  await boutonScore(page, 5).click();
  const echange = carteSaisie(page).getByRole('button', { name: 'Intervertir les tireurs' });
  await expect(echange).toHaveAttribute('title', 'Intervertir les tireurs');
  const boite = (await echange.boundingBox())!;
  expect(boite.width).toBeGreaterThanOrEqual(44);
  expect(boite.height).toBeGreaterThanOrEqual(44);
  expect(boite.x).toBeGreaterThan(await x(caseDe(page, second)));
  expect(boite.x).toBeLessThan(await x(caseDe(page, premier)));
  await echange.click();
  expect(await x(caseDe(page, premier))).toBeLessThan(await x(caseDe(page, second)));
  await expect(caseDe(page, premier)).toHaveText('V');
  await page.screenshot({ path: 'test-results/cotes-piste.png' });
  // Le score enregistré reste au bon tireur : V5 pour le premier appelé, 3 pour le second.
  await boutonScore(page, 3).click();
  await expect(carteSaisie(page)).toHaveAccessibleName('Match 2 sur 15');
  await expect(page.getByRole('button', { name: new RegExp(`^${premier} contre ${second} : `) })).toHaveText('V5');
  await expect(page.getByRole('button', { name: new RegExp(`^${second} contre ${premier} : `) })).toHaveText('3');

  // CA-3 : le match suivant repart aux côtés réglementaires.
  const suivant = await tireursDuMatch(page);
  expect(await x(caseDe(page, suivant.premier))).toBeGreaterThan(await x(caseDe(page, suivant.second)));
  await context.setOffline(false);
});
