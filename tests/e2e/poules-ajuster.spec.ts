// Vérifier, ajuster et lancer les poules (US-087, planche 9) : cartes, glisser-déposer, « ⋯ › Déplacer vers… »,
// pistes, alertes, lancement, hors ligne.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { cartePoule, epreuveAvecPresentes, ouvrirPoules, repartir, TIREUSES } from './poules-outils';

/** Choisit une action du menu « ⋯ » d'une tireuse. */
async function menu(page: Page, nom: string, action: string) {
  await page.getByRole('button', { name: `Autres actions pour ${nom}` }).click();
  await page.getByRole('menuitem', { name: action }).click();
}

/** 12 présentes, deux poules vides (répartition manuelle, US-086 CA-5). */
async function poulesVides(page: Page) {
  const adresse = await epreuveAvecPresentes(page, 12);
  await ouvrirPoules(page, adresse);
  await page.getByRole('radio', { name: /^Manuelle/ }).check();
  await page.getByRole('button', { name: 'Créer les poules vides' }).click();
  await expect(page.getByRole('region', { name: 'À placer · 12 tireurs' })).toBeVisible();
  return adresse;
}

test('US-087 CA-1, CA-4 et CA-7 : les cartes des poules, leurs alertes (planche 9)', async ({ page }) => {
  test.setTimeout(150_000);
  await page.setViewportSize({ width: 1360, height: 1300 });
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page);
  await repartir(page, adresse);
  await expect(page.getByText('À vérifier', { exact: true })).toBeVisible();
  await expect(page.getByText('4 poules de 6 · pistes 1 à 4 · répartition automatique')).toBeVisible();
  await expect(cartePoule(page, 1)).toContainText(/6 tireurs · moyenne des rangs \d+,\d/);
  await expect(cartePoule(page, 1).getByLabel('Piste de la poule 1')).toHaveValue('1');
  // CA-4 : Pessac (SPUC) a 5 tireuses pour 4 poules ; l'entête résume.
  await expect(page.getByText('2 tireurs de Pessac (SPUC) dans cette poule')).toHaveCount(1);
  await expect(page.getByText('1 alerte à vérifier')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lancer les poules' })).toBeEnabled();
  await page.screenshot({ path: 'test-results/poules-ajuster.png', fullPage: true });
});

test('US-087 CA-2 à CA-4 et CA-6 : placer, glisser, déplacer, changer la piste, puis lancer', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1360, height: 1300 });
  await seConnecter(page);
  const adresse = await poulesVides(page);
  // CA-6 : tant que des tireuses sont à placer, le lancement est impossible, avec la raison.
  await expect(page.getByRole('button', { name: 'Lancer les poules' })).toBeDisabled();
  await expect(page.getByText('12 tireurs à placer', { exact: true })).toBeVisible();

  // CA-2 : glisser par la poignée.
  await page.getByRole('button', { name: 'Glisser MARTIN Léa vers une autre poule' }).dragTo(cartePoule(page, 1));
  await expect(cartePoule(page, 1)).toContainText('MARTIN Léa');
  await expect(page.getByRole('region', { name: 'À placer · 11 tireurs' })).toBeVisible();

  // CA-3 : au clavier, « ⋯ › Placer dans / Déplacer vers… ».
  for (const [i, [nom, prenom]] of TIREUSES.slice(1, 12).entries()) {
    await menu(page, `${nom} ${prenom}`, `Placer dans la poule ${(i % 2) + 1}`);
  }
  await expect(page.getByRole('region', { name: /^À placer/ })).toHaveCount(0);
  await menu(page, 'DUBOIS Chloé', 'Déplacer vers la poule 2');
  await expect(cartePoule(page, 2)).toContainText('DUBOIS Chloé');

  // CA-4 : MARTIN et DURAND (Talence) dans la poule 1 ; une piste en double est signalée.
  await expect(cartePoule(page, 1)).toContainText('2 tireurs de Talence dans cette poule');
  await cartePoule(page, 2).getByLabel('Piste de la poule 2').selectOption('1');
  await expect(page.getByText('Piste 1 utilisée par plusieurs poules')).toHaveCount(2);
  await cartePoule(page, 2).getByLabel('Piste de la poule 2').selectOption('2');
  await expect(page.getByText('Piste 1 utilisée par plusieurs poules')).toHaveCount(0);

  // CA-6 : lancer après confirmation ; la répartition est figée, l'épreuve passe « En cours ».
  await page.getByRole('button', { name: 'Lancer les poules' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lancer les poules' }).click();
  // Depuis US-088, le lancement ouvre la saisie des scores.
  await expect(page.getByRole('heading', { level: 3, name: /^Feuille de la poule 1/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Glisser/ })).toHaveCount(0);
  await expect(page.getByText('En cours').first()).toBeVisible();
  // Les inscriptions se ferment (US-081 CA-7).
  await page.goto(`${adresse}/inscriptions`);
  await expect(page.getByText('Les inscriptions sont closes : les poules sont lancées')).toBeVisible({
    timeout: 20_000,
  });
});

test('US-087 CA-5 : répartir à nouveau avertit que les ajustements seront perdus', async ({ page }) => {
  test.setTimeout(120_000);
  await seConnecter(page);
  await poulesVides(page);
  await page.getByRole('button', { name: 'Répartir à nouveau' }).click();
  await expect(page.getByText('La composition actuelle sera remplacée, avec vos ajustements.')).toBeVisible();
  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByRole('region', { name: 'À placer · 12 tireurs' })).toBeVisible();
});

test('US-087 hors ligne : déplacer puis lancer sans réseau', async ({ page, context }) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 6);
  await repartir(page, adresse);
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Lancer les poules' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lancer les poules' }).click();
  // Depuis US-088, le lancement ouvre la saisie des scores.
  await expect(page.getByRole('heading', { level: 3, name: /^Feuille de la poule 1/ })).toBeVisible();
  await context.setOffline(false);
  await ouvrirPoules(page, adresse);
  // Depuis US-088, le lancement ouvre la saisie des scores.
  await expect(page.getByRole('heading', { level: 3, name: /^Feuille de la poule 1/ })).toBeVisible();
});
