// Exporter une épreuve dans un fichier (US-034) : « Exporter » du menu « ⋯ » de l'épreuve, fichier `.poule.json` avec le
// journal, la description du rattachement et les fichiers joints ; enregistrement choisi (Chrome, Edge) ou téléchargé.
import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { pdfValide, pngUnique } from './fichiers-types';
import { ajouterCompetition, creerManifestationSimple, nomUnique, ouvrirManifestation } from './planche';

const menuDe = (page: Page, nom: string) => page.getByRole('button', { name: `Autres actions pour ${nom}` });

/** Crée une manifestation, une compétition et une épreuve pilotée par ce PC ; ouvre la page de l'épreuve. */
async function creerEpreuvePilotee(page: Page) {
  const manifestation = nomUnique();
  const competition = nomUnique();
  const epreuve = `${competition} M13`;
  await creerManifestationSimple(page, manifestation);
  await ajouterCompetition(page, manifestation, competition);
  await ouvrirManifestation(page, manifestation, 'plan');
  await page.getByRole('button', { name: `Ajouter une épreuve à ${competition}, dimanche 14 mars 2027` }).click();
  await expect(page.getByLabel('Compétition', { exact: true })).not.toHaveValue('');
  await page.getByLabel('Nom', { exact: true }).fill(epreuve);
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  return { manifestation, competition, epreuve, epreuveUrl: page.url() };
}

async function exporter(page: Page, epreuve: string) {
  await menuDe(page, epreuve).click();
  await page.getByRole('menuitem', { name: /^Exporter/ }).click();
}

/** Sans l'API File System Access : le fichier est téléchargé. */
const sansSelecteur = (page: Page) =>
  page.addInitScript(() => delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker);

test('US-034 CA-1, CA-3 et CA-4 : « Exporter » télécharge <nom>-<date>.poule.json avec le journal et le rattachement', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await sansSelecteur(page);
  await seConnecter(page);
  const { manifestation, competition, epreuve } = await creerEpreuvePilotee(page);

  const telechargement = page.waitForEvent('download');
  await exporter(page, epreuve);
  const fichier = await telechargement;
  expect(fichier.suggestedFilename()).toMatch(/^.+-\d{4}-\d{2}-\d{2}-\d{2}h\d{2}\.poule\.json$/);
  const contenu = JSON.parse(await readFile((await fichier.path())!, 'utf8')) as {
    format: string;
    version: number;
    epreuveId: string;
    clubId: string;
    journal: { seq: number; type: string }[];
    competition: { nom: string };
    manifestation: { nom: string; debut: string; fin: string };
    fichiers: unknown[];
  };
  expect(contenu).toMatchObject({ format: 'poule-position-epreuve', version: 1 });
  expect(contenu.epreuveId).toMatch(/^[0-9a-f-]{36}$/);
  expect(contenu.clubId).not.toBe('');
  expect(contenu.journal[0]).toMatchObject({ seq: 1, type: 'EpreuveCreee' });
  expect(contenu.competition.nom).toBe(competition);
  expect(contenu.manifestation).toMatchObject({ nom: manifestation, debut: '2027-03-14' });
  expect(contenu.fichiers).toEqual([]);

  const retour = page.locator('[data-retour="export"]');
  await expect(retour).toContainText('a été téléchargé');
  // Cas limite : le fichier contient des données personnelles, un rappel l'indique.
  await expect(retour).toContainText('noms des tireurs');
});

test('US-034 CA-4 : sous Chrome ou Edge, l’application propose de choisir l’emplacement', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    const fenetre = window as unknown as {
      __propose?: { suggestedName: string };
      __ecrit?: Blob[];
      showSaveFilePicker?: unknown;
    };
    fenetre.__ecrit = [];
    fenetre.showSaveFilePicker = async (options: { suggestedName: string }) => {
      fenetre.__propose = options;
      return {
        createWritable: async () => ({
          write: async (blob: Blob) => void fenetre.__ecrit!.push(blob),
          close: async () => {},
        }),
      };
    };
  });
  await seConnecter(page);
  const { epreuve } = await creerEpreuvePilotee(page);
  await exporter(page, epreuve);
  await expect(page.locator('[data-retour="export"]')).toContainText('exportée dans le fichier');
  const propose = await page.evaluate(() => (window as unknown as { __propose: { suggestedName: string } }).__propose);
  expect(propose.suggestedName).toMatch(/\.poule\.json$/);
  const texte = await page.evaluate(() => (window as unknown as { __ecrit: Blob[] }).__ecrit[0]!.text());
  expect(JSON.parse(texte)).toMatchObject({ format: 'poule-position-epreuve' });
});

test('US-034 CA-4 : fermer le sélecteur n’enregistre rien', async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => {
    (window as unknown as { showSaveFilePicker: unknown }).showSaveFilePicker = async () => {
      throw new DOMException('fermé', 'AbortError');
    };
  });
  await seConnecter(page);
  const { epreuve } = await creerEpreuvePilotee(page);
  await exporter(page, epreuve);
  await expect(page.locator('[data-retour="export"]')).toContainText('Export annulé');
});

test('US-034 CA-2 : l’affiche et la feuille de route de l’épreuve et de sa manifestation sont incluses, en base64', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await sansSelecteur(page);
  await seConnecter(page);
  const { manifestation, epreuve, epreuveUrl } = await creerEpreuvePilotee(page);
  // Affiche de la manifestation (héritée par l'épreuve) et feuille de route de l'épreuve.
  await ouvrirManifestation(page, manifestation, 'documents');
  const documents = page.getByRole('region', { name: 'Documents' });
  await expect(documents).toBeVisible();
  const affiche = page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().includes('/affiche'));
  await documents.locator('[data-sorte="affiche"] input[type="file"]').setInputFiles(pngUnique());
  expect((await affiche).status()).toBe(201);
  await page.goto(epreuveUrl);
  const feuille = page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().includes('/feuilleDeRoute'));
  await page
    .getByRole('region', { name: 'Documents' })
    .locator('[data-sorte="feuilleDeRoute"] input[type="file"]')
    .setInputFiles(pdfValide(1));
  expect((await feuille).status()).toBe(201);

  const telechargement = page.waitForEvent('download');
  await exporter(page, epreuve);
  const chemin = await (await telechargement).path();
  const contenu = JSON.parse(await readFile(chemin!, 'utf8')) as {
    fichiers: { proprietaire: string; sorte: string; type: string; contenu: string }[];
  };
  const parSorte = Object.fromEntries(contenu.fichiers.map((f) => [f.sorte, f]));
  expect(parSorte.affiche).toMatchObject({ proprietaire: 'manifestation' });
  expect(parSorte.feuilleDeRoute).toMatchObject({ proprietaire: 'epreuve', type: 'pdf' });
  // Le contenu est du base64 d'un vrai PDF.
  expect(Buffer.from(parSorte.feuilleDeRoute!.contenu, 'base64').subarray(0, 5).toString()).toBe('%PDF-');
});

test('US-034 hors ligne : l’export marche sans réseau, depuis le journal et les copies de l’appareil', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await sansSelecteur(page);
  await seConnecter(page);
  const { epreuve, competition } = await creerEpreuvePilotee(page);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await context.setOffline(true);
  const telechargement = page.waitForEvent('download');
  await exporter(page, epreuve);
  const chemin = await (await telechargement).path();
  const contenu = JSON.parse(await readFile(chemin!, 'utf8')) as {
    journal: unknown[];
    competition: { nom: string } | null;
  };
  expect(contenu.journal.length).toBeGreaterThanOrEqual(1);
  // La compétition est connue grâce à la copie gardée sur l'appareil.
  expect(contenu.competition?.nom).toBe(competition);
});
