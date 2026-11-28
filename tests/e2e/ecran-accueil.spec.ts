// Mode Accueil de l'écran géant (US-160) : avant le lancement des poules, des plans en boucle (nom et type, horaires,
// inscrits et émargés) et le compte à rebours vers la prochaine étape ; il laisse la place aux poules dès leur
// lancement. L'heure de l'écran est figée (horloge de Playwright) pour un compte à rebours exact. Le PC pilote et l'écran
// sont deux onglets du même navigateur, l'écran sans session.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { epreuveAvecPresentes, repartir } from './poules-outils';

async function creerEcran(page: Page, adresse: string, nomEpreuve: string) {
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
  await fenetre.getByRole('button', { name: 'Enregistrer' }).click();
  return (await page.getByRole('article', { name: 'Écran de la salle' }).locator('code').textContent()) ?? '';
}

test('US-160 CA-1 à CA-5 : le mode Accueil, ses plans et son compte à rebours, puis les poules', async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name !== 'pc', 'Écran géant : projet « pc » seulement');
  test.setTimeout(180_000);
  await seConnecter(page);
  // 6 inscrites, 4 émargées ; appel 08:30, scratch 09:00, début 09:30 (l'épreuve est du jour).
  const adresse = await epreuveAvecPresentes(page, 6, 4, 'individuelle', {
    Appel: '08:30',
    Scratch: '09:00',
    'Début des poules': '09:30',
  });
  const nom = (await page.getByRole('heading', { level: 1 }).textContent())?.trim() ?? '';
  const lien = await creerEcran(page, adresse, nom);

  const ecran = await context.newPage();
  await ecran.setViewportSize({ width: 1920, height: 1080 });
  const jour = new Date().toLocaleDateString('sv-SE');
  await ecran.clock.setFixedTime(new Date(`${jour}T07:47:48`));
  await ecran.goto(new URL(lien).pathname + new URL(lien).hash);

  // CA-4 : le compte à rebours vise l'appel ; la frise montre les trois étapes.
  await expect(ecran.getByRole('timer')).toHaveText(/Appel dans\s*42:12/, { timeout: 20_000 });
  await expect(ecran.locator('.etapes li')).toHaveCount(3);
  await expect(ecran.getByText('Bientôt').first()).toBeVisible();

  // CA-2 : les plans se suivent : le nom et le type, les horaires, puis inscrites et émargées.
  await expect(ecran.locator('[data-plan="nom"]')).toBeVisible();
  await expect(ecran.getByRole('heading', { level: 2, name: nom })).toBeVisible();
  await expect(ecran.locator('[data-plan="nom"] .types')).toContainText('Individuel');
  await expect(ecran.locator('[data-plan="horaires"]')).toBeVisible({ timeout: 20_000 });
  await expect(ecran.locator('.horaire.prochaine')).toContainText('08:30');
  await expect(ecran.locator('[data-plan="chiffres"]')).toBeVisible({ timeout: 20_000 });
  await expect(ecran.getByLabel('6 inscrits')).toBeVisible();
  await expect(ecran.getByLabel('4 ont émargé')).toBeVisible();
  await ecran.screenshot({ path: 'test-results/ecran-accueil.png' });

  // CA-4 : après le scratch, le début ; passé le début, « Début imminent ».
  await ecran.clock.setFixedTime(new Date(`${jour}T09:12:00`));
  await expect(ecran.getByRole('timer')).toHaveText(/Début des poules dans\s*18:00/, { timeout: 10_000 });
  await ecran.clock.setFixedTime(new Date(`${jour}T09:31:00`));
  await expect(ecran.getByRole('timer')).toHaveText('Début imminent', { timeout: 10_000 });

  // CA-5 : poules lancées, l'écran passe aux poules.
  await repartir(page, adresse);
  await page.getByRole('button', { name: 'Lancer les poules' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lancer les poules' }).click();
  await expect(ecran.getByRole('timer')).toHaveCount(0, { timeout: 20_000 });
  await expect(ecran.getByText('Appel des matchs').first()).toBeVisible();
});

test('US-160 cas limite : un nom long passe à la ligne entre les mots, sans déborder', async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name !== 'pc', 'Écran géant : projet « pc » seulement');
  test.setTimeout(150_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(
    page,
    3,
    3,
    'individuelle',
    {},
    'Championnats de Nouvelle Aquitaine M13 Dames',
  );
  const nom = (await page.getByRole('heading', { level: 1 }).textContent())?.trim() ?? '';
  const lien = await creerEcran(page, adresse, nom);
  const ecran = await context.newPage();
  await ecran.setViewportSize({ width: 1680, height: 945 });
  await ecran.goto(new URL(lien).pathname + new URL(lien).hash);
  const titre = ecran.getByRole('heading', { level: 2, name: nom });
  await expect(titre).toBeVisible({ timeout: 20_000 });
  await ecran.waitForTimeout(3_000);
  await ecran.screenshot({ path: 'test-results/ecran-accueil-nom-long.png' });
  // Aucun mot coupé : chaque mot tient sur une seule ligne ; le titre reste dans la largeur de l'écran.
  const mots = await titre
    .locator('.mot')
    .evaluateAll((liste) =>
      liste.map((mot) => mot.getClientRects().length === 1 && mot.getBoundingClientRect().right <= window.innerWidth),
    );
  expect(mots.every(Boolean)).toBe(true);
  // Les mots sont séparés : deux mots voisins sur une même ligne laissent un espace entre eux.
  const espaces = await titre.locator('.mot').evaluateAll((liste) =>
    liste.slice(1).flatMap((mot, i) => {
      const [a, b] = [liste[i]!.getBoundingClientRect(), mot.getBoundingClientRect()];
      return Math.abs(a.top - b.top) < 2 ? [b.left - a.right] : [];
    }),
  );
  expect(espaces.length).toBeGreaterThan(0);
  expect(Math.min(...espaces)).toBeGreaterThan(10);
  const boite = (await titre.boundingBox())!;
  expect(boite.x).toBeGreaterThanOrEqual(0);
  expect(boite.x + boite.width).toBeLessThanOrEqual(1680);
  // Le titre et les étiquettes du type restent au-dessus du compte à rebours.
  const types = (await ecran.locator('[data-plan="nom"] .types').boundingBox())!;
  const bas = (await ecran.getByRole('timer').boundingBox())!;
  expect(types.y + types.height).toBeLessThanOrEqual(bas.y);

  // Les chiffres défilent une seule fois par passage du plan : une vue republiée (ici, une émargée retirée au PC) ne
  // relance pas l'animation ; le nouveau nombre s'affiche tel quel, sans repartir de 0.
  await page.goto(`${adresse}/emargement`);
  const presente = page.getByRole('checkbox', { name: /^Présent : / }).first();
  await expect(presente).toHaveAttribute('aria-checked', 'true', { timeout: 20_000 });
  const chiffres = ecran.locator("[data-plan='chiffres']");
  await expect(chiffres).toBeVisible({ timeout: 40_000 });
  const emarges = ecran.locator('.chiffre.emarges .nombre');
  await expect(emarges).toHaveText(/^3/, { timeout: 5_000 });
  await presente.click();
  const vus: number[] = [];
  for (let i = 0; i < 10 && (await chiffres.isVisible()); i += 1) {
    vus.push(Number.parseInt((await emarges.textContent()) ?? '', 10));
    await ecran.waitForTimeout(150);
  }
  expect(vus.every((n) => n >= 2)).toBe(true);
  await expect(emarges).toHaveText(/^2/, { timeout: 5_000 });
});
