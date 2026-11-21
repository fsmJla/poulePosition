// US-131 : sauvegarde automatique des épreuves pilotées dans un dossier choisi (clé USB). Le sélecteur de dossier du
// système n'est pas pilotable : un faux dossier, en mémoire de la page, remplace `showDirectoryPicker`. La reprise après
// un redémarrage du navigateur (CA-6) et l'écriture sûre (CA-4) sont couvertes par `sauvegarde-auto.test.ts`.
import { expect, test, type Page } from '@playwright/test';
import { boutonMenuCompte, seConnecter } from './compte';

const MOTIF_PAGE_EPREUVE = /\/epreuves\/[0-9a-f-]{36}$/;

/** Remplace le sélecteur de dossier par un faux dossier « CLE-USB » ; `panne` simule une clé retirée. */
async function fauxDossier(page: Page) {
  await page.addInitScript(() => {
    const etat = { fichiers: {} as Record<string, string>, panne: false };
    (window as unknown as { __sauvegarde: typeof etat }).__sauvegarde = etat;
    (window as unknown as { showDirectoryPicker: () => Promise<unknown> }).showDirectoryPicker = async () => ({
      name: 'CLE-USB',
      queryPermission: async () => 'granted',
      requestPermission: async () => 'granted',
      getFileHandle: async (nom: string) => ({
        createWritable: async () => {
          let tampon = '';
          return {
            write: async (donnees: Blob) => {
              if (etat.panne) throw new DOMException('Clé retirée', 'NotFoundError');
              tampon += await donnees.text();
            },
            close: async () => {
              etat.fichiers[nom] = tampon;
            },
            abort: async () => {},
          };
        },
      }),
    });
  });
}

/** Nombre d'événements du journal sauvegardé dans le faux dossier, ou 0. */
const evenementsSauvegardes = (page: Page, nom: string) =>
  page.evaluate((fichier) => {
    const contenu = (window as unknown as { __sauvegarde: { fichiers: Record<string, string> } }).__sauvegarde.fichiers[
      fichier
    ];
    return contenu ? (JSON.parse(contenu) as { journal: unknown[] }).journal.length : 0;
  }, nom);

async function creerEpreuve(page: Page) {
  const suffixe = crypto.randomUUID().slice(0, 8);
  await page.goto('/epreuves/nouvelle?seule');
  await page.getByLabel('Nom de la compétition et de son épreuve').fill(`E2E ${suffixe}`);
  await page.getByLabel('Arme').selectOption('sabre');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(MOTIF_PAGE_EPREUVE);
  return { fichier: `e2e-${suffixe}.poule.json`, suffixe };
}

async function ouvrirFenetre(page: Page) {
  await boutonMenuCompte(page).click();
  await page.getByRole('button', { name: 'Sauvegarde automatique…' }).click();
  return page.getByRole('dialog', { name: 'Sauvegarde automatique' });
}

test('US-131 CA-1, CA-2 et CA-8 : dossier choisi, épreuve écrite aussitôt puis après chaque modification, hors ligne compris', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  await fauxDossier(page);
  await seConnecter(page);
  const { fichier, suffixe } = await creerEpreuve(page);

  const fenetre = await ouvrirFenetre(page);
  await expect(fenetre.getByRole('status')).toHaveText(/Aucun dossier choisi/);
  await fenetre.getByRole('button', { name: 'Choisir un dossier' }).click();
  await expect(fenetre.getByRole('status')).toContainText('Sauvegarde automatique active dans « CLE-USB »');
  await expect(fenetre.getByRole('status')).toContainText(/Dernière sauvegarde à \d+ h \d{2}/);
  await expect.poll(() => evenementsSauvegardes(page, fichier)).toBeGreaterThan(0);
  const avant = await evenementsSauvegardes(page, fichier);
  await fenetre.getByRole('button', { name: 'Fermer' }).click();

  // CA-2 : hors ligne, une modification est sauvegardée en 30 s au plus.
  await context.setOffline(true);
  await page.getByRole('link', { name: 'Modifier', exact: true }).click();
  // Un autre nom, de même nom de fichier : le fichier de l'épreuve reste le même.
  await page.getByLabel('Nom', { exact: true }).fill(`E2E-${suffixe}`);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page).toHaveURL(MOTIF_PAGE_EPREUVE);
  await expect.poll(() => evenementsSauvegardes(page, fichier), { timeout: 40_000 }).toBe(avant + 1);

  // CA-8 : « Arrêter » ; les fichiers déjà écrits restent.
  await context.setOffline(false);
  const deNouveau = await ouvrirFenetre(page);
  await deNouveau.getByRole('button', { name: 'Arrêter' }).click();
  await expect(deNouveau.getByRole('status')).toHaveText(/Aucun dossier choisi/);
  expect(await evenementsSauvegardes(page, fichier)).toBe(avant + 1);
});

test('US-131 CA-5 : clé retirée, un bandeau le signale et l’épreuve continue ; la sauvegarde reprend seule', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await fauxDossier(page);
  await seConnecter(page);
  const { fichier, suffixe } = await creerEpreuve(page);
  const fenetre = await ouvrirFenetre(page);
  await fenetre.getByRole('button', { name: 'Choisir un dossier' }).click();
  await expect.poll(() => evenementsSauvegardes(page, fichier)).toBeGreaterThan(0);
  await fenetre.getByRole('button', { name: 'Fermer' }).click();

  await page.evaluate(() => {
    (window as unknown as { __sauvegarde: { panne: boolean } }).__sauvegarde.panne = true;
  });
  await page.getByRole('link', { name: 'Modifier', exact: true }).click();
  await page.getByLabel('Nom', { exact: true }).fill(`e2e ${suffixe}`);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page).toHaveURL(MOTIF_PAGE_EPREUVE);
  const bandeau = page.getByRole('status').filter({ hasText: 'Sauvegarde automatique impossible' });
  await expect(bandeau).toBeVisible({ timeout: 40_000 });
  await expect(bandeau.getByRole('button', { name: 'Choisir un dossier' })).toBeVisible();

  await page.evaluate(() => {
    (window as unknown as { __sauvegarde: { panne: boolean } }).__sauvegarde.panne = false;
  });
  await expect(bandeau).toBeHidden({ timeout: 15_000 });
});

test('US-131 CA-7 : sans l’API du navigateur, l’entrée est grisée avec son explication', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker;
  });
  await seConnecter(page);
  await boutonMenuCompte(page).click();
  const entree = page.locator('[aria-disabled="true"]').filter({ hasText: 'Sauvegarde automatique…' });
  await expect(entree).toBeVisible();
  await expect(entree).toHaveAttribute(
    'title',
    'Disponible sur Chrome et Edge : exportez l’épreuve à la main (menu ⋯)',
  );
  await expect(page.getByRole('button', { name: 'Sauvegarde automatique…' })).toHaveCount(0);
});
