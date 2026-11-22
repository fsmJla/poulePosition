// US-146 et US-147 (planches 40 et 40 bis) : constituer les équipes d'une épreuve par équipes de 3 à partir des tireuses
// inscrites, les ranger par la somme des classements, corriger le rang à la main, supprimer une équipe.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { epreuveAvecPresentes, TIREUSES } from './poules-outils';

/** Crée une équipe par la fenêtre « Nouvelle équipe » : 3 titulaires et, au besoin, une remplaçante. */
export async function creerEquipe(page: Page, nom: string, titulaires: string[], remplacante?: string) {
  await page.getByRole('button', { name: 'Nouvelle équipe' }).click();
  const fenetre = page.getByRole('dialog', { name: 'Nouvelle équipe' });
  for (const tireuse of titulaires) {
    await fenetre
      .getByRole('group', { name: `Rôle de ${tireuse}` })
      .getByRole('button', { name: 'Titulaire' })
      .click();
  }
  if (remplacante) {
    await fenetre
      .getByRole('group', { name: `Rôle de ${remplacante}` })
      .getByRole('button', { name: 'Remplaçant' })
      .click();
  }
  await fenetre.getByLabel('Nom de l’équipe').fill(nom);
  await fenetre.getByRole('button', { name: 'Créer l’équipe' }).click();
  await expect(fenetre).toBeHidden();
}

const nomComplet = (i: number) => `${TIREUSES[i]![0]} ${TIREUSES[i]![1]}`;

test('US-146 CA-1 à CA-5 et US-147 CA-1 à CA-4 : constituer, ranger, corriger et supprimer des équipes', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'pc', 'Équipes : projet « pc » seulement');
  test.setTimeout(120_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 8, 0, 'equipes3');
  await page.goto(`${adresse}/inscriptions`);

  // CA-1 : deux onglets.
  await page.getByRole('tab', { name: /^Équipes/ }).click();
  await expect(page.getByText('Aucune équipe : créez-en une à partir des tireurs inscrits.')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '8 tireurs sans équipe' })).toBeVisible();

  // CA-2 : le nom est proposé d'après le club de la première titulaire.
  await page.getByRole('button', { name: 'Nouvelle équipe' }).click();
  const fenetre = page.getByRole('dialog', { name: 'Nouvelle équipe' });
  await fenetre
    .getByRole('group', { name: `Rôle de ${nomComplet(1)}` })
    .getByRole('button', { name: 'Titulaire' })
    .click();
  await expect(fenetre.getByLabel('Nom de l’équipe')).toHaveValue('Pessac (SPUC) 1');
  await fenetre.getByRole('button', { name: 'Annuler' }).click();

  // Classements 1 à 8 : « Fortes » (1, 2, 3 → Σ 6) et « Moyennes » (4, 5, 6 → Σ 15), remplaçante 7.
  await creerEquipe(page, 'Moyennes', [nomComplet(3), nomComplet(4), nomComplet(5)], nomComplet(6));
  await creerEquipe(page, 'Fortes', [nomComplet(0), nomComplet(1), nomComplet(2)]);
  const liste = page.getByRole('region', { name: /^Équipes · rangées/ });
  const equipes = liste.getByRole('listitem');
  await expect(equipes).toHaveCount(2);
  // US-147 CA-1 : rangées par la somme des classements.
  await expect(equipes.nth(0)).toContainText('Fortes');
  await expect(equipes.nth(0)).toContainText('Σ 6');
  await expect(equipes.nth(1)).toContainText('Moyennes');
  await expect(equipes.nth(1)).toContainText('Remplaçant');
  await expect(equipes.nth(0)).toContainText('Mixte');
  // CA-5 : la dernière tireuse sans équipe est signalée.
  await expect(page.getByRole('status').filter({ hasText: /1 tireur sans équipe ne tirera pas/ })).toBeVisible();
  // Nom déjà pris.
  await page.getByRole('button', { name: 'Modifier l’équipe Moyennes' }).click();
  const modification = page.getByRole('dialog', { name: 'Modifier l’équipe Moyennes' });
  await modification.getByLabel('Nom de l’équipe').fill('fortes');
  await modification.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(modification.getByRole('alert')).toHaveText('Une autre équipe porte déjà ce nom');
  await modification.getByRole('button', { name: 'Annuler' }).click();

  // US-147 CA-3 : descendre « Fortes » ; « rang modifié » ; puis revenir au rang calculé.
  await page.getByRole('button', { name: 'Descendre Fortes' }).click();
  await expect(equipes.nth(0)).toContainText('Moyennes');
  await expect(equipes.nth(1)).toContainText('rang modifié');
  await page.getByRole('button', { name: 'Revenir au rang calculé' }).click();
  await page.getByRole('menuitem', { name: 'Revenir au rang calculé' }).click();
  await expect(equipes.nth(0)).toContainText('Fortes');

  // CA-3 : supprimer une équipe ; ses tireuses redeviennent sans équipe.
  await page.getByRole('button', { name: 'Autres actions pour Moyennes' }).click();
  await page.getByRole('menuitem', { name: /Supprimer l’équipe/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
  await expect(equipes).toHaveCount(1);
  await expect(page.getByRole('status').filter({ hasText: '5 tireurs sans équipe' })).toBeVisible();

  // Une tireuse d'une équipe ne se désinscrit pas.
  await page.getByRole('tab', { name: /^Tireurs/ }).click();
  await page.getByRole('button', { name: `Autres actions pour ${TIREUSES[0]![1]} ${TIREUSES[0]![0]}` }).click();
  await page.getByRole('menuitem', { name: /Retirer/ }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Retirer/ })
    .click();
  await expect(page.getByRole('dialog').getByText('Retirez d’abord ce tireur de son équipe')).toBeVisible();
});

/** Une épreuve par équipes de 3 : 8 tireuses absentes, « Fortes » (1 à 3) et « Moyennes » (4 à 6, remplaçante 7). */
export async function deuxEquipes(page: Page) {
  const adresse = await epreuveAvecPresentes(page, 8, 0, 'equipes3');
  await page.goto(`${adresse}/inscriptions`);
  await page.getByRole('tab', { name: /^Équipes/ }).click();
  await creerEquipe(page, 'Fortes', [nomComplet(0), nomComplet(1), nomComplet(2)]);
  await creerEquipe(page, 'Moyennes', [nomComplet(3), nomComplet(4), nomComplet(5)], nomComplet(6));
  return adresse;
}

test('US-148 CA-1 à CA-4 : émarger par équipes, complète avec remplaçant, incomplète annoncée avant le tableau', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'pc', 'Équipes : projet « pc » seulement');
  test.setTimeout(120_000);
  await seConnecter(page);
  const adresse = await deuxEquipes(page);
  await page.goto(`${adresse}/emargement`);
  await expect(page.getByRole('status').filter({ hasText: '0 équipe complète sur 2' })).toBeVisible({
    timeout: 20_000,
  });
  const pointer = async (i: number) => {
    const ligne = page.getByRole('checkbox', { name: `Présent : ${nomComplet(i)}` });
    await ligne.click();
    await expect(ligne).toHaveAttribute('aria-checked', String(true));
  };
  for (const i of [0, 1, 2, 3, 4, 6]) await pointer(i);
  // CA-2 et CA-3 : complètes, l'une grâce à sa remplaçante.
  await expect(page.getByRole('region', { name: 'Fortes' })).toContainText('Complète');
  await expect(page.getByRole('region', { name: 'Moyennes' })).toContainText('Complète · avec remplaçant');
  await expect(page.getByRole('status').filter({ hasText: '2 équipes complètes sur 2' })).toBeVisible();
  // Une titulaire remise absente : incomplète.
  await page.getByRole('checkbox', { name: `Présent : ${nomComplet(4)}` }).click();
  await expect(page.getByRole('region', { name: 'Moyennes' })).toContainText('Incomplète · 2 présents sur 3');
  await page.getByRole('button', { name: /^Incomplètes/ }).click();
  await expect(page.getByRole('region', { name: 'Fortes' })).toHaveCount(0);
  // CA-4 : en tableau direct, l'action principale crée le tableau ; l'équipe incomplète est annoncée.
  await page.getByRole('button', { name: 'Créer le tableau' }).click();
  const confirmation = page.getByRole('dialog');
  await expect(confirmation).toContainText('1 équipe incomplète ne tirera pas : Moyennes');
  await confirmation.getByRole('button', { name: 'Continuer' }).click();
  await expect(page).toHaveURL(/\/tableau$/);
});

/** Saisit un score de rencontre au pavé des relais : dizaines puis unités, pour chaque équipe. */
async function saisirRencontre(page: Page, gauche: number, droite: number) {
  for (const score of [gauche, droite]) {
    const dizaine = Math.floor(score / 10) * 10;
    await page
      .getByRole('group', { name: /^Dizaines du score de/ })
      .getByRole('button', { name: new RegExp(`^${dizaine} pour`) })
      .click();
    await page
      .getByRole('group', { name: /^Unités du score de/ })
      .getByRole('button', { name: new RegExp(`^${score - dizaine} pour`) })
      .click();
  }
}

test('US-151 CA-1 à CA-4 : tableau direct des équipes, rencontres en 45 touches, classement final avec les tireuses', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'pc', 'Équipes : projet « pc » seulement');
  test.setTimeout(150_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 9, 9, 'equipes3');
  await page.goto(`${adresse}/inscriptions`);
  await page.getByRole('tab', { name: /^Équipes/ }).click();
  await creerEquipe(page, 'Fortes', [nomComplet(0), nomComplet(1), nomComplet(2)]);
  await creerEquipe(page, 'Moyennes', [nomComplet(3), nomComplet(4), nomComplet(5)]);
  await creerEquipe(page, 'Faibles', [nomComplet(6), nomComplet(7), nomComplet(8)]);

  // CA-1 : sans poules, le tableau se crée d'après le rang des équipes ; pas d'étape « Poules ».
  await page.goto(`${adresse}/tableau`);
  await expect(page.getByRole('navigation', { name: /Étapes/ }).getByText('Poules')).toHaveCount(0);
  await page.getByRole('button', { name: 'Créer le tableau' }).click();
  await page.getByRole('dialog').getByRole('button', { name: /Créer/ }).click();
  // CA-2 : la demi-finale Moyennes – Faibles, en 45 touches (Fortes exempte).
  await saisirRencontre(page, 45, 38);
  await expect(page.getByRole('status').filter({ hasText: /45/ }).first()).toBeVisible({ timeout: 10_000 });
  // La finale Fortes – Moyennes.
  await saisirRencontre(page, 45, 41);
  // CA-3 et CA-4 : terminer ; le classement final donne les équipes et leurs tireuses.
  await page.getByRole('button', { name: /^Classement final/ }).click();
  await page.getByRole('button', { name: 'Terminer l’épreuve' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Terminer/ })
    .click();
  const classement = page.getByRole('table');
  await expect(classement.getByRole('row').nth(1)).toContainText('FORTES');
  await expect(classement.getByRole('row').nth(1)).toContainText(`${TIREUSES[0]![0]} ${TIREUSES[0]![1]}`);
  await expect(classement.getByRole('row').nth(2)).toContainText('MOYENNES');
});
