// Import des équipes depuis un fichier CSV (US-156) : lecture sur l'appareil (ISO-8859-1), aperçu (équipes à créer,
// tireurs à inscrire, équipes écartées), import, fichier refusé, verrou après le lancement, hors ligne.
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { repartir } from './poules-outils';

const FICHIER = fileURLToPath(new URL('./donnees/equipes.csv', import.meta.url));
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;
const ENTETE = 'Équipe;Nom 1;Prénom 1;Nom 2;Prénom 2';

/** Une épreuve seule d'épée, pilotée par ce PC ; ouvre l'étape « Inscriptions » (onglet « Équipes » si par équipes). */
async function ouvrirEquipes(page: Page, type: 'equipes2' | 'individuelle' = 'equipes2'): Promise<string> {
  await page.goto('/epreuves/nouvelle?seule');
  await page.getByLabel('Nom de la compétition et de son épreuve').fill(nomUnique());
  await page.getByLabel('Arme').selectOption('epee');
  if (type !== 'individuelle') await page.getByLabel('Type').selectOption(type);
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  const adresse = page.url();
  await page.goto(`${adresse}/inscriptions`);
  await expect(page.getByRole('heading', { level: 2, name: 'Inscriptions' })).toBeVisible({ timeout: 20_000 });
  if (type !== 'individuelle') await page.getByRole('tab', { name: /^Équipes/ }).click();
  return adresse;
}

type Fichier = string | { name: string; mimeType: string; buffer: Buffer };
const choisir = (page: Page, fichier: Fichier = FICHIER) =>
  page.getByLabel('Fichier d’équipes (CSV)').setInputFiles(fichier);
const csv = (...lignes: string[]): Fichier => ({
  name: 'equipes.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from([ENTETE, ...lignes].join('\n'), 'utf8'),
});
const listeEquipes = (page: Page) => page.getByRole('region', { name: /^Équipes · rangées/ });

test('US-156 CA-1 à CA-4 : aperçu (créées, à inscrire, écartées avec motif), puis import', async ({ page }, info) => {
  test.skip(info.project.name !== 'pc', 'Équipes : projet « pc » seulement');
  test.setTimeout(90_000);
  await seConnecter(page);
  await ouvrirEquipes(page);

  await choisir(page);
  const apercu = page.getByRole('dialog', { name: 'Importer des équipes' });
  await expect(apercu).toContainText('5 équipes dans le fichier');
  await expect(apercu).toContainText('2 équipes à créer');
  await expect(apercu).toContainText('4 tireurs à inscrire, 0 déjà inscrit');
  await apercu.getByText('3 écartées').click();
  await expect(apercu).toContainText('Bravo : Une autre équipe porte déjà ce nom');
  await expect(apercu).toContainText('Charlie : Nombre de titulaires différent du type d’épreuve');
  await expect(apercu).toContainText('Delta : Le même tireur apparaît deux fois dans l’équipe');
  await apercu.getByRole('button', { name: 'Importer 2 équipes' }).click();

  await expect(apercu).toHaveCount(0);
  await expect(
    page.getByRole('status').filter({ hasText: '2 équipes créées, 4 tireurs inscrits, 3 écartées' }),
  ).toHaveCount(1);
  const liste = listeEquipes(page);
  await expect(liste.getByRole('listitem', { name: 'Alpha' })).toContainText('PESSAC SPUC');
  // Accents lus depuis l'ISO-8859-1 ; club commun, sinon « Mixte ».
  await expect(liste.getByRole('listitem', { name: 'Alpha' })).toContainText('Anaïs');
  await expect(liste.getByRole('listitem', { name: 'Bravo' })).toContainText('Mixte');
  await expect(page.getByRole('tab', { name: /^Tireurs/ })).toContainText('4');

  // Un second import du même fichier ne crée rien : les noms d'équipe sont pris.
  await choisir(page);
  await expect(apercu).toContainText('0 équipe à créer');
  await expect(apercu.getByRole('button', { name: 'Importer 0 équipe' })).toBeDisabled();
  await apercu.getByRole('button', { name: 'Annuler' }).click();
  await expect(liste.getByRole('listitem')).toHaveCount(2);
});

test('US-156 CA-5 : un fichier qui n’est pas au format est refusé, rien n’est importé', async ({ page }, info) => {
  test.skip(info.project.name !== 'pc', 'Équipes : projet « pc » seulement');
  test.setTimeout(60_000);
  await seConnecter(page);
  await ouvrirEquipes(page);
  await choisir(page, {
    name: 'inscrits.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('NOM;PRENOM\nDUBOIS;Chloé', 'utf8'),
  });
  const alerte = page.getByRole('alert').filter({ hasText: 'Ce fichier n’est pas un fichier d’équipes' });
  await expect(alerte).toContainText('Colonnes manquantes : Équipe, Nom 1');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('US-156 CA-1 : une épreuve individuelle n’a ni onglet « Équipes » ni import d’équipes', async ({ page }, info) => {
  test.skip(info.project.name !== 'pc', 'Équipes : projet « pc » seulement');
  test.setTimeout(60_000);
  await seConnecter(page);
  await ouvrirEquipes(page, 'individuelle');
  await expect(page.getByRole('tab', { name: /^Équipes/ })).toHaveCount(0);
  await expect(page.getByLabel('Fichier d’équipes (CSV)')).toHaveCount(0);
});

test('US-156 CA-6 : après le lancement des poules, le bouton d’import est absent', async ({ page }, info) => {
  test.skip(info.project.name !== 'pc', 'Équipes : projet « pc » seulement');
  test.setTimeout(150_000);
  await seConnecter(page);
  const adresse = await ouvrirEquipes(page);
  await expect(page.getByRole('button', { name: 'Importer un fichier…' })).toBeVisible();
  await choisir(
    page,
    csv(
      'A1;DUBOIS;Chloé;MARTIN;Léa',
      'A2;ROUX;Eva;FAURE;Clara',
      'A3;NOËL;Paul;MERCIER;Jade',
      'A4;LEROY;Anaïs;GIRARD;Zoé',
    ),
  );
  await page
    .getByRole('dialog', { name: 'Importer des équipes' })
    .getByRole('button', { name: 'Importer 4 équipes' })
    .click();
  await expect(listeEquipes(page).getByRole('listitem')).toHaveCount(4);

  // Émarger les 8 tireurs : les équipes sont alors complètes.
  await page.goto(`${adresse}/emargement`);
  for (const [nom, prenom] of [
    ['DUBOIS', 'Chloé'],
    ['MARTIN', 'Léa'],
    ['ROUX', 'Eva'],
    ['FAURE', 'Clara'],
    ['NOËL', 'Paul'],
    ['MERCIER', 'Jade'],
    ['LEROY', 'Anaïs'],
    ['GIRARD', 'Zoé'],
  ]) {
    const ligne = page.getByRole('checkbox', { name: `Présent : ${nom} ${prenom}` });
    await ligne.click();
    await expect(ligne).toHaveAttribute('aria-checked', 'true');
  }
  await page.goto(`${adresse}/formule`);
  await page.getByRole('radio', { name: 'Poules puis tableau' }).check();
  await page.getByRole('button', { name: 'Enregistrer la formule' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Poules puis tableau' })).toBeVisible();
  await repartir(page, adresse);
  await page.getByRole('button', { name: 'Lancer les poules' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lancer les poules' }).click();
  await expect(page.getByRole('heading', { level: 3, name: /^Feuille de la poule 1/ })).toBeVisible();

  await page.goto(`${adresse}/inscriptions`);
  await page.getByRole('tab', { name: /^Équipes/ }).click();
  await expect(listeEquipes(page)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Importer un fichier…' })).toHaveCount(0);
  await expect(page.getByLabel('Fichier d’équipes (CSV)')).toHaveCount(0);
});

test('US-156 hors ligne : le fichier se lit et s’importe sans réseau, envoyé au retour du réseau', async ({
  page,
  context,
}, info) => {
  test.skip(info.project.name !== 'pc', 'Équipes : projet « pc » seulement');
  test.setTimeout(120_000);
  await seConnecter(page);
  await ouvrirEquipes(page);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });

  await context.setOffline(true);
  await choisir(page);
  await page
    .getByRole('dialog', { name: 'Importer des équipes' })
    .getByRole('button', { name: 'Importer 2 équipes' })
    .click();
  await expect(listeEquipes(page).getByRole('listitem')).toHaveCount(2);
  await expect(page.getByText(/en attente d’envoi/)).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 30_000 });
});
