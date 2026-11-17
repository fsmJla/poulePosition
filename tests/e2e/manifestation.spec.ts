// Page d'une manifestation (US-056) : fil d'Ariane, nom, dates, lieu, « Modifier », « ⋯ », trois onglets (Compétitions,
// Plan, Affiche et feuille de route), cartes de compétition, formulaires sur la page, fin de la liste « Manifestations »,
// conformité à la planche 2 (docs/maquettes/ihm/2-manifestation.png). Les données sont créées au serveur (planche.ts) ;
// le compte local est administrateur, celui de la preview un organisateur.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { ouvrirDansLApplication } from './creer';
import { creerManifestation, peupler, type Planche } from './planche';

const AVEC_ADMINISTRATEUR = 'administrateur réel : local uniquement (le compte de la preview est un organisateur)';

const ID = '[0-9a-f-]{36}';
const fil = (page: Page) => page.getByRole('navigation', { name: 'Fil d’Ariane' });
const onglet = (page: Page, nom: string) => page.getByRole('tab', { name: nom });
const carte = (page: Page, nom: string) => page.getByRole('article', { name: nom });
const menuDe = (page: Page, nom: string) => page.getByRole('button', { name: `Autres actions pour ${nom}` });

async function ouvrirPage(page: Page, chemin = '') {
  await seConnecter(page);
  const planche = await peupler(page);
  await page.goto(`/manifestations/${planche.manifestationId}${chemin}`);
  await expect(page.getByRole('heading', { level: 1, name: planche.manifestation })).toBeVisible({ timeout: 20_000 });
  return planche;
}

test('US-056 CA-1 : la page montre le fil, le nom, les dates, le lieu, « Modifier », « ⋯ » et trois onglets', async ({
  page,
}) => {
  const planche = await ouvrirPage(page);
  await expect(fil(page).getByRole('link', { name: 'Accueil' })).toBeVisible();
  await expect(fil(page).getByText(planche.manifestation)).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('Salle Bellegrave')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Modifier', exact: true })).toBeVisible();
  await expect(menuDe(page, planche.manifestation)).toBeVisible();
  await expect(page.getByRole('tab')).toHaveText(['Compétitions', 'Plan', 'Affiche et feuille de route']);
  await expect(onglet(page, 'Compétitions')).toHaveAttribute('aria-selected', 'true');
});

test('US-056 CA-1 : on l’ouvre depuis le nom de la manifestation sur l’accueil', async ({ page }) => {
  await seConnecter(page);
  const planche = await peupler(page);
  await page.goto('/organisateur');
  await carte(page, planche.manifestation).getByRole('link', { name: planche.manifestation, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/manifestations/${ID}$`));
  await expect(page.getByRole('heading', { level: 1, name: planche.manifestation })).toBeVisible();
});

test('US-056 CA-2 : chaque compétition est une carte avec ses épreuves, « + Épreuves », un crayon et un menu', async ({
  page,
}) => {
  const planche = await ouvrirPage(page);
  const epee = carte(page, planche.competitionEpee);
  await expect(epee).toContainText('Épée');
  await expect(epee.getByRole('list', { name: `Épreuves de ${planche.competitionEpee}` }).getByRole('link')).toHaveText(
    ['M13 Dames', 'M7 Mixte', 'Senior Hommes'],
  );
  await expect(epee.getByRole('link', { name: `Ajouter des épreuves à ${planche.competitionEpee}` })).toBeVisible();
  await expect(epee.getByRole('button', { name: `Modifier ${planche.competitionEpee}` })).toBeVisible();
  await expect(menuDe(page, planche.competitionEpee)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nouvelle compétition' })).toBeVisible();

  await epee.getByRole('link', { name: 'M13 Dames' }).click();
  await expect(page).toHaveURL(new RegExp(`/epreuves/${ID}$`));
});

test('US-056 CA-2 et US-079 CA-3 : le menu d’une compétition propose Modifier, Ajouter des épreuves, la publication, puis Supprimer…', async ({
  page,
}) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const planche = await ouvrirPage(page);
  await menuDe(page, planche.competitionSabre).click();
  const entrees = page.getByRole('menu').getByRole('menuitem');
  await expect(entrees.first()).toContainText('Modifier');
  const libelles = await entrees.allInnerTexts();
  expect(libelles[1]).toContain('Ajouter des épreuves');
  expect(libelles.at(-1)).toContain('Supprimer…');
  // US-079 CA-3 et CA-4 : entre les deux, « Publier / Dépublier toutes les épreuves », selon l'état des épreuves.
  for (const libelle of libelles.slice(2, -1))
    expect(libelle).toMatch(/(Publier|Dépublier) toutes les épreuves|Tout reprendre en main/);
});

test('US-056 CA-3 : l’onglet « Plan » affiche le plan de la manifestation, à son adresse', async ({ page }) => {
  const planche = await ouvrirPage(page);
  await onglet(page, 'Plan').click();
  await expect(page).toHaveURL(new RegExp(`/manifestations/${ID}/plan$`));
  await expect(onglet(page, 'Plan')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toContainText(planche.competitionEpee);
  await expect(
    page
      .getByRole('tabpanel')
      .getByRole('button', { name: /M13 Dames/ })
      .first(),
  ).toBeVisible();
});

test('US-056 CA-4 : l’onglet « Affiche et feuille de route » affiche les documents, à son adresse', async ({
  page,
}) => {
  await ouvrirPage(page);
  await onglet(page, 'Affiche et feuille de route').click();
  await expect(page).toHaveURL(new RegExp(`/manifestations/${ID}/documents$`));
  await expect(page.getByRole('tabpanel')).toContainText(/Affiche/);
});

test('US-056 CA-5 : un onglet se rouvre au rechargement, et les flèches changent d’onglet', async ({ page }) => {
  await ouvrirPage(page, '/plan');
  await expect(onglet(page, 'Plan')).toHaveAttribute('aria-selected', 'true');
  await page.reload();
  await expect(onglet(page, 'Plan')).toHaveAttribute('aria-selected', 'true');

  await onglet(page, 'Plan').focus();
  await page.keyboard.press('ArrowRight');
  await expect(onglet(page, 'Affiche et feuille de route')).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(new RegExp(`/documents$`));
  await page.keyboard.press('ArrowRight');
  await expect(onglet(page, 'Compétitions')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(onglet(page, 'Affiche et feuille de route')).toHaveAttribute('aria-selected', 'true');
});

test('US-056 CA-5 : « Voir le plan » de l’accueil mène à l’onglet « Plan »', async ({ page }) => {
  await seConnecter(page);
  const planche = await peupler(page);
  await page.goto('/organisateur');
  await carte(page, planche.manifestation)
    .getByRole('link', { name: `Voir le plan de ${planche.manifestation}` })
    .click();
  await expect(page).toHaveURL(new RegExp(`/manifestations/${ID}/plan$`));
  await expect(onglet(page, 'Plan')).toHaveAttribute('aria-selected', 'true');
});

test('US-056 CA-6 : l’ancienne page « /manifestations » et ses adresses « ?… » redirigent', async ({ page }) => {
  await seConnecter(page);
  const planche = await peupler(page);
  await page.goto('/manifestations');
  await expect(page).toHaveURL(/\/organisateur$/);
  await page.goto('/manifestations?nouvelle');
  await expect(page).toHaveURL(/\/manifestations\/nouvelle$/);
  await page.goto(`/manifestations?modifier=${planche.manifestationId}`);
  await expect(page).toHaveURL(new RegExp(`/manifestations/${planche.manifestationId}\\?modifier$`));
  await expect(page.getByRole('form').or(page.getByRole('heading', { name: /^Modifier / }))).toBeVisible();
  await page.goto(`/manifestations?competition=${planche.manifestationId}`);
  await expect(page).toHaveURL(new RegExp(`/manifestations/${planche.manifestationId}\\?competition=nouvelle$`));
});

test('US-056 CA-6 : plus aucun lien de l’application ne mène à une liste « Manifestations »', async ({ page }) => {
  const planche = await ouvrirPage(page);
  for (const chemin of ['/organisateur', `/manifestations/${planche.manifestationId}`]) {
    await ouvrirDansLApplication(page, chemin);
    const liens = await page.locator('a[href="/manifestations"], a[href^="/manifestations?"]').count();
    expect(liens, chemin).toBe(0);
  }
  await expect(page.getByText('Toutes les manifestations')).toHaveCount(0);
});

test('US-056 CA-7 : « Modifier » ouvre le formulaire sur la page, et l’enregistrement y ramène', async ({ page }) => {
  const planche = await ouvrirPage(page);
  await page.getByRole('button', { name: 'Modifier', exact: true }).click();
  await expect(page).toHaveURL(/\?modifier$/);
  await expect(page.getByRole('heading', { name: `Modifier « ${planche.manifestation} »` })).toBeVisible();
  await page.getByLabel('Lieu').fill('Gymnase des Arènes');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page).toHaveURL(new RegExp(`/manifestations/${ID}$`));
  await expect(page.getByText('Gymnase des Arènes')).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Modifier « / })).toHaveCount(0);
});

test('US-056 CA-7 : « Nouvelle compétition » et « Modifier <nom> » ouvrent leur formulaire sur la page', async ({
  page,
}) => {
  const planche = await ouvrirPage(page);
  await page.getByRole('button', { name: 'Nouvelle compétition' }).click();
  await expect(page).toHaveURL(/\?competition=nouvelle$/);
  const nouvelle = `Dames ${planche.competitionVide}`;
  await page.getByLabel('Nom de la compétition').fill(nouvelle);
  await page.getByLabel('Arme').selectOption('fleuret');
  await page.getByRole('button', { name: 'Créer la compétition' }).click();
  await expect(page).toHaveURL(new RegExp(`/manifestations/${ID}$`));
  await expect(carte(page, nouvelle)).toBeVisible({ timeout: 20_000 });

  await carte(page, nouvelle)
    .getByRole('button', { name: `Modifier ${nouvelle}` })
    .click();
  await expect(page).toHaveURL(new RegExp(`\\?competition=${ID}$`));
  await page.getByLabel('Nom de la compétition').fill(`${nouvelle} bis`);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(carte(page, `${nouvelle} bis`)).toBeVisible({ timeout: 20_000 });
});

test('US-056 hors ligne : la page reste affichée ; « Modifier », « Nouvelle compétition » et le crayon sont grisés, « + Épreuves » reste possible', async ({
  page,
  context,
}) => {
  const planche = await ouvrirPage(page);
  await context.setOffline(true);
  await expect(page.getByRole('button', { name: 'Modifier', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Nouvelle compétition' })).toBeDisabled();
  await expect(page.getByRole('button', { name: `Modifier ${planche.competitionEpee}` })).toBeDisabled();
  await expect(page.getByText('Nécessite une connexion internet').first()).toBeVisible();
  await carte(page, planche.competitionEpee)
    .getByRole('link', { name: `Ajouter des épreuves à ${planche.competitionEpee}` })
    .click();
  await expect(page).toHaveURL(new RegExp(`/competitions/${ID}/epreuves$`));
  await context.setOffline(false);
});

test('US-056 cas limite : une manifestation inconnue ou supprimée affiche « Cette manifestation n’existe plus »', async ({
  page,
}) => {
  await ouvrirPage(page);
  await ouvrirDansLApplication(page, '/manifestations/inconnue-0000');
  await expect(page.getByText('Cette manifestation n’existe plus')).toBeVisible({ timeout: 20_000 });
  await page.getByRole('link', { name: 'Retour à l’accueil' }).click();
  await expect(page).toHaveURL(/\/organisateur$/);
});

test('US-056 cas limite : une manifestation sans compétition ne montre que « Nouvelle compétition »', async ({
  page,
}) => {
  await seConnecter(page);
  const nom = `Vide ${crypto.randomUUID().slice(0, 8)}`;
  const { manifestationId } = await creerManifestation(page, { nom, debut: '2027-03-14', fin: '2027-03-15' });
  await page.goto(`/manifestations/${manifestationId}`);
  await expect(page.getByRole('heading', { level: 1, name: nom })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('article')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Nouvelle compétition' })).toBeVisible();
  await expect(page.getByText('14 et 15 mars 2027')).toBeVisible();
});

test('US-056 cas limite : le fil d’une épreuve mène à la page de la manifestation ; une compétition seule n’est pas un lien', async ({
  page,
}) => {
  // US-061 : sous 40 rem, la page d'une épreuve a une flèche de retour et une barre d'onglets au lieu du fil et de la navigation.
  await page.setViewportSize({ width: 1100, height: 900 });
  const planche = await ouvrirPage(page);
  await carte(page, planche.competitionEpee).getByRole('link', { name: 'M13 Dames' }).click();
  await expect(page).toHaveURL(new RegExp(`/epreuves/${ID}$`));
  await fil(page).getByRole('link', { name: planche.manifestation }).click();
  await expect(page).toHaveURL(new RegExp(`/manifestations/${planche.manifestationId}$`));
});

test('US-056 CA-8 : conforme à la planche 2 (menu « ⋯ » de la première compétition ouvert)', async ({ page }, info) => {
  test.skip(info.project.name !== 'pc', 'La planche est à 1360 px : projet « pc » seulement');
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  await page.setViewportSize({ width: 1360, height: 1000 });
  const planche: Planche = await ouvrirPage(page);

  // Structure : fil, titre, infos, actions, onglets, cartes, zone en pointillés.
  const boite = async (selecteur: ReturnType<Page['locator']>) => (await selecteur.boundingBox())!;
  const filBoite = await boite(fil(page));
  const titre = await boite(page.getByRole('heading', { level: 1 }));
  const modifier = await boite(page.getByRole('button', { name: 'Modifier', exact: true }));
  const menu = await boite(menuDe(page, planche.manifestation));
  const premier = await boite(onglet(page, 'Compétitions'));
  const dernier = await boite(onglet(page, 'Affiche et feuille de route'));
  const cartes = await page.getByRole('article').all();
  const premiereCarte = await boite(cartes[0]!);
  const derniereCarte = await boite(cartes[cartes.length - 1]!);
  const nouvelle = await boite(page.getByRole('button', { name: 'Nouvelle compétition' }));

  expect(filBoite.y).toBeLessThan(titre.y);
  expect(titre.y).toBeLessThan(premier.y);
  expect(modifier.x).toBeGreaterThan(titre.x + titre.width);
  expect(menu.x).toBeGreaterThan(modifier.x);
  expect(Math.abs(modifier.y - menu.y)).toBeLessThan(8);
  expect(premier.x).toBeLessThan(dernier.x);
  expect(premier.y).toBeLessThan(premiereCarte.y);
  expect(derniereCarte.y + derniereCarte.height).toBeLessThan(nouvelle.y);
  // Colonne centrée de 1040 px : titre et cartes alignés à gauche, « ⋯ » du bandeau à droite.
  expect(Math.abs(titre.x - premiereCarte.x)).toBeLessThan(4);
  expect(Math.abs(premiereCarte.width - 1040)).toBeLessThan(8);
  expect(Math.abs(menu.x + menu.width - (premiereCarte.x + premiereCarte.width))).toBeLessThan(4);

  // Onglet actif : texte et trait en --accent ; zone « Nouvelle compétition » en pointillés.
  const styles = await page.evaluate(() => {
    const resoudre = (variable: string) => {
      const sonde = document.createElement('span');
      sonde.style.color = `var(${variable})`;
      document.body.append(sonde);
      const couleur = getComputedStyle(sonde).color;
      sonde.remove();
      return couleur;
    };
    const actif = document.querySelector('[role="tab"][aria-selected="true"]') as HTMLElement;
    const zone = [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('Nouvelle compétition'))!;
    return {
      accent: resoudre('--accent'),
      texteActif: getComputedStyle(actif).color,
      traitActif: getComputedStyle(actif).borderBottomColor,
      pointilles: getComputedStyle(zone).borderTopStyle,
    };
  });
  expect(styles.texteActif).toBe(styles.accent);
  expect(styles.traitActif).toBe(styles.accent);
  expect(styles.pointilles).toBe('dashed');

  // Menu de la première compétition : Modifier, Ajouter des épreuves, (US-079) la publication de toutes les épreuves,
  // séparateur, Supprimer… en rouge.
  await menuDe(page, planche.competitionEpee).click();
  const ouvert = page.getByRole('menu');
  await expect(ouvert.getByRole('menuitem').first()).toContainText('Modifier');
  const libelles = await ouvert.getByRole('menuitem').allInnerTexts();
  expect(libelles[1]).toMatch(/^\s*Ajouter des épreuves/);
  expect(libelles.at(-1)).toMatch(/^\s*Supprimer…/);
  for (const libelle of libelles.slice(2, -1))
    expect(libelle).toMatch(/(Publier|Dépublier) toutes les épreuves|Tout reprendre en main/);
  await expect(ouvert.getByRole('separator')).toHaveCount(1);

  const capture = await page.screenshot({ path: process.env.CAPTURE_MANIFESTATION });
  await info.attach('manifestation.png', { body: capture, contentType: 'image/png' });
});
