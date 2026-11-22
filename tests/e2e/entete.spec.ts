// Entête commun, fil d'Ariane, icônes et menu « ⋯ » (US-054, planches 1 à 3 de la maquette « IHM de l'organisateur »).
// Les comptes aux rôles variés sont simulés (simulation.ts) ; la hiérarchie manifestation › compétition › épreuve est
// créée pour de vrai sur le serveur de test, avec des noms uniques.
import { expect, test, type Locator, type Page } from '@playwright/test';
import { boutonMenuCompte, seConnecter } from './compte';
import { ouvrirDansLApplication } from './creer';
import { ajouterCompetition, creerManifestationSimple, ouvrirManifestation } from './planche';
import { connecterSimule, simuler } from './simulation';

const LARGE = { width: 1360, height: 1000 };
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;
const entete = (page: Page) => page.getByRole('banner');
const fil = (page: Page) => page.getByRole('navigation', { name: 'Fil d’Ariane' });
const aide = (page: Page) => entete(page).getByRole('link', { name: 'Comment ça s’organise' });
const theme = (page: Page) => entete(page).getByRole('group', { name: 'Thème' });
const boutonsTheme = (page: Page) => theme(page).getByRole('button');

/** Couleur calculée d'une valeur CSS (une variable de la charte, par exemple), au format `rgb(…)` du navigateur. */
const couleurDe = (page: Page, valeur: string) =>
  page.evaluate((v) => {
    const sonde = document.createElement('div');
    sonde.style.color = v;
    document.body.append(sonde);
    const couleur = getComputedStyle(sonde).color;
    sonde.remove();
    return couleur;
  }, valeur);

const fondDe = (element: Locator) => element.evaluate((noeud) => getComputedStyle(noeud).backgroundColor);
const sansDefilementHorizontal = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/**
 * Une manifestation, une compétition (arme au sabre) et une épreuve dans cette compétition, créées en ligne, puis la
 * page de l'épreuve ouverte. Le nom de la manifestation est long (cas limite du fil d'Ariane).
 */
async function creerHierarchie(page: Page) {
  const manifestation = `${nomUnique()} — grande manifestation au titre volontairement très long`;
  const competition = nomUnique();
  const epreuve = `${competition} M13`;
  await creerManifestationSimple(page, manifestation);
  await ajouterCompetition(page, manifestation, competition);
  await ouvrirManifestation(page, manifestation, 'plan');
  await page
    .getByRole('button', { name: new RegExp(`^Ajouter une épreuve à ${competition}`) })
    .first()
    .click();
  await expect(page.getByLabel('Compétition', { exact: true })).not.toHaveValue('');
  await page.getByLabel('Nom', { exact: true }).fill(epreuve);
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name: epreuve })).toBeVisible();
  return { manifestation, competition, epreuve, chemin: new URL(page.url()).pathname };
}

test('US-054 CA-1 : l’entête montre marque, Créer, Comptes, aide, trois icônes de thème (US-067) et compte, dans cet ordre', async ({
  page,
}) => {
  await page.setViewportSize(LARGE);
  await connecterSimule(page, 'administrateur');
  const marque = entete(page).getByRole('link', { name: 'Poule Position' });
  const creer = entete(page).getByRole('link', { name: 'Créer', exact: true });
  const comptes = entete(page).getByRole('link', { name: 'Comptes' });
  const ordre = [marque, creer, comptes, aide(page), theme(page), boutonMenuCompte(page)];
  const abscisses: number[] = [];
  for (const element of ordre) {
    await expect(element).toBeVisible();
    abscisses.push((await element.boundingBox())!.x);
  }
  expect(abscisses).toEqual([...abscisses].sort((a, b) => a - b));
  await expect(marque).toHaveAttribute('href', '/organisateur');
  await expect(creer).toHaveAttribute('href', '/creer');
  await expect(comptes).toHaveAttribute('href', '/comptes');
  await expect(aide(page)).toHaveAttribute('href', '/creer/aide');

  // Le même entête sur une autre page réservée.
  await creer.click();
  await expect(page).toHaveURL(/\/creer$/);
  await expect(comptes).toBeVisible();
  await expect(boutonMenuCompte(page)).toBeVisible();
});

test('US-054 CA-2 : « Comptes » n’est pas dans l’entête d’un organisateur', async ({ page }) => {
  await page.setViewportSize(LARGE);
  await connecterSimule(page, 'organisateur');
  await expect(entete(page).getByRole('link', { name: 'Créer', exact: true })).toBeVisible();
  await expect(entete(page).getByRole('link', { name: 'Comptes' })).toHaveCount(0);
});

test('US-054 CA-3 : le fil d’Ariane d’une épreuve va de l’accueil à l’épreuve, et ses niveaux sont des liens', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize(LARGE);
  await seConnecter(page);
  const { manifestation, competition, epreuve, chemin } = await creerHierarchie(page);

  // Épreuve : Accueil › manifestation › compétition › épreuve ; seul le dernier niveau n'est pas un lien.
  await expect(fil(page).getByRole('link')).toHaveCount(3, { timeout: 20_000 });
  await expect(fil(page).getByRole('link').nth(0)).toHaveText('Accueil');
  await expect(fil(page).getByRole('link').nth(1)).toHaveAccessibleName(manifestation);
  await expect(fil(page).getByRole('link').nth(2)).toHaveText(competition);
  await expect(fil(page).locator('[aria-current="page"]')).toHaveText(epreuve);
  expect(await fil(page).getByRole('listitem').count()).toBe(4);

  // Cas limite : le nom long est coupé à l'écran mais reste entier (nom accessible, infobulle) ; pas de défilement.
  const lienManifestation = fil(page).getByRole('link').nth(1);
  expect(await lienManifestation.evaluate((a) => a.scrollWidth > a.clientWidth)).toBe(true);
  await expect(lienManifestation).toHaveAttribute('title', manifestation);
  expect(await sansDefilementHorizontal(page)).toBe(true);

  // Formule et paramètres : l'épreuve devient un lien, la page courante est le dernier niveau.
  for (const [suite, page_] of [
    ['formule', 'Formule'],
    ['parametres', 'Paramètres'],
  ] as const) {
    await ouvrirDansLApplication(page, `${chemin}/${suite}`);
    await expect(fil(page).locator('[aria-current="page"]')).toHaveText(new RegExp(page_), { timeout: 20_000 });
    await expect(fil(page).getByRole('link', { name: epreuve })).toHaveAttribute('href', chemin);
  }

  // US-056 : le niveau « compétition » mène, comme « manifestation », à la page de la manifestation.
  await ouvrirDansLApplication(page, chemin);
  await expect(fil(page).getByRole('link', { name: competition })).toHaveAttribute(
    'href',
    /^\/manifestations\/[0-9a-f-]{36}$/,
  );
  await fil(page).getByRole('link', { name: competition }).click();
  await expect(page).toHaveURL(/\/manifestations\/[0-9a-f-]{36}$/);
  await ouvrirDansLApplication(page, chemin);

  // Plan de la manifestation : Accueil › manifestation.
  await fil(page).getByRole('link', { name: manifestation }).click();
  await expect(page).toHaveURL(/\/manifestations\/[0-9a-f-]{36}$/);
  await expect(fil(page).locator('[aria-current="page"]')).toHaveAccessibleName(manifestation);
  await fil(page).getByRole('link', { name: 'Accueil' }).click();
  await expect(page).toHaveURL(/\/organisateur$/);
  await expect(fil(page)).toHaveCount(0);
});

test('US-054 CA-3 : comptes, profil, « Créer » et l’aide ont leur fil d’Ariane depuis l’accueil', async ({ page }) => {
  await page.setViewportSize(LARGE);
  await simuler(page, '/comptes', 200, { ok: true, comptes: [] }, 'GET');
  await connecterSimule(page, 'administrateur');
  const niveaux = async () => (await fil(page).getByRole('listitem').allInnerTexts()).map((texte) => texte.trim());

  await entete(page).getByRole('link', { name: 'Comptes' }).click();
  expect(await niveaux()).toEqual(['Accueil', 'Comptes']);
  await expect(fil(page).locator('[aria-current="page"]')).toHaveText('Comptes');

  await boutonMenuCompte(page).click();
  await page.getByRole('link', { name: 'Éditer le profil' }).click();
  expect(await niveaux()).toEqual(['Accueil', 'Mon profil']);

  await entete(page).getByRole('link', { name: 'Créer', exact: true }).click();
  expect(await niveaux()).toEqual(['Accueil', 'Créer']);

  await aide(page).click();
  expect(await niveaux()).toEqual(['Accueil', 'Créer', 'Comment ça s’organise']);
  await expect(fil(page).locator('[aria-current="page"]')).toHaveText('Comment ça s’organise');
  await fil(page).getByRole('link', { name: 'Créer' }).click();
  await expect(page).toHaveURL(/\/creer$/);
});

test('US-054 CA-3 cas limite : les pages publiques gardent leur entête, sans fil d’Ariane', async ({ page }) => {
  for (const chemin of ['/', '/connexion']) {
    await page.goto(chemin);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(fil(page)).toHaveCount(0);
    await expect(page.getByRole('banner')).toHaveCount(0);
  }
});

test('US-054 CA-4 : une icône seule a un nom accessible et une infobulle identiques, et les icônes sont décoratives', async ({
  page,
}) => {
  await page.setViewportSize(LARGE);
  await connecterSimule(page, 'administrateur');
  for (const bouton of [aide(page), ...(await boutonsTheme(page).all())]) {
    const nom = await bouton.getAttribute('aria-label');
    expect(nom).toBeTruthy();
    await expect(bouton).toHaveAttribute('title', nom!);
  }
  // Aucune icône n'est lue par un lecteur d'écran : elle est masquée, son rôle est porté par le bouton ou le libellé.
  const visibles = await page.locator('svg[data-icone]').evaluateAll((svgs) =>
    svgs.map((svg) => ({
      masque: svg.getAttribute('aria-hidden') === 'true',
      traitCourant: getComputedStyle(svg).stroke !== 'none' || svg.getAttribute('fill') === 'currentColor',
    })),
  );
  expect(visibles.length).toBeGreaterThanOrEqual(4);
  expect(visibles.every(({ masque }) => masque)).toBe(true);
  // Ni police d'icônes ni émoji dans l'entête.
  expect(await entete(page).innerText()).not.toMatch(/\p{Extended_Pictographic}/u);
});

test('US-054 CA-5 : un bouton à icône seule mesure au moins 44 × 44 px et a un focus visible', async ({ page }) => {
  await page.setViewportSize(LARGE);
  await connecterSimule(page, 'organisateur');
  for (const bouton of [aide(page), ...(await boutonsTheme(page).all()), boutonMenuCompte(page)]) {
    const boite = (await bouton.boundingBox())!;
    expect(boite.width).toBeGreaterThanOrEqual(44);
    expect(boite.height).toBeGreaterThanOrEqual(44);
  }
  // Focus au clavier : le contour est tracé, dans une couleur distincte du fond de l'entête.
  const premier = boutonsTheme(page).first();
  await premier.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(premier).toBeFocused();
  const contour = await premier.evaluate((b) => {
    const style = getComputedStyle(b);
    return { style: style.outlineStyle, largeur: parseFloat(style.outlineWidth), couleur: style.outlineColor };
  });
  expect(contour.style).not.toBe('none');
  expect(contour.largeur).toBeGreaterThanOrEqual(2);
  expect(contour.couleur).not.toBe(await fondDe(entete(page)));
});

test('US-054 CA-6 (US-067) : le thème se choisit en un clic ou au clavier, sans menu à ouvrir', async ({ page }) => {
  await page.setViewportSize(LARGE);
  await connecterSimule(page, 'organisateur');
  await expect(entete(page).getByRole('menu')).toHaveCount(0);
  const sombre = boutonsTheme(page).nth(1);
  await expect(boutonsTheme(page)).toHaveCount(3);
  await sombre.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sombre');
  await expect(sombre).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Space');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'clair');
  await expect(boutonsTheme(page).first()).toHaveAttribute('aria-pressed', 'true');
});

test('US-054 CA-7 : à 390 px, l’entête garde la marque et le compte ; le reste est dans le menu de compte', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await connecterSimule(page, 'administrateur');
  await expect(entete(page).getByRole('link', { name: 'Poule Position' })).toBeVisible();
  await expect(boutonMenuCompte(page)).toBeVisible();
  for (const nom of ['Créer', 'Comptes']) {
    await expect(entete(page).getByRole('link', { name: nom, exact: true })).toHaveCount(0);
  }
  await expect(aide(page)).toHaveCount(0);
  await expect(theme(page)).toHaveCount(0);
  expect(await sansDefilementHorizontal(page)).toBe(true);

  await boutonMenuCompte(page).click();
  const menu = page.locator('#menu-compte');
  await expect(menu.getByRole('link', { name: 'Comptes' })).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Comment ça s’organise' })).toBeVisible();
  const themes = menu.getByRole('group', { name: 'Thème' });
  await expect(themes.getByRole('button')).toHaveText(['Clair', 'Sombre', 'Auto']);
  await themes.getByRole('button', { name: 'Sombre' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sombre');
  expect(await sansDefilementHorizontal(page)).toBe(true);
  await menu.getByRole('link', { name: 'Comptes' }).click();
  await expect(page).toHaveURL(/\/comptes$/);
});

test('US-054 CA-8 : l’entête emploie les variables de la charte, pas des couleurs écrites en dur', async ({ page }) => {
  await page.setViewportSize(LARGE);
  await connecterSimule(page, 'organisateur');
  expect(await fondDe(entete(page))).toBe(await couleurDe(page, 'var(--marque)'));
  expect(await fondDe(entete(page).getByRole('link', { name: 'Créer', exact: true }))).toBe(
    await couleurDe(page, 'var(--palette-tiffany)'),
  );
  for (const mode of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: mode });
    expect(await fondDe(entete(page))).toBe(await couleurDe(page, 'var(--marque)'));
  }
});

test('US-054 CA-9 : la page d’une épreuve, menu « ⋯ » ouvert, est conforme aux planches 1 à 3', async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await page.setViewportSize(LARGE);
  await page.emulateMedia({ colorScheme: 'light' });
  await seConnecter(page);
  const { manifestation, competition, epreuve } = await creerHierarchie(page);
  await expect(fil(page).getByRole('link')).toHaveCount(3, { timeout: 20_000 });
  await page.getByRole('button', { name: `Autres actions pour ${epreuve}` }).click();
  const menu = page.getByRole('menu', { name: `Autres actions pour ${epreuve}` });
  await expect(menu).toBeVisible();

  // Entête : fond ardoise (--marque), marque à gauche, « Créer » tiffany, puis aide, thème et compte à droite.
  expect(await fondDe(entete(page))).toBe(await couleurDe(page, 'var(--marque)'));
  expect((await entete(page).boundingBox())!.height).toBeLessThanOrEqual(64);
  expect(
    await entete(page)
      .getByRole('link', { name: 'Poule Position' })
      .evaluate((a) => getComputedStyle(a).color),
  ).toBe(await couleurDe(page, 'var(--sur-marque)'));
  const creer = entete(page).getByRole('link', { name: 'Créer', exact: true });
  expect(await fondDe(creer)).toBe(await couleurDe(page, 'var(--palette-tiffany)'));
  expect(await creer.evaluate((a) => getComputedStyle(a).color)).toBe(await couleurDe(page, 'var(--sur-tiffany)'));
  const xs = [aide(page), theme(page), boutonMenuCompte(page)];
  const positions: number[] = [];
  for (const element of xs) positions.push((await element.boundingBox())!.x);
  expect(positions).toEqual([...positions].sort((a, b) => a - b));
  expect(positions[0]!).toBeGreaterThan((await creer.boundingBox())!.x);

  // Fil d'Ariane : sous l'entête, liens en couleur d'accent soulignés, dernier niveau en texte courant.
  const sousEntete = (await entete(page).boundingBox())!.y + (await entete(page).boundingBox())!.height;
  expect((await fil(page).boundingBox())!.y).toBeGreaterThanOrEqual(sousEntete);
  const premierLien = fil(page).getByRole('link').first();
  expect(await premierLien.evaluate((a) => getComputedStyle(a).color)).toBe(await couleurDe(page, 'var(--accent)'));
  expect(await premierLien.evaluate((a) => getComputedStyle(a).textDecorationLine)).toBe('underline');
  expect(
    await fil(page)
      .locator('[aria-current="page"]')
      .evaluate((s) => getComputedStyle(s).color),
  ).toBe(await couleurDe(page, 'var(--texte)'));
  await expect(fil(page).getByRole('link').nth(1)).toHaveAccessibleName(manifestation);
  await expect(fil(page).getByRole('link').nth(2)).toHaveText(competition);

  // Menu « ⋯ » : carte blanche (--surface), actions dans l'ordre, icônes au trait, aucun défilement horizontal.
  expect(await fondDe(menu)).toBe(await couleurDe(page, 'var(--surface)'));
  // US-057 : un administrateur (le compte local) a « Supprimer… » en dernier ; un organisateur (la preview), non.
  const actions = (await menu.getByRole('menuitem').allInnerTexts()).map((texte) => texte.split('\n')[0]);
  expect(actions).toEqual(
    // US-133 CA-6 : « Écrans géants… » suit « Dupliquer ».
    process.env.BASE_URL
      ? ['Dupliquer', 'Écrans géants…', 'Exporter', 'Archiver']
      : ['Dupliquer', 'Écrans géants…', 'Exporter', 'Archiver', 'Supprimer…'],
  );
  expect(await menu.locator('svg[data-icone]').count()).toBe(actions.length);
  expect(await sansDefilementHorizontal(page)).toBe(true);

  await testInfo.attach('3-epreuve-menu-ouvert.png', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png',
  });
});

test('US-054 hors ligne : l’entête et le fil d’Ariane s’affichent sur une épreuve pilotée ici, réseau coupé', async ({
  page,
  context,
}) => {
  test.setTimeout(150_000);
  await page.setViewportSize(LARGE);
  await seConnecter(page);
  const { manifestation, competition, epreuve, chemin } = await creerHierarchie(page);
  await expect(fil(page).getByRole('link')).toHaveCount(3, { timeout: 20_000 });

  // Première visite terminée : le service worker précache l'application, les listes du club sont copiées sur l'appareil.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await expect(fil(page).getByRole('link')).toHaveCount(3, { timeout: 20_000 });

  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveURL(new RegExp(`${chemin}$`));
  await expect(page.getByRole('heading', { level: 1, name: epreuve })).toBeVisible();
  await expect(entete(page).getByRole('link', { name: 'Poule Position' })).toBeVisible();
  await expect(entete(page).getByRole('link', { name: 'Créer', exact: true })).toBeVisible();
  await expect(aide(page)).toBeVisible();
  await expect(theme(page)).toBeVisible();
  await expect(fil(page).getByRole('link', { name: 'Accueil' })).toBeVisible();
  await expect(fil(page).getByRole('link', { name: competition })).toBeVisible({ timeout: 20_000 });
  await expect(fil(page).getByRole('link', { name: manifestation })).toBeVisible();
  await expect(fil(page).locator('[aria-current="page"]')).toHaveText(epreuve);
  // « Créer » reste actif : la page s'ouvre sans réseau.
  await entete(page).getByRole('link', { name: 'Créer', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Que voulez-vous créer ?' })).toBeVisible();
  await context.setOffline(false);
});
