// Bandeau « Prochaine étape » du résumé d'une épreuve (US-064) : une phrase et une action, selon la publication et le
// pilote ; conforme aux planches 3 et 6. CA-5 (épreuve terminée ou archivée) et CA-6 (règle extensible) se testent sur
// la règle du domaine (`paquets/domaine/src/prochaine-etape.test.ts`) : aucun écran n'archive ni ne termine encore une
// épreuve (US-033).
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { ajouterCompetition, ajouterEpreuve, creerManifestationSimple } from './planche';

const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;
const MOTIF_PAGE_EPREUVE = /\/epreuves\/([0-9a-f-]{36})$/;
const PHRASE_PUBLIER = 'Publier l’épreuve pour ouvrir le suivi en direct';

const bandeau = (page: Page) => page.getByRole('region', { name: 'Prochaine étape' });

/** Crée une épreuve par le formulaire : ce PC en est le pilote. Ouvre sa page et retourne son identifiant. */
async function creerEpreuvePilote(page: Page) {
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await creerManifestationSimple(page, manifestation, '2026-11-11', '2026-11-12');
  await ajouterCompetition(page, manifestation, competition, 'sabre');
  await page.goto('/epreuves/nouvelle');
  await page.getByLabel('Compétition', { exact: true }).selectOption({ label: `${competition} — ${manifestation}` });
  await page.getByLabel('Nom', { exact: true }).fill(`${competition} M13 Dames`);
  await page.getByLabel('Catégorie').selectOption('M13');
  await page.getByLabel('Sexe').selectOption('dames');
  await page.getByRole('button', { name: 'mercredi 11 novembre 2026' }).click();
  await page.getByLabel('Lieu').fill('Pessac');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(MOTIF_PAGE_EPREUVE);
  await expect(page.getByText('Ce PC est le pilote', { exact: true })).toBeVisible();
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
  return MOTIF_PAGE_EPREUVE.exec(page.url())![1]!;
}

/** Crée une épreuve dont ce compte n'est pas le pilote (créée par l'API) : lecture seule. */
async function ouvrirEpreuveEnLectureSeule(page: Page) {
  const manifestation = nomUnique();
  await seConnecter(page);
  await creerManifestationSimple(page, manifestation);
  const competitionId = await ajouterCompetition(page, manifestation, nomUnique());
  const epreuveId = await ajouterEpreuve(page, competitionId, nomUnique());
  await page.goto(`/epreuves/${epreuveId}`);
  await expect(page.getByText('Lecture seule : cette épreuve est pilotée par un autre PC')).toBeVisible({
    timeout: 20_000,
  });
}

test('US-064 CA-1 et CA-2 : une épreuve non publiée propose « Publier », puis le bandeau passe à « Partager »', async ({
  page,
}) => {
  await creerEpreuvePilote(page);
  const zone = bandeau(page);
  await expect(zone).toBeVisible();
  await expect(zone.getByText('Prochaine étape', { exact: true })).toBeVisible();
  await expect(zone.getByText(PHRASE_PUBLIER)).toBeVisible();
  // Une seule action principale, en tête du résumé (au-dessus des cartes).
  await expect(zone.getByRole('button')).toHaveCount(1);
  const boiteBandeau = (await zone.boundingBox())!;
  const boitePilote = (await page.getByRole('region', { name: 'Pilote' }).boundingBox())!;
  expect(boiteBandeau.y + boiteBandeau.height).toBeLessThanOrEqual(boitePilote.y);

  await zone.getByRole('button', { name: 'Publier' }).click();
  await expect(page.getByRole('region', { name: 'Publication' }).getByText('Publiée', { exact: true })).toBeVisible();
  await expect(zone.getByText('Partager le lien public')).toBeVisible();
  await expect(zone.getByRole('button', { name: 'Copier le lien' })).toBeVisible();
  await expect(zone.getByRole('button', { name: 'Publier' })).toHaveCount(0);
});

test('US-064 CA-3 : une épreuve publiée propose « Copier le lien », qui copie l’adresse publique', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const epreuveId = await creerEpreuvePilote(page);
  await bandeau(page).getByRole('button', { name: 'Publier' }).click();
  await expect(bandeau(page).getByText('Partager le lien public')).toBeVisible();
  await bandeau(page).getByRole('button', { name: 'Copier le lien' }).click();
  await expect(bandeau(page).getByRole('status')).toHaveText('Lien copié');
  const copie = await page.evaluate(() => navigator.clipboard.readText());
  expect(copie).toBe(`${new URL(page.url()).origin}/direct/${epreuveId}`);
});

test('US-064 CA-4 : une épreuve pilotée par un autre PC annonce l’étape sans bouton', async ({ page }) => {
  await ouvrirEpreuveEnLectureSeule(page);
  const zone = bandeau(page);
  await expect(zone.getByText(PHRASE_PUBLIER)).toBeVisible();
  await expect(zone.getByText('À faire depuis le PC pilote.')).toBeVisible();
  await expect(zone.getByRole('button')).toHaveCount(0);
});

test('US-064 hors ligne : le bandeau s’affiche et « Publier » reste possible sur ce PC (journal local)', async ({
  page,
  context,
}) => {
  await creerEpreuvePilote(page);
  await context.setOffline(true);
  const zone = bandeau(page);
  await expect(zone.getByText(PHRASE_PUBLIER)).toBeVisible();
  await expect(zone.getByRole('button', { name: 'Publier' })).toBeEnabled();
  await zone.getByRole('button', { name: 'Publier' }).click();
  await expect(zone.getByText('Partager le lien public')).toBeVisible();
  await expect(page.getByText('Publication en attente d’envoi')).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 30_000 });
});

test('US-064 CA-7 : conforme à la planche 3 (PC pilote, 1360 px)', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 1360, height: 1000 });
  await creerEpreuvePilote(page);
  const zone = bandeau(page);
  await expect(zone.getByText(PHRASE_PUBLIER)).toBeVisible();

  // Fond --marque (#2f4b4a), action tiffany (#0abab5), texte clair ; le bouton est à droite, la phrase à gauche.
  const styles = await zone.evaluate((section) => {
    const bouton = section.querySelector('button')!;
    return {
      fond: getComputedStyle(section).backgroundColor,
      texte: getComputedStyle(section).color,
      fondBouton: getComputedStyle(bouton).backgroundColor,
    };
  });
  expect(styles.fond).toBe('rgb(47, 75, 74)');
  expect(styles.texte).toBe('rgb(247, 244, 239)');
  expect(styles.fondBouton).toBe('rgb(10, 186, 181)');
  const phrase = (await zone.getByText(PHRASE_PUBLIER).boundingBox())!;
  const bouton = (await zone.getByRole('button', { name: 'Publier' }).boundingBox())!;
  const boite = (await zone.boundingBox())!;
  expect(phrase.x).toBeLessThan(bouton.x);
  expect(bouton.x + bouton.width).toBeGreaterThan(boite.x + boite.width - 40);
  await testInfo.attach('3-epreuve-bandeau.png', { body: await page.screenshot(), contentType: 'image/png' });
});

test('US-064 CA-7 : conforme à la planche 6 (lecture seule, 390 px)', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ colorScheme: 'light' });
  await page.setViewportSize({ width: 390, height: 844 });
  await ouvrirEpreuveEnLectureSeule(page);
  const zoneEtroite = bandeau(page);
  await expect(zoneEtroite.getByText('À faire depuis le PC pilote.')).toBeVisible();
  expect(await zoneEtroite.evaluate((section) => getComputedStyle(section).backgroundColor)).toBe('rgb(47, 75, 74)');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true,
  );
  await testInfo.attach('6-smartphone-epreuve-bandeau.png', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});
