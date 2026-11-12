// Point d'entrée « Créer » (US-046) : un seul bouton, trois cartes (manifestation, compléter, compétition seule), l'aide
// « Comment ça s'organise », le même langage visuel que le plan, et le comportement hors ligne.
import { expect, test, type Page, type Route } from '@playwright/test';
import { seConnecter } from './compte';
import { ouvrirCreer, ouvrirDepuisCreer, verifierCreerAccessible } from './creer';

/** Nom unique, pour reconnaître les données de ce test parmi celles du club. */
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

const carte = (page: Page, titre: string) => page.getByRole('region', { name: titre });

/** Crée une compétition seule avec sa première épreuve (US-045 CA-4) et attend sa page. */
async function creerCompetitionSeule(page: Page, nom: string) {
  await page.goto('/epreuves/nouvelle?seule');
  await page.getByLabel('Nom de la compétition et de son épreuve').fill(nom);
  await page.getByLabel('Arme').selectOption('epee');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
}

/** Crée une manifestation par l'assistant (étape 1) et reste à l'étape Compétitions. */
async function creerManifestation(page: Page, nom: string) {
  await page.goto('/organisateur');
  await ouvrirDepuisCreer(page, 'Créer une manifestation');
  await page.getByLabel('Nom', { exact: true }).fill(nom);
  await page.getByLabel('Date de début').fill('2027-03-14');
  await page.getByLabel('Date de fin').fill('2027-03-15');
  await page.getByRole('button', { name: 'Suivant : Compétitions' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Les compétitions du week-end' })).toBeVisible({
    timeout: 20_000,
  });
}

test('US-046 CA-1 : l’accueil n’a plus qu’un bouton « Créer » à la place des liens de création', async ({ page }) => {
  await seConnecter(page);
  await page.goto('/organisateur');
  await verifierCreerAccessible(page);
  for (const ancien of ['Nouvelle manifestation', 'Nouvelle compétition seule', 'Nouvelle épreuve']) {
    await expect(page.getByRole('link', { name: ancien })).toHaveCount(0);
  }
});

test('US-046 CA-2 : trois cartes illustrées, et chaque bouton ouvre son parcours', async ({ page }) => {
  await seConnecter(page);
  await page.goto('/organisateur');
  await ouvrirCreer(page);
  await expect(page).toHaveURL(/\/creer$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Que voulez-vous créer ?' })).toBeVisible();

  // Chaque carte : une miniature, une phrase « quand choisir » et un exemple.
  for (const titre of ['Une manifestation', 'Compléter', 'Une compétition seule']) {
    const zone = carte(page, titre);
    await expect(zone.getByRole('img')).toBeVisible();
    await expect(zone).toContainText('Quand choisir');
    await expect(zone).toContainText('Exemple');
  }
  await expect(carte(page, 'Une manifestation')).toContainText('Le plus courant');

  // « Une manifestation » ouvre l'assistant (US-047).
  await page.getByRole('link', { name: 'Créer une manifestation' }).click();
  await expect(page).toHaveURL(/\/manifestations\/nouvelle$/);
  await expect(page.getByRole('heading', { level: 1, name: 'La manifestation' })).toBeVisible();

  // « Une compétition seule » ouvre le formulaire en une étape (US-045 CA-4).
  await page.goto('/creer');
  await page.getByRole('link', { name: 'Créer une compétition seule' }).click();
  await expect(page).toHaveURL(/\/epreuves\/nouvelle\?seule$/);
  await expect(page.getByLabel('Compétition', { exact: true })).toHaveValue('+seule');
});

test('US-046 CA-2 : « Compléter » retrouve une manifestation et propose d’y ajouter une compétition', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const manifestation = nomUnique();
  await seConnecter(page);
  await creerManifestation(page, manifestation);

  await page.goto('/creer');
  const completer = carte(page, 'Compléter');
  await completer.getByLabel('Rechercher une manifestation ou une compétition').fill(manifestation.toLowerCase());
  await completer.getByRole('button', { name: `Choisir ${manifestation}` }).click({ timeout: 20_000 });
  await completer.getByRole('link', { name: `Nouvelle compétition dans ${manifestation}` }).click();
  await expect(page).toHaveURL(/\/manifestations\/[0-9a-f-]{36}\?competition=nouvelle$/);
});

test('US-046 CA-2 : « Compléter » retrouve une compétition et ouvre la grille pour y ajouter des épreuves', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const nom = nomUnique();
  await seConnecter(page);
  await creerCompetitionSeule(page, nom);

  await page.goto('/creer');
  const completer = carte(page, 'Compléter');
  await completer.getByLabel('Rechercher une manifestation ou une compétition').fill(nom);
  await completer.getByRole('button', { name: `Choisir ${nom}` }).click({ timeout: 20_000 });
  await completer.getByRole('link', { name: `Ajouter des épreuves à ${nom}` }).click();
  await expect(page).toHaveURL(/\/competitions\/[0-9a-f-]{36}\/epreuves$/);
});

test('US-046 CA-3 : l’aide « Comment ça s’organise » montre les trois niveaux sur un exemple', async ({ page }) => {
  await seConnecter(page);
  await page.goto('/creer');
  await page.getByRole('link', { name: 'Voir comment s’articulent manifestations, compétitions et épreuves' }).click();
  await expect(page).toHaveURL(/\/creer\/aide$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Comment ça s’organise' })).toBeVisible();

  // Le fil d'Ariane (US-054) est aussi une liste : on prend celle des trois niveaux.
  const niveaux = page.getByRole('main').getByRole('list').filter({ hasText: 'La manifestation' }).first();
  await expect(niveaux).toContainText('La manifestation');
  await expect(niveaux).toContainText('La compétition');
  await expect(niveaux).toContainText('L’épreuve');
  await expect(niveaux).toContainText('reprend');

  // L'exemple : un week-end, deux compétitions avec leurs épreuves, une compétition seule à côté.
  const exemple = page.getByRole('region', { name: 'Un exemple' });
  await expect(exemple).toContainText('Week-end des Championnats');
  await expect(exemple).toContainText('Sabre');
  await expect(exemple).toContainText('M13 · Hommes');
  await expect(exemple).toContainText('Épée');
  await expect(exemple).toContainText('Challenge de Noël');

  await page.getByRole('link', { name: 'Retour à « Que voulez-vous créer ? »' }).click();
  await expect(page).toHaveURL(/\/creer$/);
});

test('US-046 CA-4 : chaque compétition a la même couleur dans la liste de l’accueil et dans le plan', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const manifestation = nomUnique();
  const alpha = `${nomUnique()} Alpha`;
  const bravo = `${nomUnique()} Bravo`;
  await seConnecter(page);
  await creerManifestation(page, manifestation);
  for (const nom of [alpha, bravo]) {
    await page.getByLabel('Nom de la compétition').fill(nom);
    await page.getByRole('button', { name: 'Sabre', exact: true }).click();
    await page.getByRole('button', { name: 'Ajouter la compétition' }).click();
    await expect(page.getByText(`Compétition « ${nom} » créée`)).toBeVisible({ timeout: 20_000 });
  }

  /** Rang de palette (`--plan-N`) lu dans l'attribut `style` de l'élément. */
  const rang = async (element: ReturnType<Page['locator']>) =>
    /--plan-(\d)/.exec((await element.getAttribute('style')) ?? '')?.[1];

  // La liste de l'accueil : une bande par compétition, dans le cadre de la manifestation.
  await page.goto('/organisateur');
  const bloc = page.getByRole('article', { name: manifestation });
  const bandeAlpha = bloc.locator('.competition').filter({ hasText: alpha });
  const bandeBravo = bloc.locator('.competition').filter({ hasText: bravo });
  const [listeAlpha, listeBravo] = [await rang(bandeAlpha), await rang(bandeBravo)];
  expect(listeAlpha).toBeDefined();
  expect(listeBravo).toBeDefined();
  expect(listeAlpha).not.toBe(listeBravo);

  // Le plan, lu en tableau (fenêtre large : sur smartphone il devient une liste par jour) : la même couleur.
  await page.setViewportSize({ width: 1280, height: 800 });
  await bloc.getByRole('link', { name: `Voir le plan de ${manifestation}` }).click();
  await expect(page.getByRole('heading', { level: 1, name: manifestation })).toBeVisible();
  const planAlpha = page.getByRole('row').filter({ hasText: alpha }).locator('.couleur');
  const planBravo = page.getByRole('row').filter({ hasText: bravo }).locator('.couleur');
  expect(await rang(planAlpha)).toBe(listeAlpha);
  expect(await rang(planBravo)).toBe(listeBravo);
});

test('US-046 hors ligne : « Créer » s’affiche, ce qui exige internet est grisé, l’ajout d’épreuves et l’aide restent possibles', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  const nom = nomUnique();
  await seConnecter(page);
  await creerCompetitionSeule(page, nom);
  // La copie des compétitions de l'appareil se remplit à la lecture de la liste du club.
  const copie = page.waitForResponse((reponse) => /\/competitions$/.test(reponse.url()));
  await page.goto('/organisateur');
  await copie;
  await expect(page.getByRole('listitem').filter({ hasText: nom }).first()).toBeVisible({ timeout: 20_000 });

  await context.setOffline(true);
  await expect(page.getByText(/^Hors ligne : liste du /)).toBeVisible({ timeout: 20_000 });
  await ouvrirCreer(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Que voulez-vous créer ?' })).toBeVisible();

  // « Une manifestation » et « Une compétition seule » sont grisées, sans lien.
  for (const titre of ['Une manifestation', 'Une compétition seule']) {
    await expect(carte(page, titre)).toContainText('Nécessite une connexion internet');
  }
  await expect(page.getByRole('link', { name: 'Créer une manifestation' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Créer une compétition seule' })).toHaveCount(0);

  // « Compléter » ne propose que des épreuves, dans une compétition connue de l'appareil.
  const completer = carte(page, 'Compléter');
  await expect(completer).toContainText('seules des épreuves s’ajoutent');
  await completer.getByLabel('Rechercher une manifestation ou une compétition').fill(nom);
  await completer.getByRole('button', { name: `Choisir ${nom}` }).click();
  await expect(completer.getByRole('link', { name: `Ajouter des épreuves à ${nom}` })).toBeVisible();
  await expect(completer.getByRole('link', { name: /Nouvelle compétition/ })).toHaveCount(0);

  // L'aide se consulte hors ligne.
  await page.getByRole('link', { name: 'Voir comment s’articulent manifestations, compétitions et épreuves' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Comment ça s’organise' })).toBeVisible();
  await context.setOffline(false);
});

test('US-046 cas limite : un club sans manifestation ni compétition n’a rien à compléter', async ({ page }) => {
  await seConnecter(page);
  const vide = (corps: object) => async (route: Route) => {
    if (route.request().resourceType() !== 'fetch') return route.continue();
    return route.fulfill({ json: corps, headers: { 'access-control-allow-origin': '*' } });
  };
  await page.route('**/epreuves', vide({ ok: true, epreuves: [] }));
  await page.route('**/manifestations', vide({ ok: true, manifestations: [] }));
  await page.route('**/competitions', vide({ ok: true, competitions: [] }));
  await page.goto('/creer');
  await expect(carte(page, 'Compléter')).toContainText('Rien à compléter pour l’instant', { timeout: 20_000 });
  await expect(carte(page, 'Compléter').getByLabel('Rechercher une manifestation ou une compétition')).toHaveCount(0);
});
