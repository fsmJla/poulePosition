// US-134 : l'écran géant ouvert par son lien suit l'épreuve pilotée par un PC (planches 31 à 35) ; US-133 CA-4 : un lien
// régénéré n'est plus valable. Le PC pilote et l'écran sont deux onglets du même navigateur, l'écran sans session.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { epreuveAvecPresentes, repartir, saisirBoutons } from './poules-outils';

async function lancer(page: Page, adresse: string) {
  await repartir(page, adresse);
  await page.getByRole('button', { name: 'Lancer les poules' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lancer les poules' }).click();
  await expect(page.getByRole('heading', { level: 3, name: /^Feuille de la poule 1/ })).toBeVisible();
}

/** Crée l'écran de la compétition seule de l'épreuve, avec cette épreuve cochée ; renvoie son lien. */
async function creerEcran(page: Page, adresse: string, nomEpreuve: RegExp) {
  await page.goto(adresse);
  await page
    .getByRole('button', { name: /^Autres actions pour / })
    .first()
    .click();
  await page.getByRole('menuitem', { name: /Écrans géants/ }).click();
  await expect(page).toHaveURL(/\/competitions\/[^/]+\/ecrans$/, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Ajouter un écran' }).click();
  const fenetre = page.getByRole('dialog', { name: 'Nouvel écran' });
  await fenetre.getByRole('checkbox', { name: nomEpreuve }).check();
  await fenetre.getByLabel('Durée d’une page').fill('5');
  await fenetre.getByRole('button', { name: 'Enregistrer' }).click();
  const lien = (await page.getByRole('article', { name: 'Écran de la salle' }).locator('code').textContent()) ?? '';
  return { lien, pageEcrans: new URL(page.url()).pathname };
}

test('US-134 CA-1 à CA-3 et CA-5 : l’écran s’ouvre par son lien, suit l’appel et les scores, puis son lien est régénéré', async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name !== 'pc', 'Écran géant : projet « pc » seulement');
  test.setTimeout(180_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 6);
  const nom = (await page.getByRole('heading', { level: 1 }).textContent())?.trim() ?? '';
  const { lien, pageEcrans } = await creerEcran(page, adresse, new RegExp(nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  expect(lien).toMatch(/\/ecran\/[^#]+#[A-Za-z0-9_-]{22}$/);

  // CA-1 : sans compte, en plein écran possible, sans entête de l'application.
  const ecran = await context.newPage();
  await ecran.setViewportSize({ width: 1920, height: 1080 });
  await ecran.goto(new URL(lien).pathname + new URL(lien).hash);
  await expect(ecran.getByRole('button', { name: 'Plein écran' })).toBeVisible({ timeout: 20_000 });
  await expect(ecran.getByRole('banner').getByText(/Poule Position/)).toHaveCount(0);
  // US-160 : avant le lancement des poules, le mode Accueil et son compte à rebours.
  await expect(ecran.getByRole('timer')).toBeVisible({ timeout: 20_000 });

  // CA-2 : poules lancées, l'appel des matchs de chaque piste, puis les poules.
  await lancer(page, adresse);
  await expect(ecran.getByText('Appel des matchs').first()).toBeVisible({ timeout: 20_000 });
  await expect(ecran.getByRole('region', { name: 'Piste 1' })).toContainText('En piste');
  await expect(ecran.getByText(/Mis à jour à \d\d:\d\d/)).toBeVisible({ timeout: 15_000 });

  // CA-3 : un score saisi au PC apparaît sur l'écran (page des poules) en moins de quelques secondes.
  await saisirBoutons(page, 5, 3);
  await expect(ecran.getByRole('region', { name: 'Poule 1' })).toBeVisible({ timeout: 15_000 });
  await expect(
    ecran.getByRole('region', { name: 'Poule 1' }).getByRole('cell', { name: 'V', exact: true }).first(),
  ).toBeVisible({
    timeout: 15_000,
  });
  await expect(ecran.getByText(/Mis à jour à \d\d:\d\d/)).toBeVisible();
  await info.attach('ecran-geant', { body: await ecran.screenshot(), contentType: 'image/png' });

  // US-133 CA-4 et US-134 CA-5 : le lien régénéré, l'écran le dit.
  await page.goto(pageEcrans);
  await page.getByRole('button', { name: 'Autres actions pour Écran de la salle' }).click({ timeout: 20_000 });
  await page.getByRole('menuitem', { name: /Régénérer le lien/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Régénérer' }).click();
  await expect(
    ecran.getByText('Ce lien d’écran n’est plus valable : demandez le nouveau à l’organisateur.'),
  ).toBeVisible({
    timeout: 20_000,
  });
});

test('US-134 CA-5 : un lien inconnu ou faux affiche qu’il n’est plus valable', async ({ page }, info) => {
  test.skip(info.project.name !== 'pc', 'Écran géant : projet « pc » seulement');
  await page.goto(`/ecran/${crypto.randomUUID()}#abcdefghijklmnopqrstuv`);
  await expect(
    page.getByText('Ce lien d’écran n’est plus valable : demandez le nouveau à l’organisateur.'),
  ).toBeVisible({
    timeout: 20_000,
  });
});

test('US-135 et US-136 : imposer une vue ; la fenêtre locale de ce PC suit les scores sans réseau', async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name !== 'pc', 'Écran géant : projet « pc » seulement');
  test.setTimeout(180_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 6);
  const nom = (await page.getByRole('heading', { level: 1 }).textContent())?.trim() ?? '';
  const { pageEcrans } = await creerEcran(page, adresse, new RegExp(nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  await lancer(page, adresse);

  // US-136 CA-1 : « Ouvrir sur ce PC » ouvre une seconde fenêtre avec l'écran.
  await page.goto(pageEcrans);
  await page.getByRole('button', { name: 'Autres actions pour Écran de la salle' }).click({ timeout: 20_000 });
  const ouverture = page.waitForEvent('popup');
  await page.getByRole('menuitem', { name: /Ouvrir sur ce PC/ }).click();
  const fenetre = await ouverture;
  await expect(fenetre).toHaveURL(/\/ecran\/[^?]+\?local#/);
  await expect(fenetre.getByText('Appel des matchs').first()).toBeVisible({ timeout: 30_000 });

  // US-135 CA-1 et CA-3 : imposer la page des poules ; l'écran s'y arrête, la carte l'annonce.
  await expect(page.getByRole('article', { name: 'Écran de la salle' })).toContainText('Connecté', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Afficher sur l’écran' }).click();
  const choix = page.getByRole('form', { name: 'Afficher sur Écran de la salle' });
  await choix.getByRole('radio', { name: 'Poules' }).check();
  await choix.getByRole('button', { name: 'Afficher' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Vue imposée : poules' })).toBeVisible({ timeout: 20_000 });
  await expect(fenetre.getByRole('region', { name: 'Poule 1' })).toBeVisible({ timeout: 20_000 });
  // Une seule page : la vue imposée ne défile pas.
  await expect(fenetre.getByRole('region', { name: 'Poule 2' })).toHaveCount(0);

  // US-136 CA-2 : sans réseau, un score saisi sur ce PC arrive dans la fenêtre locale.
  await context.setOffline(true);
  await page.goto(`${adresse}/poules`);
  await saisirBoutons(page, 5, 3);
  await expect(
    fenetre.getByRole('region', { name: 'Poule 1' }).getByRole('cell', { name: 'V', exact: true }).first(),
  ).toBeVisible({
    timeout: 20_000,
  });
  await context.setOffline(false);

  // US-135 CA-2 : reprendre le défilement.
  await page.goto(pageEcrans);
  await page.getByRole('button', { name: 'Reprendre le défilement' }).click({ timeout: 20_000 });
  await expect(page.getByRole('status').filter({ hasText: 'Vue imposée' })).toHaveCount(0, { timeout: 20_000 });
});

test('US-140 à US-142 : thème clair puis sombre sans rechargement, bandeau des derniers scores, colonnes des poules', async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name !== 'pc', 'Écran géant : projet « pc » seulement');
  test.setTimeout(180_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 6);
  const nom = (await page.getByRole('heading', { level: 1 }).textContent())?.trim() ?? '';

  // US-140 CA-1 et US-141 CA-1 : style « Clair » et bandeau sur 10 minutes, réglés à la création.
  await page.goto(adresse);
  await page
    .getByRole('button', { name: /^Autres actions pour / })
    .first()
    .click();
  await page.getByRole('menuitem', { name: /Écrans géants/ }).click();
  await page.getByRole('button', { name: 'Ajouter un écran' }).click({ timeout: 20_000 });
  const fenetre = page.getByRole('dialog', { name: 'Nouvel écran' });
  await fenetre.getByRole('checkbox', { name: new RegExp(nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).check();
  await fenetre.getByRole('radio', { name: 'Clair' }).check();
  await fenetre.getByRole('checkbox', { name: 'Bandeau des derniers scores' }).check();
  await fenetre.getByLabel('Scores des dernières').fill('10');
  await fenetre.getByRole('button', { name: 'Enregistrer' }).click();
  const lien = (await page.getByRole('article', { name: 'Écran de la salle' }).locator('code').textContent()) ?? '';
  const pageEcrans = new URL(page.url()).pathname;

  const ecran = await context.newPage();
  await ecran.setViewportSize({ width: 1920, height: 1080 });
  await ecran.goto(new URL(lien).pathname + new URL(lien).hash);
  await expect(ecran.locator('html')).toHaveAttribute('data-theme', 'clair', { timeout: 20_000 });
  // US-141 CA-4 : rien de récent, pas de bandeau.
  await expect(ecran.getByLabel('Derniers scores')).toHaveCount(0);

  // US-141 CA-2, CA-3 et CA-5 : un score saisi entre dans le bandeau ; l'heure de mise à jour reste visible.
  await lancer(page, adresse);
  await saisirBoutons(page, 5, 3);
  const bandeau = ecran.getByLabel('Derniers scores');
  await expect(bandeau).toContainText(nom, { timeout: 20_000 });
  await expect(bandeau).toContainText(/5 – 3 .+ · Poule 1/);
  await expect(ecran.getByText(/Mis à jour à \d\d:\d\d/)).toBeVisible();

  // US-142 CA-1 et CA-2 : la poule, son avancement et ses colonnes V, M, V/M, TD, TR, Ind, Rang.
  const poule = ecran.getByRole('region', { name: 'Poule 1' });
  await expect(poule).toBeVisible({ timeout: 20_000 });
  await expect(poule).toContainText('1 / 15 matchs');
  for (const colonne of ['V', 'M', 'V/M', 'TD', 'TR', 'Ind', 'Rang']) {
    await expect(poule.getByRole('columnheader', { name: colonne, exact: true })).toBeVisible();
  }
  await info.attach('ecran-clair-bandeau', { body: await ecran.screenshot(), contentType: 'image/png' });

  // US-140 CA-2 : passé en « Sombre », l'écran change sans rechargement.
  await page.goto(pageEcrans);
  await page.getByRole('button', { name: 'Autres actions pour Écran de la salle' }).click({ timeout: 20_000 });
  await page.getByRole('menuitem', { name: /Modifier/ }).click();
  const modification = page.getByRole('dialog', { name: 'Écran de la salle' });
  await expect(modification.getByRole('radio', { name: 'Clair' })).toBeChecked();
  await expect(modification.getByRole('checkbox', { name: 'Bandeau des derniers scores' })).toBeChecked();
  await modification.getByRole('radio', { name: 'Sombre' }).check();
  await modification.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(ecran.locator('html')).toHaveAttribute('data-theme', 'sombre', { timeout: 10_000 });
});
