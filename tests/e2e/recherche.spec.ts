// Recherche dans l'entête (US-062, planches 1 et 5) : champ « Rechercher une épreuve, une compétition… » sur écran large,
// loupe sur écran étroit, résultats groupés au fil de la frappe, ouverture d'un résultat, archivées, hors ligne. La
// recherche se fait sur l'appareil, dans la liste du club. Le compte local est administrateur.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { ajouterEpreuve, exposerServeur, peupler, type Planche } from './planche';

const LARGE = { width: 1360, height: 900 };
const ETROIT = { width: 390, height: 844 };
const NOM_CHAMP = 'Rechercher une épreuve, une compétition…';

const champ = (page: Page) => page.getByRole('combobox', { name: NOM_CHAMP });
const resultats = (page: Page) => page.getByRole('listbox', { name: 'Résultats de la recherche' });
const groupe = (page: Page, nom: string) => resultats(page).getByRole('group', { name: nom });
/** Ce qui est propre à ce test : le suffixe unique de la planche, présent dans tous ses noms. */
const suffixe = (planche: Planche) => planche.manifestation.replace('Championnats ', '');

async function accueil(page: Page): Promise<Planche> {
  await page.setViewportSize(LARGE);
  await seConnecter(page);
  const planche = await peupler(page);
  await page.goto('/organisateur');
  await expect(page.getByRole('article', { name: planche.manifestation })).toBeVisible({ timeout: 30_000 });
  return planche;
}

async function chercher(page: Page, saisie: string) {
  await champ(page).fill(saisie);
}

test('US-062 CA-1 : un champ de recherche dans l’entête sur écran large, une loupe sur écran étroit', async ({
  page,
}) => {
  await accueil(page);
  const entete = page.getByRole('banner');
  await expect(champ(page)).toBeVisible();
  await expect(champ(page)).toHaveAttribute('placeholder', NOM_CHAMP);
  await expect(entete.getByRole('button', { name: 'Rechercher', exact: true })).toHaveCount(0);

  await page.setViewportSize(ETROIT);
  await expect(champ(page)).toBeHidden();
  const loupe = entete.getByRole('button', { name: 'Rechercher', exact: true });
  await expect(loupe).toBeVisible();
  await expect(loupe).toHaveAttribute('aria-expanded', 'false');
  await loupe.click();
  await expect(champ(page)).toBeVisible();
  await expect(champ(page)).toBeFocused();
  const boite = (await champ(page).boundingBox())!;
  expect(boite.width).toBeGreaterThan(250);
  expect(boite.x + boite.width).toBeLessThanOrEqual(390);
  // La barre ouverte se ferme par son bouton, et la loupe revient.
  await page.getByRole('button', { name: 'Fermer la recherche' }).click();
  await expect(champ(page)).toBeHidden();
  await expect(loupe).toBeVisible();
});

test('US-062 CA-2 : les résultats s’affichent au fil de la frappe, groupés, avec leur contexte ; un caractère ne suffit pas', async ({
  page,
}) => {
  const planche = await accueil(page);
  const s = suffixe(planche);
  await chercher(page, s.slice(0, 1));
  await expect(resultats(page)).toHaveCount(0);

  await chercher(page, s);
  await expect(resultats(page)).toBeVisible();
  await expect(champ(page)).toHaveAttribute('aria-expanded', 'true');
  // Une manifestation, trois compétitions, quatre épreuves portent ce suffixe.
  await expect(groupe(page, 'Manifestations').getByRole('option')).toHaveCount(1);
  await expect(groupe(page, 'Compétitions').getByRole('option')).toHaveCount(3);
  await expect(groupe(page, 'Épreuves').getByRole('option')).toHaveCount(4);
  // Contexte : une compétition dit sa manifestation et son arme ; une épreuve, sa compétition et son arme.
  await expect(
    groupe(page, 'Compétitions').getByRole('option', { name: new RegExp(planche.competitionEpee) }),
  ).toContainText(`${planche.manifestation} · Épée`);
  const dames = groupe(page, 'Épreuves').getByRole('option', {
    name: new RegExp(`${planche.competitionEpee} M13 Dames`),
  });
  await expect(dames).toContainText(planche.competitionEpee);
  await expect(dames).toContainText('Épée');
  // Le champ suit le motif combobox.
  await expect(champ(page)).toHaveAttribute('aria-autocomplete', 'list');
  await expect(champ(page)).toHaveAttribute('aria-controls', /.+/);
});

test('US-062 CA-3 : la recherche ignore la casse et les accents, et exige tous les mots saisis', async ({ page }) => {
  const planche = await accueil(page);
  const s = suffixe(planche);
  await chercher(page, `EPEE dames ${s}`);
  const epreuves = groupe(page, 'Épreuves').getByRole('option');
  await expect(epreuves).toHaveCount(1);
  await expect(epreuves.first()).toContainText('M13 Dames');
  // Un mot absent exclut tout.
  await chercher(page, `epee escrimeur ${s}`);
  await expect(page.getByText(/Aucun résultat pour/)).toBeVisible();
  // L'arme se cherche aussi : « sabre » trouve l'épreuve de la compétition de sabre.
  await chercher(page, `${s} sabre`);
  await expect(groupe(page, 'Épreuves').getByRole('option', { name: /Sans catégorie/ })).toBeVisible();
});

test('US-062 CA-4 : ouvrir un résultat (clic, ou flèches puis Entrée) ; Échap ferme la liste', async ({ page }) => {
  const planche = await accueil(page);
  const s = suffixe(planche);

  // Clic sur une manifestation : sa page.
  await chercher(page, s);
  await groupe(page, 'Manifestations').getByRole('option').click();
  await expect(page).toHaveURL(new RegExp(`/manifestations/${planche.manifestationId}$`));

  // Clic sur une compétition de manifestation : la page de sa manifestation.
  await chercher(page, s);
  await groupe(page, 'Compétitions')
    .getByRole('option', { name: new RegExp(planche.competitionSabre) })
    .click();
  await expect(page).toHaveURL(new RegExp(`/manifestations/${planche.manifestationId}$`));

  // Flèches puis Entrée sur une épreuve : sa page. Les épreuves viennent après les manifestations et les compétitions.
  await chercher(page, `${s} M13 dames`);
  await expect(groupe(page, 'Épreuves').getByRole('option')).toHaveCount(1);
  for (let rang = 0; rang < 1; rang += 1) await champ(page).press('ArrowDown');
  await expect(champ(page)).toHaveAttribute('aria-activedescendant', /.+/);
  await champ(page).press('Enter');
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);

  // Échap ferme la liste, sans ouvrir de page.
  await page.goto('/organisateur');
  await chercher(page, s);
  await expect(resultats(page)).toBeVisible();
  await champ(page).press('Escape');
  await expect(resultats(page)).toHaveCount(0);
  await expect(champ(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(page).toHaveURL(/\/organisateur$/);
});

test('US-062 CA-4 : une compétition seule s’ouvre dépliée sur l’accueil', async ({ page }) => {
  await accueil(page);
  const nom = `Seule ${crypto.randomUUID().slice(0, 8)}`;
  await exposerServeur(page);
  const { urlServeur, jeton } = await page.evaluate(async () => {
    const base = await new Promise<IDBDatabase>((ok, ko) => {
      const ouverture = indexedDB.open('poulePosition');
      ouverture.onsuccess = () => ok(ouverture.result);
      ouverture.onerror = () => ko(ouverture.error);
    });
    const session = await new Promise<{ jeton: string }>((ok) => {
      const lecture = base.transaction('session').objectStore('session').get('courante');
      lecture.onsuccess = () => ok(lecture.result);
    });
    base.close();
    return { jeton: session.jeton, urlServeur: (window as unknown as { __urlServeur: string }).__urlServeur };
  });
  const creation = await page.request.post(`${urlServeur}/competitions`, {
    headers: { Authorization: `Bearer ${jeton}`, 'Content-Type': 'application/json' },
    data: { manifestationId: null, nom, arme: 'epee', commentaire: null },
  });
  expect(creation.ok()).toBe(true);
  await page.goto('/organisateur');
  await expect(page.getByRole('button', { name: new RegExp(`^${nom}`) })).toBeVisible({ timeout: 30_000 });
  // On la replie, on cherche, et le choix du résultat la déplie.
  const ligne = page.getByRole('button', { name: new RegExp(`^${nom}`) });
  await ligne.click();
  await expect(ligne).toHaveAttribute('aria-expanded', 'false');
  await chercher(page, nom);
  await groupe(page, 'Compétitions')
    .getByRole('option', { name: new RegExp(nom) })
    .click();
  await expect(page).toHaveURL(/\/organisateur$/);
  await expect(ligne).toHaveAttribute('aria-expanded', 'true');
});

test('US-062 CA-5 : une saisie sans correspondance le dit', async ({ page }) => {
  await accueil(page);
  await chercher(page, 'zzqqxx');
  await expect(resultats(page)).toBeVisible();
  await expect(resultats(page)).toContainText('Aucun résultat pour « zzqqxx »');
  await expect(resultats(page).getByRole('option')).toHaveCount(0);
});

test('US-062 CA-6 : les épreuves archivées viennent après les autres, avec la mention « Archivée »', async ({
  page,
}) => {
  const planche = await accueil(page);
  const s = suffixe(planche);
  await ajouterEpreuve(page, planche.competitionSabreId, `${planche.competitionSabre} Archive`, '2026-01-10', {
    statut: 'archivee',
  });
  await page.goto('/organisateur');
  await expect(page.getByRole('article', { name: planche.manifestation })).toBeVisible({ timeout: 30_000 });
  await chercher(page, s);
  const epreuves = groupe(page, 'Épreuves').getByRole('option');
  await expect(epreuves).toHaveCount(5);
  // L'archivée est la dernière, les autres ne portent pas la mention.
  await expect(epreuves.last()).toContainText('Archive');
  await expect(epreuves.last()).toContainText('Archivée');
  await expect(epreuves.first()).not.toContainText('Archivée');
});

test('US-062 hors ligne : la recherche se fait sur l’appareil et n’envoie aucune requête', async ({
  page,
  context,
}) => {
  const planche = await accueil(page);
  const s = suffixe(planche);
  // Une première saisie charge la liste ; ensuite, plus aucun appel n'est nécessaire.
  await chercher(page, s);
  await expect(groupe(page, 'Épreuves').getByRole('option')).toHaveCount(4);
  await champ(page).fill('');
  await context.setOffline(true);
  const requetes: string[] = [];
  page.on('request', (requete) => requetes.push(requete.url()));
  await chercher(page, `epee dames ${s}`);
  await expect(groupe(page, 'Épreuves').getByRole('option')).toHaveCount(1);
  await chercher(page, `${s} sabre`);
  await expect(groupe(page, 'Épreuves').getByRole('option', { name: /Sans catégorie/ })).toBeVisible();
  expect(requetes).toEqual([]);
  await context.setOffline(false);
});

test('US-062 hors ligne : une page ouverte sans réseau cherche dans les copies de l’appareil', async ({
  page,
  context,
}) => {
  const planche = await accueil(page);
  const s = suffixe(planche);
  // L'accueil a gardé la copie de l'index ; le réseau se coupe avant la première recherche.
  await context.setOffline(true);
  await page.evaluate(() => {
    history.pushState(null, '', '/organisateur');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await chercher(page, s);
  await expect(groupe(page, 'Épreuves').getByRole('option')).toHaveCount(4, { timeout: 20_000 });
  await context.setOffline(false);
});

test('US-062 cas limite : la liste du club n’est pas encore chargée', async ({ page }) => {
  await page.setViewportSize(LARGE);
  await seConnecter(page);
  await page.route('**/epreuves', async (route) => {
    if (route.request().method() === 'GET') await new Promise((ok) => setTimeout(ok, 2_500));
    await route.continue();
  });
  await page.goto('/epreuves/nouvelle');
  await expect(champ(page)).toBeEnabled();
  await chercher(page, 'abc');
  await expect(page.getByText('Chargement de la liste…')).toBeVisible();
});

test('US-062 CA-7 : conforme à l’entête des planches 1 (champ) et 5 (loupe)', async ({ page }, testInfo) => {
  await accueil(page);
  const entete = page.getByRole('banner');
  // Planche 1 (1360 px) : le champ suit la marque, avant « Créer » ; 464 × 40 px, fond clair.
  const marque = (await entete.getByRole('link', { name: 'Poule Position' }).boundingBox())!;
  const boite = (await champ(page).boundingBox())!;
  const creer = (await entete.getByRole('link', { name: 'Créer', exact: true }).boundingBox())!;
  expect(boite.x).toBeGreaterThan(marque.x + marque.width);
  expect(boite.x + boite.width).toBeLessThan(creer.x);
  expect(boite.width).toBeGreaterThan(380);
  expect(boite.width).toBeLessThanOrEqual(480);
  expect(boite.height).toBeGreaterThanOrEqual(38);
  expect(boite.height).toBeLessThanOrEqual(46);
  const fond = await champ(page).evaluate((element) => getComputedStyle(element).backgroundColor);
  const fondEntete = await entete.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(fond).not.toBe(fondEntete);
  await testInfo.attach('1-accueil-champ.png', { body: await page.screenshot(), contentType: 'image/png' });

  // Planche 5 (390 px) : la loupe est à droite de la marque, avant le menu de compte.
  await page.setViewportSize(ETROIT);
  const loupe = (await entete.getByRole('button', { name: 'Rechercher', exact: true }).boundingBox())!;
  const compte = (await entete.getByRole('button', { name: /^Menu du compte/ }).boundingBox())!;
  expect(loupe.x).toBeGreaterThan(200);
  expect(loupe.x + loupe.width).toBeLessThanOrEqual(compte.x);
  expect(loupe.width).toBeGreaterThanOrEqual(44);
  expect(loupe.height).toBeGreaterThanOrEqual(44);
  await testInfo.attach('5-smartphone-loupe.png', { body: await page.screenshot(), contentType: 'image/png' });
});
