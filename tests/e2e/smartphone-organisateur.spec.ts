// L'organisateur sur smartphone (US-061, planches 5 et 6, 390 × 844) : accueil sur une colonne avec « Créer » flottant,
// page d'une épreuve avec entête compact et barre d'onglets en bas. Ces tests fixent leur propre taille d'écran ; ils
// ne tournent que dans le projet « smartphone ». Le compte local est administrateur : les épreuves de la planche
// viennent « d'un autre PC » (lecture seule), comme sur un téléphone.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { peupler, type Planche } from './planche';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
test.beforeEach(({ isMobile }) => {
  test.skip(!isMobile, 'format smartphone uniquement');
});

const navigation = (page: Page) => page.getByRole('navigation', { name: 'Étapes de l’épreuve' });
const fil = (page: Page) => page.getByRole('navigation', { name: 'Fil d’Ariane' });
const creer = (page: Page) => page.getByRole('link', { name: 'Créer', exact: true });

/** Aucun défilement horizontal : la page tient dans la largeur de l'écran. */
const sansDefilementHorizontal = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= 390 && window.innerWidth <= 390);

async function accueil(page: Page): Promise<Planche> {
  await seConnecter(page);
  const planche = await peupler(page);
  await page.goto('/organisateur');
  await expect(page.getByRole('article', { name: planche.manifestation })).toBeVisible({ timeout: 30_000 });
  return planche;
}

/** Déplie la ligne d'une compétition (repliée par défaut quand la manifestation en compte plusieurs). */
async function deplier(page: Page, planche: Planche, nom: string) {
  const ligne = page
    .getByRole('article', { name: planche.manifestation })
    .getByRole('button', { name: new RegExp(`^${nom}`) });
  if ((await ligne.getAttribute('aria-expanded')) !== 'true') await ligne.click();
  await expect(ligne).toHaveAttribute('aria-expanded', 'true');
}

/** Ouvre la page de l'épreuve « M13 Dames » de la planche (lecture seule). */
async function ouvrirEpreuve(page: Page, planche: Planche) {
  await deplier(page, planche, planche.competitionEpee);
  await page.getByRole('link', { name: `Ouvrir l’épreuve ${planche.competitionEpee} M13 Dames`, exact: true }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

test('US-061 CA-1 : l’accueil tient sur une colonne, sans défilement horizontal, avec des lignes d’épreuve complètes', async ({
  page,
}) => {
  const planche = await accueil(page);
  const carte = page.getByRole('article', { name: planche.manifestation });
  await deplier(page, planche, planche.competitionEpee);
  const ligne = carte.getByRole('listitem').filter({ hasText: 'M13 Dames' }).first();
  await expect(ligne).toBeVisible();
  // Nom court, statut en texte, icône de publication et chevron sur la ligne.
  await expect(ligne).toContainText('En préparation');
  await expect(ligne.locator('svg[data-icone]').first()).toBeVisible();
  expect(await sansDefilementHorizontal(page)).toBe(true);
  const boite = (await carte.boundingBox())!;
  expect(boite.x).toBeGreaterThanOrEqual(0);
  expect(boite.x + boite.width).toBeLessThanOrEqual(390);
  // Une colonne : toutes les lignes d'épreuve ont la même abscisse.
  const abscisses = await carte
    .getByRole('link', { name: /^Ouvrir l’épreuve/ })
    .evaluateAll((liens) => liens.map((lien) => Math.round(lien.getBoundingClientRect().x)));
  expect(new Set(abscisses).size).toBe(1);
});

test('US-061 CA-2 : « Créer » flotte en bas à droite, mène à /creer et ne masque pas la dernière ligne', async ({
  page,
}) => {
  await accueil(page);
  const bouton = creer(page);
  await expect(bouton).toBeVisible();
  const boite = (await bouton.boundingBox())!;
  expect(boite.x + boite.width).toBeGreaterThan(390 - 40);
  expect(boite.y + boite.height).toBeGreaterThan(844 - 100);
  await expect(bouton).toContainText('Créer');
  await expect(bouton.locator('svg[data-icone]')).toBeVisible();
  // Au bas de la liste, le bouton ne recouvre pas la dernière ligne (marge de fin).
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const bas = await page.evaluate(() => {
    const enfants = [...document.querySelectorAll('main > *')].filter((e) => getComputedStyle(e).position !== 'fixed');
    return enfants.at(-1)!.getBoundingClientRect().bottom;
  });
  expect(bas).toBeLessThanOrEqual((await bouton.boundingBox())!.y);
  await bouton.click();
  await expect(page).toHaveURL(/\/creer$/);
});

test('US-061 CA-3 : l’entête de l’épreuve est compacte (retour, nom court, compétition et arme, menu), sans fil d’Ariane', async ({
  page,
}) => {
  const planche = await accueil(page);
  await ouvrirEpreuve(page, planche);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('M13 Dames');
  await expect(fil(page)).toBeHidden();
  const retour = page.getByRole('link', { name: /^Retour/ });
  await expect(retour).toBeVisible();
  await expect(page.getByText(`${planche.competitionEpee} · Épée`).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /^Autres actions/ })).toBeVisible();
  // Le niveau supérieur du fil : la page de la manifestation.
  await retour.click();
  await expect(page).toHaveURL(/\/manifestations\/[0-9a-f-]{36}$/);
});

test('US-061 CA-4 : la barre d’onglets est fixe en bas ; « Plus » ouvre Émargement, Impressions, Formule et Paramètres', async ({
  page,
}) => {
  const planche = await accueil(page);
  await ouvrirEpreuve(page, planche);
  const barre = navigation(page);
  await expect(barre).toBeVisible();
  // Mesures dans la page (la barre est fixe : ses coordonnées sont celles de l'écran).
  const mesure = () =>
    barre.evaluate((element) => {
      const { bottom, width } = element.getBoundingClientRect();
      return { bas: Math.round(bottom), largeur: Math.round(width) };
    });
  expect(await mesure()).toEqual({ bas: 844, largeur: 390 });
  await expect(barre.getByRole('link', { name: 'Résumé' })).toHaveAttribute('aria-current', 'page');
  for (const nom of ['Inscrits', 'Poules', 'Tableau']) {
    await expect(barre.locator('[aria-disabled="true"]').filter({ hasText: nom })).toBeVisible();
  }
  // La barre reste en bas quand on fait défiler la page.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  expect((await mesure()).bas).toBe(844);
  await barre.getByRole('button', { name: 'Plus' }).click();
  const menu = page.getByRole('menu');
  await expect(menu.getByRole('menuitem', { name: /Émargement/ })).toHaveAttribute('aria-disabled', 'true');
  await expect(menu.getByRole('menuitem', { name: /Impressions/ })).toHaveAttribute('aria-disabled', 'true');
  await expect(menu.getByRole('menuitem', { name: 'Formule' })).toBeVisible();
  await menu.getByRole('menuitem', { name: 'Paramètres' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}\/parametres$/);
  // Sur « Paramètres », l'onglet « Plus » est celui de l'étape ouverte.
  await expect(navigation(page).getByRole('button', { name: 'Plus' })).toHaveAttribute('aria-current', 'page');
});

test('US-061 CA-5 : les cartes du Résumé sont empilées sur une colonne, l’état du pilote en tête', async ({ page }) => {
  const planche = await accueil(page);
  await ouvrirEpreuve(page, planche);
  const cartes = page.locator('.cartes > section');
  await expect(cartes.first()).toContainText('Lecture seule');
  const boites = await cartes.evaluateAll((elements) =>
    elements.map((element) => {
      const { x, y, width } = element.getBoundingClientRect();
      return { x: Math.round(x), y: Math.round(y), width: Math.round(width) };
    }),
  );
  expect(boites.length).toBeGreaterThanOrEqual(3);
  expect(new Set(boites.map(({ x }) => x)).size).toBe(1);
  expect(new Set(boites.map(({ width }) => width)).size).toBe(1);
  expect(boites.map(({ y }) => y)).toEqual([...boites.map(({ y }) => y)].sort((a, b) => a - b));
  expect(await sansDefilementHorizontal(page)).toBe(true);
});

test('US-061 CA-6 : toute cible fait au moins 44 × 44 px, et les zones sûres sont déclarées', async ({ page }) => {
  const planche = await accueil(page);
  await deplier(page, planche, planche.competitionEpee);
  const nomCarte = planche.manifestation;
  // Entête, titre et carte de ce test (la base du club contient aussi les données d'autres tests).
  const trop_petites = async () =>
    page.evaluate((nomCarte) => {
      const racines = [
        document.querySelector('body > div header'),
        document.querySelector('.titre-ligne'),
        document.querySelector(`article[aria-label="${nomCarte}"]`),
        document.querySelector('main > header'),
        document.querySelector('.cartes'),
        document.querySelector('nav[aria-label="Étapes de l’épreuve"]'),
      ].filter((racine): racine is Element => racine !== null);
      return racines
        .flatMap((racine) => [
          ...racine.querySelectorAll<HTMLElement>('a[href], button, select, input, [role="menuitem"]'),
        ])
        .filter((element) => {
          const { width, height } = element.getBoundingClientRect();
          // Un contrôle masqué (0 × 0) n'est pas une cible.
          return width > 0 && height > 0;
        })
        .map((element) => {
          // Une case à cocher est portée par son libellé.
          const zone = element instanceof HTMLInputElement ? (element.closest('label') ?? element) : element;
          const { width, height } = zone.getBoundingClientRect();
          return {
            cible: `${element.tagName.toLowerCase()} « ${(element.getAttribute('aria-label') ?? element.textContent ?? '').trim().slice(0, 40)} »`,
            largeur: Math.round(width),
            hauteur: Math.round(height),
          };
        })
        .filter(({ largeur, hauteur }) => largeur < 44 || hauteur < 44);
    }, nomCarte);
  expect(await trop_petites()).toEqual([]);
  await ouvrirEpreuve(page, planche);
  expect(await trop_petites()).toEqual([]);
  // Encoche et barre de geste : `viewport-fit=cover` côté page, `env(safe-area-inset-*)` côté barre d'onglets.
  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /viewport-fit=cover/);
  const padding = await navigation(page).evaluate((element) => getComputedStyle(element).paddingBottom);
  expect(parseFloat(padding)).toBeGreaterThanOrEqual(0);
  const regles = await page.evaluate(() =>
    [...document.styleSheets].flatMap((feuille) => [...feuille.cssRules].map((regle) => regle.cssText)).join('\n'),
  );
  expect(regles).toContain('safe-area-inset-bottom');
});

test('US-061 hors ligne : l’accueil et la page d’une épreuve s’affichent à 390 px depuis la copie de l’appareil', async ({
  page,
  context,
}) => {
  const planche = await accueil(page);
  // Une première visite en ligne garde la copie de l'épreuve sur l'appareil ; on revient à l'accueil, puis le réseau se coupe.
  await ouvrirEpreuve(page, planche);
  await page.getByRole('link', { name: /^Retour/ }).click();
  await page.getByRole('link', { name: 'Poule Position' }).click();
  await expect(page.getByRole('article', { name: planche.manifestation })).toBeVisible();
  await context.setOffline(true);
  await ouvrirEpreuve(page, planche);
  await expect(navigation(page)).toBeVisible();
  await navigation(page).getByRole('button', { name: 'Plus' }).click();
  await expect(page.getByRole('menuitem', { name: 'Formule' })).toBeVisible();
  await context.setOffline(false);
});

test('US-061 cas limite : au-delà du point de bascule, la disposition large s’applique (pas de barre d’onglets en bas)', async ({
  page,
}) => {
  const planche = await accueil(page);
  await ouvrirEpreuve(page, planche);
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(fil(page)).toBeVisible();
  await expect(navigation(page).getByRole('button', { name: 'Plus' })).toHaveCount(0);
  await expect(creer(page)).toBeVisible();
});

test('US-061 cas limite : un nom d’épreuve long est tronqué sur une ligne dans l’entête', async ({ page }) => {
  const planche = await accueil(page);
  await deplier(page, planche, planche.competitionSabre);
  await page
    .getByRole('link', { name: `Ouvrir l’épreuve ${planche.competitionSabre} Sans catégorie`, exact: true })
    .click();
  const titre = page.getByRole('heading', { level: 1 });
  await expect(titre).toBeVisible();
  const { hauteur, ligne } = await titre.evaluate((element) => ({
    hauteur: element.getBoundingClientRect().height,
    ligne: parseFloat(getComputedStyle(element).lineHeight),
  }));
  expect(hauteur).toBeLessThanOrEqual(ligne * 1.2);
  await expect(page).toHaveTitle(/Poule Position/);
});

test('US-061 CA-7 : conforme aux planches 5 et 6 à 390 × 844', async ({ page }, testInfo) => {
  const planche = await accueil(page);
  const carte = page.getByRole('article', { name: planche.manifestation });
  // Planche 5 : entête, titre, carte de la manifestation, bouton flottant, dans cet ordre de haut en bas.
  const haut = async (locator: ReturnType<Page['locator']>) => (await locator.boundingBox())!.y;
  const titre = await haut(page.getByRole('heading', { level: 1 }));
  const manifestation = await haut(carte);
  expect(titre).toBeLessThan(manifestation);
  await expect(creer(page)).toBeVisible();
  await testInfo.attach('5-smartphone-accueil.png', { body: await page.screenshot(), contentType: 'image/png' });
  await ouvrirEpreuve(page, planche);
  // Planche 6 : entête (retour, nom court), statut, cartes, barre d'onglets, dans cet ordre.
  const nom = await haut(page.getByRole('heading', { level: 1 }));
  const cartes = await haut(page.locator('.cartes > section').first());
  const barre = await haut(navigation(page));
  expect(nom).toBeLessThan(cartes);
  expect(barre).toBeGreaterThan(nom);
  await testInfo.attach('6-smartphone-epreuve.png', { body: await page.screenshot(), contentType: 'image/png' });
});
