// Refonte de l'accueil de l'organisateur (US-055) : carte de manifestation, lignes de compétition et d'épreuve en noms
// courts, icônes d'état, légende, menus « ⋯ », conformité à la planche 1 (docs/maquettes/ihm/1-accueil.png).
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';

import { peupler, type Planche } from './planche';

const carte = (page: Page, planche: Planche) => page.getByRole('article', { name: planche.manifestation });
const ligneCompetition = (page: Page, nom: string) => page.getByRole('button', { name: new RegExp(`^${nom}`) });

async function ouvrirAccueil(page: Page) {
  await seConnecter(page);
  const planche = await peupler(page);
  await page.goto('/organisateur');
  await expect(carte(page, planche)).toBeVisible({ timeout: 20_000 });
  // US-063 : les décomptes de la planche comptent toutes les épreuves, terminées comprises.
  await page.getByRole('button', { name: /^Toutes/ }).click();
  return planche;
}

test('US-055 CA-7 : le titre est « Manifestations et compétitions »', async ({ page }) => {
  await seConnecter(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Manifestations et compétitions' })).toBeVisible();
  await expect(page.getByText(/^Bonjour,/)).toHaveCount(0);
});

test('US-055 CA-1 : la manifestation forme une carte avec dates, lieu, décompte, « Plan » et « ⋯ »', async ({
  page,
}) => {
  const planche = await ouvrirAccueil(page);
  const c = carte(page, planche);
  await expect(c.getByRole('link', { name: planche.manifestation, exact: true })).toBeVisible();
  await expect(c).toContainText('Salle Bellegrave');
  await expect(c).toContainText('3 compétitions, 4 épreuves');
  await expect(c.getByText('Aujourd’hui', { exact: true })).toBeVisible();
  await expect(c.getByRole('link', { name: `Voir le plan de ${planche.manifestation}` })).toHaveText('Plan');
  await expect(c.getByRole('button', { name: `Autres actions pour ${planche.manifestation}` })).toBeVisible();
  await c.getByRole('link', { name: `Voir le plan de ${planche.manifestation}` }).click();
  await expect(page).toHaveURL(/\/manifestations\/[0-9a-f-]{36}\/plan$/);
});

test('US-055 CA-2 : les compétitions sont des lignes repliables, état conservé pendant la visite', async ({ page }) => {
  const planche = await ouvrirAccueil(page);
  const epee = ligneCompetition(page, planche.competitionEpee);
  await expect(epee).toHaveAttribute('aria-expanded', 'false');
  await expect(epee).toContainText('Épée · 3 épreuves');
  await expect(ligneCompetition(page, planche.competitionSabre)).toContainText('Sabre · 1 épreuve');
  await expect(ligneCompetition(page, planche.competitionVide)).toContainText('Fleuret · aucune épreuve');
  await expect(
    carte(page, planche).getByRole('link', { name: `Ajouter des épreuves à ${planche.competitionEpee}` }),
  ).toHaveText('+ Épreuves');
  await epee.click();
  await expect(epee).toHaveAttribute('aria-expanded', 'true');
  const epreuves = page.getByRole('list', { name: `Épreuves de ${planche.competitionEpee}` });
  await expect(epreuves.getByRole('link')).toHaveCount(3);
  // L'état est conservé : on ouvre une épreuve, puis on revient à l'accueil.
  await epreuves.getByRole('link').first().click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  await page.goBack();
  await expect(ligneCompetition(page, planche.competitionEpee)).toHaveAttribute('aria-expanded', 'true');
  await ligneCompetition(page, planche.competitionEpee).click();
  await expect(ligneCompetition(page, planche.competitionEpee)).toHaveAttribute('aria-expanded', 'false');
  await expect(epreuves).toHaveCount(0);
});

test('US-055 CA-2 : une compétition vide, dépliée, montre « Aucune épreuve »', async ({ page }) => {
  const planche = await ouvrirAccueil(page);
  await ligneCompetition(page, planche.competitionVide).click();
  await expect(carte(page, planche).getByText('Aucune épreuve', { exact: true })).toBeVisible();
});

test('US-055 CA-3 : les épreuves sont des lignes cliquables en nom court, avec jour et statut', async ({ page }) => {
  const planche = await ouvrirAccueil(page);
  await ligneCompetition(page, planche.competitionEpee).click();
  const epreuves = page.getByRole('list', { name: `Épreuves de ${planche.competitionEpee}` });
  const dames = epreuves.getByRole('link', { name: `Ouvrir l’épreuve ${planche.competitionEpee} M13 Dames` });
  await expect(dames).toContainText('M13 Dames');
  await expect(dames).not.toContainText(planche.competitionEpee);
  await expect(dames).toContainText('En préparation');
  await expect(dames).toContainText(/\p{L}{3,4}\. \d{1,2} \p{L}{3,5}\.?/u);
  await expect(epreuves.getByRole('link', { name: /M7 Mixte$/ })).toContainText('En cours');
  await expect(epreuves.getByRole('link', { name: /Senior Hommes$/ })).toContainText('Terminée');
  // Cas limite : sans catégorie, le nom complet est affiché.
  await ligneCompetition(page, planche.competitionSabre).click();
  await expect(page.getByRole('link', { name: /Sans catégorie/ })).toContainText(
    `${planche.competitionSabre} Sans catégorie`,
  );
  // Toute la ligne ouvre l'épreuve.
  await dames.click({ position: { x: 20, y: 10 } });
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
});

test('US-055 CA-4 et CA-5 : icônes d’état nommées avec infobulle, et légende des quatre icônes', async ({ page }) => {
  const planche = await ouvrirAccueil(page);
  await ligneCompetition(page, planche.competitionEpee).click();
  const epreuves = page.getByRole('list', { name: `Épreuves de ${planche.competitionEpee}` });
  const dames = epreuves.getByRole('link', { name: /M13 Dames$/ });
  for (const nom of ['Non publiée', 'Lecture seule']) {
    const icone = dames.getByRole('img', { name: nom });
    await expect(icone).toBeVisible();
    await expect(icone).toHaveAttribute('title', nom);
  }
  await expect(dames.getByText('Non publiée')).toHaveCount(0);
  await expect(epreuves.getByRole('link', { name: /M7 Mixte$/ }).getByRole('img', { name: 'Publiée' })).toBeVisible();
  const legende = page.getByRole('list', { name: 'Légende des icônes' });
  await expect(legende.getByRole('listitem')).toHaveText([
    'Publiée',
    'Non publiée',
    'Ce PC est le pilote',
    'Lecture seule',
  ]);
});

test('US-055 CA-6 : le menu « ⋯ » propose les actions de la manifestation et de la compétition', async ({ page }) => {
  const planche = await ouvrirAccueil(page);
  await carte(page, planche)
    .getByRole('button', { name: `Autres actions pour ${planche.manifestation}` })
    .click();
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem', { name: /^Modifier/ })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: /^Ajouter une compétition/ })).toBeVisible();
  await page.keyboard.press('Escape');
  await carte(page, planche)
    .getByRole('button', { name: `Autres actions pour ${planche.competitionEpee}` })
    .click();
  await page.getByRole('menuitem', { name: /^Ajouter des épreuves/ }).click();
  await expect(page).toHaveURL(/\/competitions\/[0-9a-f-]{36}\/epreuves$/);
});

test('US-055 hors ligne : la liste reste lisible et les actions réseau du menu sont grisées avec leur motif', async ({
  page,
  context,
}) => {
  const planche = await ouvrirAccueil(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await expect(carte(page, planche)).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(carte(page, planche)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/^Hors ligne : liste du/)).toBeVisible();
  await carte(page, planche)
    .getByRole('button', { name: `Autres actions pour ${planche.manifestation}` })
    .click();
  const modifier = page.getByRole('menuitem', { name: /^Modifier/ });
  await expect(modifier).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('menu')).toContainText('Nécessite une connexion internet');
  await context.setOffline(false);
});

test('US-055 CA-8 : conforme à la planche 1 à 1360 px', async ({ page }, info) => {
  test.skip(info.project.name !== 'pc', 'La planche est à 1360 px : projet « pc » seulement');
  await page.setViewportSize({ width: 1360, height: 1180 });
  const planche = await ouvrirAccueil(page);
  await ligneCompetition(page, planche.competitionEpee).click();
  await expect(page.getByRole('list', { name: `Épreuves de ${planche.competitionEpee}` })).toBeVisible();

  const c = carte(page, planche);
  // Aucun défilement horizontal.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // Titre à gauche, colonne centrée de 1040 px au plus.
  const boite = await c.boundingBox();
  expect(boite?.width ?? 0).toBeLessThanOrEqual(1041);
  // Structure et ordre de la carte : nom, puis « Plan », puis « ⋯ » de gauche à droite.
  const x = async (localisateur: ReturnType<Page['locator']>) => (await localisateur.boundingBox())?.x ?? 0;
  const nom = await x(c.getByRole('link', { name: planche.manifestation, exact: true }));
  const plan = await x(c.getByRole('link', { name: `Voir le plan de ${planche.manifestation}` }));
  const menu = await x(c.getByRole('button', { name: `Autres actions pour ${planche.manifestation}` }));
  expect(nom).toBeLessThan(plan);
  expect(plan).toBeLessThan(menu);
  // Couleurs de la charte : carré du plan, fond secondaire de la ligne, nom court en couleur d'accent.
  const couleurs = await page.evaluate((nomCompetition) => {
    const bouton = [...document.querySelectorAll('button.bascule')].find((b) =>
      b.textContent?.includes(nomCompetition),
    );
    const ligne = bouton?.parentElement as HTMLElement;
    const carre = bouton?.querySelector('.carre') as HTMLElement;
    const lien = document.querySelector('.nom-epreuve') as HTMLElement;
    const resoudre = (variable: string) => {
      const sonde = document.createElement('span');
      sonde.style.color = `var(${variable})`;
      document.body.append(sonde);
      const couleur = getComputedStyle(sonde).color;
      sonde.remove();
      return couleur;
    };
    return {
      ligne: getComputedStyle(ligne).backgroundColor,
      surface2: resoudre('--surface-2'),
      carre: getComputedStyle(carre).backgroundColor,
      plan0: resoudre('--plan-0'),
      lien: getComputedStyle(lien).color,
      accent: resoudre('--accent'),
    };
  }, planche.competitionEpee);
  expect(couleurs.ligne).toBe(couleurs.surface2);
  expect(couleurs.carre).toBe(couleurs.plan0);
  expect(couleurs.lien).toBe(couleurs.accent);

  const capture = await c.screenshot({ path: process.env.CAPTURE_ACCUEIL });
  await info.attach('accueil-1360.png', { body: capture, contentType: 'image/png' });
});
