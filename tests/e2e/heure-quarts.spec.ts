// Horaires à 9 h 00 par défaut et minutes par quart d'heure (US-069) : le champ d'heure est formé de deux listes (heures,
// minutes) dans le formulaire d'épreuve et, pour l'appel de chaque jour, dans la grille des épreuves.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { ouvrirNouvelleEpreuve } from './creer';
import { regler } from './heure';
import { ajouterCompetition, creerManifestationSimple, ouvrirManifestation } from './planche';

const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;
const CHAMPS = ['Appel', 'Scratch', 'Début des poules'];
const heures = (page: Page, champ: string) => page.getByLabel(`${champ} — heures`, { exact: true });
const minutes = (page: Page, champ: string) => page.getByLabel(`${champ} — minutes`, { exact: true });

async function ouvrirFormulaire(page: Page) {
  await seConnecter(page);
  await ouvrirNouvelleEpreuve(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nouvelle épreuve');
  await page
    .getByLabel('Compétition', { exact: true })
    .selectOption({ label: 'Nouvelle compétition seule (en ligne)' });
}

async function ouvrirLaGrille(page: Page) {
  const manifestation = nomUnique();
  const competition = nomUnique();
  await creerManifestationSimple(page, manifestation);
  await ajouterCompetition(page, manifestation, competition, 'sabre');
  await ouvrirManifestation(page, manifestation);
  await page.getByRole('link', { name: `Ajouter des épreuves à ${competition}` }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Ajouter des épreuves' })).toBeVisible();
}

test('US-069 CA-1 : à la création, appel, scratch et début des poules proposent 9 h 00', async ({ page }) => {
  await ouvrirFormulaire(page);
  for (const champ of CHAMPS) {
    await expect(heures(page, champ)).toHaveValue('09');
    await expect(minutes(page, champ)).toHaveValue('00');
  }
});

test('US-069 CA-1 : dans la grille, l’appel de chaque jour part de 9 h 00 et un jour réglé n’est pas écrasé', async ({
  page,
}) => {
  await seConnecter(page);
  await ouvrirLaGrille(page);
  const appels = page.getByRole('group', { name: /^Appel du / });
  await expect(appels.first()).toBeVisible();
  const total = await appels.count();
  expect(total).toBeGreaterThan(0);
  for (let i = 0; i < total; i++) {
    await expect(appels.nth(i).getByRole('combobox').first()).toHaveValue('09');
  }
  if (total > 1) {
    await regler(page, (await appels.nth(1).getAttribute('aria-label'))!, '08:45');
    await expect(appels.nth(0).getByRole('combobox').first()).toHaveValue('09');
    await expect(appels.nth(1).getByRole('combobox').first()).toHaveValue('08');
  }
});

test('US-069 CA-2 : les heures vont de 00 à 23, les minutes se limitent à 00, 15, 30 et 45', async ({ page }) => {
  await ouvrirFormulaire(page);
  const optionsHeures = await heures(page, 'Appel').locator('option').allTextContents();
  expect(optionsHeures).toEqual(['Aucune heure', ...Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))]);
  await expect(minutes(page, 'Appel').locator('option')).toHaveText(['00', '15', '30', '45']);
  await regler(page, 'Appel', '23:45');
  await expect(heures(page, 'Appel')).toHaveValue('23');
  await expect(minutes(page, 'Appel')).toHaveValue('45');
});

test('US-069 CA-3 : « Aucune heure » efface l’horaire, l’épreuve s’enregistre sans', async ({ page }) => {
  await ouvrirFormulaire(page);
  await page.getByLabel('Nom').fill(nomUnique());
  await page.getByLabel('Arme').selectOption('sabre');
  for (const champ of CHAMPS) await regler(page, champ, '');
  await expect(minutes(page, 'Appel')).toBeDisabled();
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  await expect(page.getByText('09:00')).toHaveCount(0);
  await page.getByRole('link', { name: 'Modifier', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Modifier l’épreuve');
  for (const champ of CHAMPS) await expect(heures(page, champ)).toHaveValue('');
});

test('US-069 CA-5 : le scratch avant l’appel est encore refusé, trois horaires égaux à 9 h 00 sont valides', async ({
  page,
}) => {
  await ouvrirFormulaire(page);
  await page.getByLabel('Nom').fill(nomUnique());
  await page.getByLabel('Arme').selectOption('epee');
  await regler(page, 'Scratch', '08:45');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page.getByText('Le scratch doit être après l’appel')).toBeVisible();
  await expect(heures(page, 'Scratch')).toHaveAttribute('aria-invalid', 'true');
  await regler(page, 'Scratch', '09:00');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
});

test('US-069 CA-6 : deux listes nommées par champ, réglées au clavier', async ({ page }) => {
  await ouvrirFormulaire(page);
  for (const champ of CHAMPS) {
    await expect(page.getByRole('group', { name: champ, exact: true })).toBeVisible();
    await expect(heures(page, champ)).toBeVisible();
    await expect(minutes(page, champ)).toBeVisible();
  }
  await heures(page, 'Appel').focus();
  await page.keyboard.press('ArrowDown');
  await expect(heures(page, 'Appel')).toHaveValue('10');
  await page.keyboard.press('Tab');
  await expect(minutes(page, 'Appel')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(minutes(page, 'Appel')).toHaveValue('15');
});

test('US-069 hors ligne : le réglage des horaires fonctionne réseau coupé', async ({ page, context }) => {
  await ouvrirFormulaire(page);
  await context.setOffline(true);
  await regler(page, 'Appel', '10:30');
  await expect(heures(page, 'Appel')).toHaveValue('10');
  await expect(minutes(page, 'Appel')).toHaveValue('30');
});
