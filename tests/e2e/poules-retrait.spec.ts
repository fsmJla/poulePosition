// Retirer un tireur des poules (US-089) : abandon, forfait ou exclusion par le menu « ⋯ » de sa ligne ; ses matchs
// restants sont perdus, il est classé dernier ; annuler le retrait ; hors ligne.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { cartePoule, epreuveAvecPresentes, ouvrirPoules, repartir, saisirBoutons } from './poules-outils';

async function lancer(page: Page, adresse: string) {
  await repartir(page, adresse);
  await page.getByRole('button', { name: 'Lancer les poules' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lancer les poules' }).click();
  await expect(page.getByRole('heading', { level: 3, name: /^Feuille de la poule 1/ })).toBeVisible();
}

const case_ = (page: Page, nom: string, adversaire: string) =>
  page.getByRole('button', { name: new RegExp(`^${nom} contre ${adversaire} : `) });
const ligne = (page: Page, nom: string) => page.locator('tbody tr').filter({ hasText: nom });

async function retirer(page: Page, nom: string, motif: 'Abandon' | 'Forfait' | 'Exclusion') {
  await page.getByRole('button', { name: `Autres actions pour ${nom}` }).click();
  await page.getByRole('menuitem', { name: new RegExp(`^${motif}…`) }).click();
  await expect(page.getByRole('dialog')).toContainText('classé dernier de sa poule');
  await page.getByRole('dialog').getByRole('button', { name: 'Retirer', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test('US-089 CA-1 à CA-4 : retirer une tireuse (abandon), ses matchs, son rang, puis annuler', async ({ page }) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 6);
  await lancer(page, adresse);
  // Match 1 : MARTIN 5 – 3 DUBOIS.
  await saisirBoutons(page, 5, 3);
  await expect(case_(page, 'MARTIN Léa', 'DUBOIS Chloé')).toHaveText('V5');

  // CA-1 : « ⋯ › Abandon… » sur sa ligne, puis la confirmation ; la ligne porte le motif.
  await retirer(page, 'DUBOIS Chloé', 'Abandon');
  await expect(ligne(page, 'DUBOIS Chloé')).toContainText('Abandon');

  // CA-2 : le match tiré garde son score ; les autres sont perdus 0 à 5, « forfait », sans saisie.
  await expect(case_(page, 'MARTIN Léa', 'DUBOIS Chloé')).toHaveText('V5');
  await expect(case_(page, 'DUBOIS Chloé', 'BERNARD Inès')).toHaveAccessibleName(/forfait$/);
  await expect(case_(page, 'DUBOIS Chloé', 'BERNARD Inès')).toBeDisabled();
  await expect(case_(page, 'BERNARD Inès', 'DUBOIS Chloé')).toHaveText('V5');
  await expect(page.getByRole('region', { name: 'Ordre des matchs' })).toContainText('forfait');
  await expect(page.getByText(/^5 matchs sur 15/)).toBeVisible();

  // CA-3 : classée dernière de sa poule.
  await expect(ligne(page, 'DUBOIS Chloé').locator('td').last()).toHaveText('6');

  // CA-4 : annuler le retrait rend ses matchs à tirer.
  await page.getByRole('button', { name: 'Autres actions pour DUBOIS Chloé' }).click();
  await page.getByRole('menuitem', { name: 'Annuler le retrait' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Annuler le retrait', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(ligne(page, 'DUBOIS Chloé')).not.toContainText('Abandon');
  await expect(case_(page, 'DUBOIS Chloé', 'BERNARD Inès')).toBeEnabled();
  await expect(page.getByText(/^1 match sur 15/)).toBeVisible();
});

test('US-089 cas limite : deux tireuses retirées, leur match commun perdu pour les deux', async ({ page }) => {
  test.setTimeout(120_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 6);
  await lancer(page, adresse);
  await retirer(page, 'THOMAS Jade', 'Forfait');
  await retirer(page, 'ROBERT Manon', 'Exclusion');
  await expect(case_(page, 'THOMAS Jade', 'ROBERT Manon')).toHaveText('0');
  await expect(case_(page, 'ROBERT Manon', 'THOMAS Jade')).toHaveText('0');
  await expect(ligne(page, 'THOMAS Jade').locator('td').last()).toHaveText('5');
  await expect(ligne(page, 'ROBERT Manon').locator('td').last()).toHaveText('6');
});

test('US-089 hors ligne : le retrait s’écrit sans réseau', async ({ page, context }) => {
  test.setTimeout(120_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 6);
  await lancer(page, adresse);
  await context.setOffline(true);
  await retirer(page, 'MARTIN Léa', 'Abandon');
  await expect(ligne(page, 'MARTIN Léa')).toContainText('Abandon');
  await context.setOffline(false);
  await ouvrirPoules(page, adresse);
  await expect(ligne(page, 'MARTIN Léa')).toContainText('Abandon');
});

/** US-093 : chaque entrée du menu ouvert est visible en son milieu (rien ne la coupe ni ne la recouvre). */
async function entreesVisibles(page: Page) {
  return page.getByRole('menu').evaluate((menu) =>
    [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')].map((entree) => {
      const { left, top, width, height } = entree.getBoundingClientRect();
      const points = [left + 8, left + width / 2, left + width - 8].map((x) =>
        document.elementFromPoint(x, top + height / 2),
      );
      return points.every((point) => point !== null && entree.contains(point));
    }),
  );
}

test('US-093 CA-1 et CA-3 : les menus « ⋯ » de la feuille et des cartes de poule sont entiers', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1360, height: 1000 });
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 12);
  // CA-3 : le dernier tireur d'une carte de poule (US-087), deux poules : une vraie entrée « Déplacer vers ».
  await repartir(page, adresse);
  await cartePoule(page, 1)
    .getByRole('button', { name: /^Autres actions pour / })
    .last()
    .click();
  await expect(page.getByRole('menuitem', { name: 'Déplacer vers la poule 2' })).toBeVisible();
  expect(await entreesVisibles(page)).toEqual([true]);
  await page.keyboard.press('Escape');
  // CA-1 : la ligne d'un tireur de la feuille de poule (US-089), première colonne.
  await page.getByRole('button', { name: 'Lancer les poules' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lancer les poules' }).click();
  await page.getByRole('tab', { name: /Poule 1/ }).click();
  await page.getByRole('button', { name: 'Autres actions pour MARTIN Léa' }).click();
  await expect(page.getByRole('menuitem')).toHaveCount(3);
  expect(await entreesVisibles(page)).toEqual([true, true, true]);
});
