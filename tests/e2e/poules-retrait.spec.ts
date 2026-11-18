// Retirer un tireur des poules (US-089) : abandon, forfait ou exclusion par le menu « ⋯ » de sa ligne ; ses matchs
// restants sont perdus, il est classé dernier ; annuler le retrait ; hors ligne.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { epreuveAvecPresentes, ouvrirPoules, repartir } from './poules-outils';

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
  const carte = page.getByRole('region', { name: 'Match 1 sur 15' });
  await carte.getByRole('textbox').nth(0).fill('5');
  await carte.getByRole('textbox').nth(1).fill('3');
  await carte.getByRole('textbox').nth(1).press('Enter');
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
