// Import des tireurs depuis le fichier d'inscription de la Fédération (US-083) : XML Engarde / BellePoule lu sur
// l'appareil, aperçu (nouveaux, déjà inscrits, homonymes, écartés), import, hors ligne.
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';

const FICHIER = fileURLToPath(new URL('./donnees/inscription-ffe.xml', import.meta.url));
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

/** Une compétition seule et son épreuve Dames au sabre, pilotée par ce PC ; ouvre l'étape « Inscriptions ». */
async function ouvrirInscriptions(page: Page) {
  await page.goto('/epreuves/nouvelle?seule');
  await page.getByLabel('Nom de la compétition et de son épreuve').fill(nomUnique());
  await page.getByLabel('Arme').selectOption('sabre');
  await page.getByLabel('Sexe').selectOption('dames');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  await page.goto(`${page.url()}/inscriptions`);
  await expect(page.getByRole('heading', { level: 2, name: 'Inscriptions' })).toBeVisible({ timeout: 20_000 });
}

async function ajouter(page: Page, nom: string, prenom: string, club: string) {
  await page.getByLabel('Nom', { exact: true }).fill(nom);
  await page.getByLabel('Prénom', { exact: true }).fill(prenom);
  await page.getByLabel('Club', { exact: true }).fill(club);
  await page.getByLabel('Club', { exact: true }).press('Enter');
}

const lignes = (page: Page) => page.getByRole('region', { name: 'Liste des inscrits' }).locator('tbody tr');
const choisirFichier = (page: Page) =>
  page.getByLabel('Fichier d’inscription (XML Engarde / BellePoule)').setInputFiles(FICHIER);

test('US-083 CA-1 à CA-4 : aperçu (nouveaux, homonyme à cocher, écartés), puis import', async ({ page }) => {
  test.setTimeout(90_000);
  await seConnecter(page);
  await ouvrirInscriptions(page);
  // Un homonyme sans licence déjà inscrit.
  await ajouter(page, 'PETIT', 'Louise', 'Bayonne');
  await expect(lignes(page)).toHaveCount(1);

  await choisirFichier(page);
  const apercu = page.getByRole('dialog');
  await expect(apercu).toContainText('5 tireurs dans le fichier');
  await expect(apercu).toContainText('3 nouveaux');
  await expect(apercu).toContainText('1 homonyme');
  await apercu.getByText('1 écarté').click();
  await expect(apercu).toContainText('DURAND Paul : Sexe différent de l’épreuve');
  // CA-2 : l'homonyme n'est inscrit que coché.
  await expect(apercu.getByRole('button', { name: 'Importer 3 tireurs' })).toBeVisible();
  await apercu.getByRole('checkbox').check();
  await apercu.getByRole('button', { name: 'Importer 4 tireurs' }).click();

  await expect(apercu).toHaveCount(0);
  await expect(page.getByRole('status').filter({ hasText: '4 tireurs inscrits, 1 écarté' })).toHaveCount(1);
  await expect(lignes(page)).toHaveCount(5);
  // Accents lus depuis l'ISO-8859-1 ; classement repris ; trié par classement.
  await expect(lignes(page).first()).toContainText('MARTIN');
  await expect(lignes(page).first()).toContainText('Léa');
  await expect(page.getByRole('region', { name: 'Liste des inscrits' })).toContainText('MÉRIGNAC');
});

test('US-083 CA-3 : un second import du même fichier ne crée pas de doublon (même licence)', async ({ page }) => {
  test.setTimeout(90_000);
  await seConnecter(page);
  await ouvrirInscriptions(page);
  await choisirFichier(page);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Importer \d+ tireurs?$/ })
    .click();
  await expect(lignes(page)).toHaveCount(4);

  await choisirFichier(page);
  const apercu = page.getByRole('dialog');
  await expect(apercu).toContainText('0 nouveau');
  await expect(apercu).toContainText('3 déjà inscrits (même licence)');
  await apercu.getByRole('button', { name: 'Annuler' }).click();
  await expect(lignes(page)).toHaveCount(4);
});

test('US-083 CA-5 : un fichier qui n’est pas au format est refusé, rien n’est importé', async ({ page }) => {
  test.setTimeout(60_000);
  await seConnecter(page);
  await ouvrirInscriptions(page);
  await page.getByLabel('Fichier d’inscription (XML Engarde / BellePoule)').setInputFiles({
    name: 'inscrits.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('NOM;PRENOM\nDUBOIS;Chloé'),
  });
  await expect(page.getByText('Ce fichier n’est pas un fichier d’inscription individuelle')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('US-083 hors ligne : le fichier se lit et s’importe sans réseau, envoyé au retour du réseau', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await seConnecter(page);
  await ouvrirInscriptions(page);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });

  await context.setOffline(true);
  await choisirFichier(page);
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /^Importer \d+ tireurs?$/ })
    .click();
  await expect(lignes(page)).toHaveCount(4);
  await expect(page.getByText(/en attente d’envoi/)).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 30_000 });
});
