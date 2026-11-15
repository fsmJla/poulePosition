// Plan du lieu dans le récapitulatif de la manifestation (US-071) : tuiles OpenStreetMap interceptées (aucun appel réel ; la
// garde du niveau « interface » refuse leur domaine), à l'étape « Vérifier » de l'assistant et sur la page de la manifestation.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { ouvrirDepuisCreer } from './creer';

const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const ADRESSE = { label: 'Allée de Bellegrave 33600 Pessac', coordinates: [-0.633445, 44.812712] };

/** Intercepte le service d'adresses et les tuiles ; retourne les tuiles demandées. */
async function simuler(page: Page, tuiles: 'png' | 'refus' = 'png') {
  const demandees: string[] = [];
  await page.route('**/data.geopf.fr/geocodage/search/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        features: [{ geometry: { coordinates: ADRESSE.coordinates }, properties: { label: ADRESSE.label } }],
      }),
    }),
  );
  await page.route('**/*.tile.openstreetmap.org/**', (route) => {
    demandees.push(route.request().url());
    return tuiles === 'png'
      ? route.fulfill({
          status: 200,
          contentType: 'image/png',
          headers: { 'access-control-allow-origin': '*' },
          body: PNG,
        })
      : route.abort();
  });
  return demandees;
}

/**
 * Crée une manifestation par l'assistant, avec une adresse choisie dans les suggestions (ou un lieu libre), une compétition,
 * et arrive à l'étape « Vérifier ».
 */
async function jusqueAVerifier(page: Page, lieu: 'adresse' | string = 'adresse') {
  test.setTimeout(120_000);
  await seConnecter(page);
  await page.goto('/organisateur');
  await ouvrirDepuisCreer(page, 'Créer une manifestation');
  await expect(page.getByRole('heading', { level: 1, name: 'La manifestation' })).toBeVisible();
  const manifestation = nomUnique();
  await page.getByLabel('Nom', { exact: true }).fill(manifestation);
  await page.getByLabel('Date de début').fill('2027-03-14');
  await page.getByLabel('Date de fin').fill('2027-03-15');
  const champ = page.getByRole('combobox', { name: /Lieu/ });
  if (lieu === 'adresse') {
    await champ.fill('bellegrave');
    await page.getByRole('option', { name: ADRESSE.label }).click();
  } else {
    await champ.fill(lieu);
  }
  await page.getByRole('button', { name: 'Suivant : Compétitions' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Les compétitions du week-end' })).toBeVisible({
    timeout: 20_000,
  });
  const competition = nomUnique();
  await page.getByLabel('Nom de la compétition').fill(competition);
  await page.getByRole('button', { name: 'Sabre', exact: true }).click();
  await page.getByRole('button', { name: 'Ajouter la compétition' }).click();
  await expect(page.getByText(`Compétition « ${competition} » créée`)).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Suivant : Épreuves' }).click();
  await page.getByRole('button', { name: 'Plus tard' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Vérifier le plan' })).toBeVisible();
  return manifestation;
}

const plan = (page: Page) => page.getByRole('img', { name: /^Plan du lieu/ });

test('US-071 CA-1 : à l’étape « Vérifier » et sur la page de la manifestation, un plan de 200 px centré sur le lieu, avec attribution', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  const demandees = await simuler(page);
  const manifestation = await jusqueAVerifier(page);
  await expect(plan(page)).toBeVisible();
  await expect(plan(page).locator('img').first()).toBeVisible();
  const hauteur = (await plan(page).boundingBox())!.height;
  expect(hauteur).toBeGreaterThanOrEqual(195);
  expect(hauteur).toBeLessThanOrEqual(210);
  expect(demandees.length).toBeGreaterThan(0);
  expect(demandees.every((url) => /^https:\/\/[abc]\.tile\.openstreetmap\.org\/16\/\d+\/\d+\.png$/.test(url))).toBe(
    true,
  );
  await expect(page.getByRole('link', { name: '© OpenStreetMap contributors' })).toBeVisible();

  await page.getByRole('button', { name: 'Terminer' }).click();
  await expect(page.getByRole('heading', { level: 1, name: manifestation })).toBeVisible({ timeout: 20_000 });
  await expect(plan(page)).toBeVisible();
  await expect(page.getByText(ADRESSE.label).first()).toBeVisible();
});

test('US-071 CA-2 : le lien ouvre le lieu sur OpenStreetMap, dans un nouvel onglet', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  await simuler(page);
  await jusqueAVerifier(page);
  const lien = page.getByRole('link', { name: 'Ouvrir dans une application de cartes' });
  await expect(lien).toHaveAttribute(
    'href',
    'https://www.openstreetmap.org/?mlat=44.812712&mlon=-0.633445#map=17/44.812712/-0.633445',
  );
  await expect(lien).toHaveAttribute('target', '_blank');
  await expect(lien).toHaveAttribute('rel', /noopener/);
});

test('US-071 CA-3 : un lieu saisi à la main n’a ni plan ni zone vide, et ne demande aucune tuile', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  const demandees = await simuler(page);
  const manifestation = await jusqueAVerifier(page, 'Gymnase du club');
  await expect(plan(page)).toHaveCount(0);
  await expect(page.getByText('Plan indisponible')).toHaveCount(0);
  await page.getByRole('button', { name: 'Terminer' }).click();
  await expect(page.getByRole('heading', { level: 1, name: manifestation })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Gymnase du club').first()).toBeVisible();
  await expect(plan(page)).toHaveCount(0);
  expect(demandees).toHaveLength(0);
});

test('US-071 CA-4 : des tuiles indisponibles remplacent le plan par « Plan indisponible », la page reste utilisable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  await simuler(page, 'refus');
  const manifestation = await jusqueAVerifier(page);
  await expect(page.getByText('Plan indisponible')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Terminer' })).toBeEnabled();
  await page.getByRole('button', { name: 'Terminer' }).click();
  await expect(page.getByRole('heading', { level: 1, name: manifestation })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(ADRESSE.label).first()).toBeVisible();
});

test('US-071 CA-5 : thème sombre et 390 px, le plan tient dans la largeur sans défilement horizontal', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 390, height: 844 });
  await simuler(page);
  await jusqueAVerifier(page);
  await expect(plan(page)).toBeVisible();
  const boite = (await plan(page).boundingBox())!;
  expect(boite.x + boite.width).toBeLessThanOrEqual(390);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // Le plan ne capte aucun geste : le doigt fait défiler la page.
  expect(await plan(page).evaluate((e) => getComputedStyle(e).pointerEvents)).toBe('none');
});

test('US-071 hors ligne : le plan est remplacé par « Plan disponible en ligne », le texte du lieu reste', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1000, height: 900 });
  await simuler(page);
  await jusqueAVerifier(page);
  await expect(plan(page)).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText('Plan disponible en ligne')).toBeVisible();
  await expect(plan(page)).toHaveCount(0);
  await context.setOffline(false);
  await expect(plan(page)).toBeVisible();
});
