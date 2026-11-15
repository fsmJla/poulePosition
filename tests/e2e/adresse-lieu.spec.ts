// Recherche d'adresse du lieu (US-070, ADR-0025) : suggestions sous le champ « Lieu » de l'assistant de manifestation. Les
// réponses du service de géocodage sont interceptées (aucun appel réel ; la garde du niveau « interface » le refuse).
import { expect, test, type Page, type Route } from '@playwright/test';
import { seConnecter } from './compte';
import { ouvrirDepuisCreer } from './creer';

const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;
const SERVICE = '**/data.geopf.fr/geocodage/search/**';
const ADRESSES = [
  { label: 'Allée de Bellegrave 33600 Pessac', coordinates: [-0.633445, 44.812712] },
  { label: '12 Rue de Bellegrave 33600 Pessac', coordinates: [-0.6301, 44.8101] },
  { label: 'Chemin de Bellegrave 33610 Canéjan', coordinates: [-0.6, 44.78] },
  { label: 'Impasse Bellegrave 33600 Pessac', coordinates: [-0.62, 44.8] },
  { label: 'Place Bellegrave 33600 Pessac', coordinates: [-0.61, 44.81] },
  { label: 'Avenue Bellegrave 33600 Pessac', coordinates: [-0.6, 44.82] },
  { label: 'Sentier Bellegrave 33600 Pessac', coordinates: [-0.59, 44.83] },
];

const geojson = (adresses = ADRESSES) => ({
  type: 'FeatureCollection',
  features: adresses.map(({ label, coordinates }) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates },
    properties: { label },
  })),
});

const repondre = (route: Route, corps: unknown, statut = 200) =>
  route.fulfill({
    status: statut,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(corps),
  });

/** Intercepte le service : retourne le compteur de requêtes et les textes cherchés. */
async function simuler(page: Page, reponse: (texte: string, route: Route) => Promise<void> | void) {
  const recherches: string[] = [];
  await page.route(SERVICE, async (route) => {
    const texte = new URL(route.request().url()).searchParams.get('q') ?? '';
    recherches.push(texte);
    await reponse(texte, route);
  });
  return recherches;
}

async function ouvrirAssistant(page: Page) {
  await seConnecter(page);
  await page.goto('/organisateur');
  await ouvrirDepuisCreer(page, 'Créer une manifestation');
  await expect(page.getByRole('heading', { level: 1, name: 'La manifestation' })).toBeVisible();
  await page.getByLabel('Nom', { exact: true }).fill(nomUnique());
  await page.getByLabel('Date de début').fill('2027-03-14');
  await page.getByLabel('Date de fin').fill('2027-03-15');
}

const lieu = (page: Page) => page.getByRole('combobox', { name: /Lieu/ });
const options = (page: Page) => page.getByRole('listbox', { name: 'Adresses suggérées' }).getByRole('option');
const SUIVANT = 'Suivant : Compétitions';

/** Valide l'étape et retourne le corps envoyé au serveur pour créer la manifestation. */
async function valider(page: Page) {
  const envoi = page.waitForRequest((r) => r.method() === 'POST' && /\/manifestations$/.test(r.url()));
  await page.getByRole('button', { name: SUIVANT }).click();
  return (await envoi).postDataJSON() as Record<string, unknown>;
}

test('US-070 CA-1 : en tapant, au plus 5 adresses sont suggérées après une pause, « Recherche… » pendant la requête', async ({
  page,
}) => {
  const recherches = await simuler(page, async (_texte, route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await repondre(route, geojson());
  });
  await ouvrirAssistant(page);
  await lieu(page).fill('sa');
  await page.waitForTimeout(600);
  expect(recherches).toHaveLength(0);

  await lieu(page).fill('salle bellegrave pessac');
  await expect(page.getByText('Recherche…')).toBeVisible();
  await expect(options(page)).toHaveCount(5);
  await expect(options(page).first()).toHaveText('Allée de Bellegrave 33600 Pessac');
  expect(recherches).toEqual(['salle bellegrave pessac']);
});

test('US-070 CA-2 : choisir une suggestion (clic) remplit le champ et envoie ses coordonnées', async ({ page }) => {
  await simuler(page, (_texte, route) => repondre(route, geojson()));
  await ouvrirAssistant(page);
  await lieu(page).fill('bellegrave');
  await options(page).nth(1).click();
  await expect(lieu(page)).toHaveValue('12 Rue de Bellegrave 33600 Pessac');
  await expect(options(page)).toHaveCount(0);
  const corps = await valider(page);
  expect(corps).toMatchObject({
    lieu: '12 Rue de Bellegrave 33600 Pessac',
    coordonnees: { lat: 44.8101, lon: -0.6301 },
  });
});

test('US-070 CA-2 et CA-6 : au clavier, flèches puis Entrée choisissent ; Échap ferme la liste', async ({ page }) => {
  await simuler(page, (_texte, route) => repondre(route, geojson()));
  await ouvrirAssistant(page);
  await lieu(page).fill('bellegrave');
  await expect(options(page)).toHaveCount(5);
  await expect(lieu(page)).toHaveAttribute('aria-expanded', 'true');
  await lieu(page).press('ArrowDown');
  await lieu(page).press('ArrowDown');
  await expect(options(page).nth(1)).toHaveAttribute('aria-selected', 'true');
  const actif = await options(page).nth(1).getAttribute('id');
  await expect(lieu(page)).toHaveAttribute('aria-activedescendant', actif!);

  await lieu(page).press('Escape');
  await expect(options(page)).toHaveCount(0);
  await expect(lieu(page)).toHaveAttribute('aria-expanded', 'false');

  await lieu(page).fill('bellegrave rue');
  await expect(options(page)).toHaveCount(5);
  await lieu(page).press('ArrowDown');
  await lieu(page).press('Enter');
  await expect(lieu(page)).toHaveValue('Allée de Bellegrave 33600 Pessac');
  const corps = await valider(page);
  expect(corps).toMatchObject({ coordonnees: { lat: 44.812712, lon: -0.633445 } });
});

test('US-070 CA-3 : un lieu libre est enregistré tel quel, sans coordonnées', async ({ page }) => {
  await simuler(page, (_texte, route) => repondre(route, geojson()));
  await ouvrirAssistant(page);
  await lieu(page).fill('Gymnase du club');
  await expect(options(page)).toHaveCount(5);
  const corps = await valider(page);
  expect(corps).toMatchObject({ lieu: 'Gymnase du club' });
  expect(corps).not.toHaveProperty('coordonnees');
});

test('US-070 CA-3 : le texte peut combiner un nom et l’adresse choisie', async ({ page }) => {
  await simuler(page, (_texte, route) => repondre(route, geojson()));
  await ouvrirAssistant(page);
  await lieu(page).fill('bellegrave');
  await options(page).first().click();
  await lieu(page).fill('Salle Bellegrave — Allée de Bellegrave 33600 Pessac');
  const corps = await valider(page);
  expect(corps).toMatchObject({ lieu: 'Salle Bellegrave — Allée de Bellegrave 33600 Pessac' });
});

test('US-070 CA-4 : modifier le texte à la main retire les coordonnées', async ({ page }) => {
  await simuler(page, (_texte, route) => repondre(route, geojson()));
  await ouvrirAssistant(page);
  await lieu(page).fill('bellegrave');
  await options(page).first().click();
  await lieu(page).press('End');
  await page.keyboard.type(' (salle)');
  const corps = await valider(page);
  expect(corps).toMatchObject({ lieu: 'Allée de Bellegrave 33600 Pessac (salle)' });
  expect(corps).not.toHaveProperty('coordonnees');
});

test('US-070 CA-5 : aucune adresse, service en erreur ou injoignable : un message, et la saisie libre continue', async ({
  page,
}) => {
  let mode: 'vide' | 'erreur' | 'coupe' | 'trop' = 'vide';
  const recherches = await simuler(page, async (_texte, route) => {
    if (mode === 'vide') return repondre(route, geojson([]));
    if (mode === 'erreur') return repondre(route, { message: 'boom' }, 500);
    if (mode === 'trop') return repondre(route, {}, 429);
    return route.abort();
  });
  await ouvrirAssistant(page);

  await lieu(page).fill('zzzzzz');
  await expect(page.getByText('Aucune adresse trouvée')).toBeVisible();

  mode = 'erreur';
  await lieu(page).fill('bellegrave 500');
  await expect(page.getByText('Recherche d’adresse indisponible : saisissez le lieu à la main')).toBeVisible();

  mode = 'coupe';
  await lieu(page).fill('bellegrave coupe');
  await expect(page.getByText('Recherche d’adresse indisponible : saisissez le lieu à la main')).toBeVisible();

  // Cas limite : après un refus 429, pas de nouvelle requête pendant quelques secondes.
  mode = 'trop';
  await lieu(page).fill('bellegrave 429');
  await expect(page.getByText('Recherche d’adresse indisponible')).toBeVisible();
  const avant = recherches.length;
  await lieu(page).fill('bellegrave encore');
  await page.waitForTimeout(700);
  expect(recherches).toHaveLength(avant);

  // La saisie libre fonctionne toujours.
  const corps = await valider(page);
  expect(corps).toMatchObject({ lieu: 'bellegrave encore' });
});

test('US-070 cas limite : à la frappe rapide, seule la dernière recherche compte', async ({ page }) => {
  const recherches = await simuler(page, async (texte, route) => {
    // La première réponse arrive après la seconde : elle est périmée.
    if (texte === 'bellegrave') await new Promise((resolve) => setTimeout(resolve, 1200));
    await repondre(route, geojson([{ label: `Résultat pour ${texte}`, coordinates: [-0.6, 44.8] }]));
  });
  await ouvrirAssistant(page);
  await lieu(page).fill('bellegrave');
  await expect.poll(() => recherches.length).toBe(1);
  await lieu(page).fill('bellegrave pessac');
  await expect(options(page)).toHaveText(['Résultat pour bellegrave pessac']);
  await page.waitForTimeout(1500);
  await expect(options(page)).toHaveText(['Résultat pour bellegrave pessac']);
});

test('US-070 hors ligne : le champ reste libre, avec la mention des suggestions en ligne, sans requête', async ({
  page,
  context,
}) => {
  const recherches = await simuler(page, (_texte, route) => repondre(route, geojson()));
  await ouvrirAssistant(page);
  await context.setOffline(true);
  await expect(page.getByText('Suggestions d’adresses disponibles en ligne')).toBeVisible();
  await lieu(page).fill('Gymnase du club hors ligne');
  await page.waitForTimeout(700);
  expect(recherches).toHaveLength(0);
  await expect(lieu(page)).toHaveValue('Gymnase du club hors ligne');
  await expect(options(page)).toHaveCount(0);
});

test('US-070 CA-6 : le champ est un combobox, la liste est une listbox d’options', async ({ page }) => {
  await simuler(page, (_texte, route) => repondre(route, geojson()));
  await ouvrirAssistant(page);
  await expect(lieu(page)).toHaveAttribute('aria-autocomplete', 'list');
  await lieu(page).fill('bellegrave');
  await expect(page.getByRole('listbox', { name: 'Adresses suggérées' })).toBeVisible();
  await expect(options(page).first()).toBeVisible();
});
