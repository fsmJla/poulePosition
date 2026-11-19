// Accès par QR code (US-096, planche 21) : section « Accès par QR code » de la page Paramètres, avec deux QR codes
// (arbitres, tireurs), leur lien, « Copier le lien », « Régénérer… » et l'impression ; hors ligne, les QR gardés sur ce
// PC restent affichés et imprimables.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';

const MOTIF_PAGE_EPREUVE = /\/epreuves\/[0-9a-f-]{36}$/;
const MOTIF_LIEN = /\/saisie\/[0-9a-f-]{36}#j=[A-Za-z0-9_-]{22}$/;

async function epreuvePilotee(page: Page): Promise<string> {
  await page.goto('/epreuves/nouvelle?seule');
  await page.getByLabel('Nom de la compétition et de son épreuve').fill('M13 Dames');
  await page.getByLabel('Arme').selectOption('sabre');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(MOTIF_PAGE_EPREUVE);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
  return page.url();
}

const section = (page: Page) => page.getByRole('region', { name: 'Accès par QR code' });
const lien = (page: Page, role: 'Arbitres' | 'Tireurs') => section(page).getByLabel(`Lien des ${role.toLowerCase()}`);

test('US-096 CA-1, CA-2 et CA-7 : deux QR codes, leur lien et l’impression, conformes à la planche 21', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1360, height: 1660 });
  await seConnecter(page);
  const adresse = await epreuvePilotee(page);
  await page.goto(`${adresse}/parametres`);

  await expect(section(page).getByRole('heading', { level: 3, name: 'Accès par QR code' })).toBeVisible();
  for (const role of ['Arbitres', 'Tireurs'] as const) {
    await expect(
      section(page).getByRole('img', { name: `QR code des ${role.toLowerCase()} de M13 Dames` }),
    ).toBeVisible({
      timeout: 20_000,
    });
    await expect(lien(page, role)).toHaveText(MOTIF_LIEN);
    await expect(section(page).getByRole('heading', { level: 4, name: role })).toBeVisible();
  }
  expect(await lien(page, 'Arbitres').textContent()).not.toBe(await lien(page, 'Tireurs').textContent());
  await expect(section(page).getByRole('button', { name: 'Copier le lien' })).toHaveCount(2);
  await expect(section(page).getByRole('button', { name: 'Régénérer…' })).toHaveCount(2);
  // Planche 21 : l'accès vient avant les droits, l'impression en est l'action principale.
  const boites = await Promise.all([
    section(page).boundingBox(),
    page.getByRole('group', { name: 'Arbitres' }).boundingBox(),
  ]);
  expect(boites[0]!.y).toBeLessThan(boites[1]!.y);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const chemin = process.env.CAPTURE;
  const capture = await page.screenshot({ fullPage: true, ...(chemin ? { path: chemin } : {}) });
  await testInfo.attach('planche-21', { body: capture, contentType: 'image/png' });
});

test('US-096 CA-3 : « Imprimer les QR codes » ouvre une page A4 avec l’épreuve, les deux QR et leur mode d’emploi', async ({
  page,
}) => {
  await page.addInitScript(() => {
    (window as unknown as { impressions: number }).impressions = 0;
    window.print = () => void ((window as unknown as { impressions: number }).impressions += 1);
  });
  await seConnecter(page);
  const adresse = await epreuvePilotee(page);
  await page.goto(`${adresse}/parametres`);
  await expect(lien(page, 'Tireurs')).toHaveText(MOTIF_LIEN, { timeout: 20_000 });
  await section(page).getByRole('button', { name: 'Imprimer les QR codes' }).click();
  await expect(page).toHaveURL(/\/acces\/imprimer$/);
  await expect(page.getByRole('heading', { level: 1, name: 'M13 Dames' })).toBeVisible();
  await expect(page.getByRole('img', { name: /^QR code des (arbitres|tireurs) de M13 Dames$/ })).toHaveCount(2);
  await expect(page.getByText('Arbitres : scannez pour saisir les scores de votre piste.')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as unknown as { impressions: number }).impressions)).toBe(1);
});

test('US-096 CA-4 et CA-5 : régénérer change le seul lien concerné ; tireurs sans saisie signalés', async ({
  page,
}) => {
  await seConnecter(page);
  const adresse = await epreuvePilotee(page);
  await page.goto(`${adresse}/parametres`);
  await expect(lien(page, 'Arbitres')).toHaveText(MOTIF_LIEN, { timeout: 20_000 });
  const avantArbitres = await lien(page, 'Arbitres').textContent();
  const avantTireurs = await lien(page, 'Tireurs').textContent();

  await section(page).getByRole('button', { name: 'Régénérer…' }).first().click();
  const confirmation = section(page).getByRole('group', { name: 'Régénérer le QR code des arbitres ?' });
  await confirmation.getByRole('button', { name: 'Régénérer', exact: true }).click();
  await expect(lien(page, 'Arbitres')).not.toHaveText(avantArbitres!);
  await expect(lien(page, 'Arbitres')).toHaveText(MOTIF_LIEN);
  await expect(lien(page, 'Tireurs')).toHaveText(avantTireurs!);

  // CA-5 : sans droit de saisie pour les tireurs, leur QR reste là, avec une mention.
  for (const reglage of ['Saisir les scores des matchs de sa poule', 'Saisir le score de ses matchs de tableau']) {
    await page.getByLabel(reglage).uncheck();
  }
  await page.getByRole('button', { name: 'Enregistrer les paramètres' }).click();
  await expect(page.getByText('Paramètres enregistrés')).toBeVisible();
  await page.reload();
  await expect(section(page).getByText('Les tireurs ne peuvent pas saisir (Paramètres)')).toBeVisible({
    timeout: 20_000,
  });
  await expect(lien(page, 'Tireurs')).toHaveText(avantTireurs!);
});

test('US-096 hors ligne : les QR gardés restent affichés et imprimables, « Régénérer » demande une connexion', async ({
  page,
  context,
}) => {
  await seConnecter(page);
  const adresse = await epreuvePilotee(page);
  await page.goto(`${adresse}/parametres`);
  await expect(lien(page, 'Arbitres')).toHaveText(MOTIF_LIEN, { timeout: 20_000 });
  const arbitres = await lien(page, 'Arbitres').textContent();

  await context.setOffline(true);
  await page.reload();
  await expect(lien(page, 'Arbitres')).toHaveText(arbitres!, { timeout: 20_000 });
  for (const bouton of await section(page).getByRole('button', { name: 'Régénérer…' }).all()) {
    await expect(bouton).toBeDisabled();
  }
  await expect(section(page).getByText('Nécessite une connexion').first()).toBeVisible();
  await page.evaluate(() => (window.print = () => {}));
  await section(page).getByRole('button', { name: 'Imprimer les QR codes' }).click();
  await expect(page.getByRole('img', { name: /^QR code des (arbitres|tireurs) de M13 Dames$/ })).toHaveCount(2);
});
