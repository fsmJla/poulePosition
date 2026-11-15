// Importer une épreuve depuis un fichier `.poule.json` (US-035) : « Importer une épreuve… » du menu « ⋯ » de la liste, résumé
// à confirmer, reprise sur un PC de secours (autre contexte du navigateur = autre IndexedDB = autre appareil), refus des
// fichiers invalides, prise de main au retour en ligne et journal du serveur qui a continué ailleurs.
import { readFile } from 'node:fs/promises';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { ajouterCompetition, creerManifestationSimple, nomUnique, ouvrirManifestation } from './planche';

const menuDe = (page: Page, nom: string) => page.getByRole('button', { name: `Autres actions pour ${nom}` });
const fenetre = (page: Page) => page.getByRole('dialog');

/** Sans l'API File System Access : l'export est téléchargé. */
const sansSelecteur = (page: Page) =>
  page.addInitScript(() => delete (window as { showSaveFilePicker?: unknown }).showSaveFilePicker);

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
  return { epreuve, epreuveUrl: page.url() };
}

/** Exporte l'épreuve ouverte et renvoie le chemin du fichier téléchargé. */
async function exporter(page: Page, epreuve: string): Promise<string> {
  const telechargement = page.waitForEvent('download');
  await menuDe(page, epreuve).click();
  await page.getByRole('menuitem', { name: /^Exporter/ }).click();
  return (await (await telechargement).path())!;
}

/** PC de secours : un autre contexte du navigateur, connecté au même compte, sur la liste de l'organisateur. */
async function pcDeSecours(browser: Browser, baseURL: string | undefined) {
  const contexte = await browser.newContext({ baseURL });
  const page = await contexte.newPage();
  await seConnecter(page);
  return { contexte, page };
}

async function choisirLeFichier(page: Page, fichier: string | { name: string; mimeType: string; buffer: Buffer }) {
  await page.locator('input[data-import]').setInputFiles(fichier);
}

async function lancerImport(page: Page, fichier: Parameters<typeof choisirLeFichier>[1]) {
  await page.goto('/organisateur');
  // Le sélecteur de fichier du système n'est pas pilotable : on alimente directement le champ.
  await choisirLeFichier(page, fichier);
}

test('US-035 CA-1 et CA-2 : le fichier est vérifié, un résumé s’affiche, l’import crée l’épreuve sur ce PC qui en devient le pilote', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000);
  await sansSelecteur(page);
  await seConnecter(page);
  const { epreuve } = await creerEpreuvePilotee(page);
  const fichier = await exporter(page, epreuve);

  const secours = await pcDeSecours(browser, baseURL);
  // L'entrée est dans le menu « ⋯ » de la liste, proposée à tout organisateur.
  await secours.page.getByRole('button', { name: 'Actions de la liste' }).click();
  await expect(secours.page.getByRole('menuitem', { name: /^Importer une épreuve/ })).toBeVisible();
  await secours.page.keyboard.press('Escape');
  await lancerImport(secours.page, fichier);
  const boite = fenetre(secours.page);
  await expect(boite.getByRole('heading', { name: 'Importer une épreuve' })).toBeVisible();
  await expect(boite).toContainText(epreuve);
  await expect(boite).toContainText('Événements');
  await expect(boite).toContainText('Exporté le');
  await expect(boite).toContainText('sera créée sur cet appareil');
  await boite.getByRole('button', { name: 'Importer', exact: true }).click();

  await expect(secours.page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  await expect(secours.page.getByRole('heading', { level: 1 })).toContainText(epreuve);
  // Ce PC est le pilote, et la reprise au retour en ligne lui est demandée.
  await expect(secours.page.getByText('Ce PC est le pilote', { exact: true })).toBeVisible();
  await expect(secours.page.locator('[data-reprise]')).toContainText('Rien n’est envoyé au serveur');
  await secours.contexte.close();
});

test('US-035 hors ligne : l’import marche sans réseau, la reprise attend le retour en ligne puis prend la main (CA-5)', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000);
  await sansSelecteur(page);
  await seConnecter(page);
  const { epreuve } = await creerEpreuvePilotee(page);
  const fichier = await exporter(page, epreuve);

  const secours = await pcDeSecours(browser, baseURL);
  await secours.page.goto('/organisateur');
  await secours.contexte.setOffline(true);
  await choisirLeFichier(secours.page, fichier);
  await fenetre(secours.page).getByRole('button', { name: 'Importer', exact: true }).click();
  await expect(secours.page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  const reprise = secours.page.locator('[data-reprise]');
  await expect(reprise).toBeVisible();
  // Hors ligne : la prise de main est grisée avec son motif, et l'épreuve est modifiable ici (publier).
  await expect(reprise.getByRole('button', { name: 'Prendre la main et envoyer' })).toBeDisabled();
  await expect(reprise).toContainText('Nécessite une connexion internet');

  await secours.contexte.setOffline(false);
  await expect(reprise.getByRole('button', { name: 'Prendre la main et envoyer' })).toBeEnabled({ timeout: 20_000 });
  await reprise.getByRole('button', { name: 'Prendre la main et envoyer' }).click();
  await expect(secours.page.locator('[data-retour="reprise"]')).toContainText('Main prise');
  await expect(secours.page.locator('[data-reprise]')).toHaveCount(0);
  await secours.contexte.close();
});

test('US-035 CA-6 : si le serveur a continué ailleurs, il est repris et les modifications faites ici sont gardées à part', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(240_000);
  await sansSelecteur(page);
  await seConnecter(page);
  const { epreuve } = await creerEpreuvePilotee(page);
  const fichier = await exporter(page, epreuve);

  // Le PC de secours importe, puis publie l'épreuve (une modification faite ici).
  const secours = await pcDeSecours(browser, baseURL);
  await lancerImport(secours.page, fichier);
  await fenetre(secours.page).getByRole('button', { name: 'Importer', exact: true }).click();
  await expect(secours.page.locator('[data-reprise]')).toBeVisible();
  await secours.page
    .getByRole('region', { name: 'Publication' })
    .getByRole('button', { name: 'Publier', exact: true })
    .click();
  await expect(secours.page.getByText('Publiée', { exact: true })).toBeVisible();

  // Pendant ce temps, le PC pilote continue et envoie : il publie, lui aussi.
  await page.getByRole('region', { name: 'Publication' }).getByRole('button', { name: 'Publier', exact: true }).click();
  await expect(page.getByText('Publiée', { exact: true })).toBeVisible();
  await expect(page.getByText('Publication en attente d’envoi')).toHaveCount(0, { timeout: 20_000 });

  await secours.page.locator('[data-reprise]').getByRole('button', { name: 'Prendre la main et envoyer' }).click();
  await expect(secours.page.locator('[data-retour="reprise"]')).toContainText(
    'L’épreuve a continué sur un autre PC : 1 modification faite ici n’a pas été reprise',
  );
  // Gardée à part, consultable et exportable, sans fusion.
  await expect(secours.page.getByRole('button', { name: 'Exporter en JSON' })).toBeVisible();
  const telechargement = secours.page.waitForEvent('download');
  await secours.page.getByRole('button', { name: 'Exporter en JSON' }).click();
  const ecartees = JSON.parse(await readFile((await (await telechargement).path())!, 'utf8')) as {
    evenements: { type: string }[];
  };
  expect(ecartees.evenements.map(({ type }) => type)).toEqual(['PublicationModifiee']);
  await secours.contexte.close();
});

test('US-035 CA-4 : un fichier illisible, d’un autre format ou d’une version future est refusé avec sa raison, rien n’est modifié', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await seConnecter(page);
  const cas = [
    { texte: 'ceci n’est pas du json {', attendu: 'illisible' },
    { texte: JSON.stringify({ format: 'autre-chose' }), attendu: 'n’est pas une sauvegarde d’épreuve' },
    {
      texte: JSON.stringify({ format: 'poule-position-epreuve', version: 99 }),
      attendu: 'version plus récente',
    },
  ];
  for (const { texte, attendu } of cas) {
    await lancerImport(page, { name: 'test.poule.json', mimeType: 'application/json', buffer: Buffer.from(texte) });
    const boite = fenetre(page);
    await expect(boite.getByRole('alert')).toContainText(attendu);
    await expect(boite.getByRole('button', { name: 'Importer', exact: true })).toHaveCount(0);
    await boite.getByRole('button', { name: 'Fermer' }).click();
    await expect(boite).toHaveCount(0);
    await expect(page).toHaveURL(/\/organisateur$/);
  }
});

test('US-035 CA-4 : un fichier d’un autre club est refusé', async ({ page }) => {
  test.setTimeout(120_000);
  await sansSelecteur(page);
  await seConnecter(page);
  const { epreuve } = await creerEpreuvePilotee(page);
  const chemin = await exporter(page, epreuve);
  const sauvegarde = JSON.parse(await readFile(chemin, 'utf8')) as { clubId: string; journal: { clubId: string }[] };
  sauvegarde.clubId = 'un-autre-club';
  for (const evenement of sauvegarde.journal) evenement.clubId = 'un-autre-club';
  await lancerImport(page, {
    name: 'autre-club.poule.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(sauvegarde)),
  });
  await expect(fenetre(page).getByRole('alert')).toContainText('autre club');
});

test('US-035 : importer un fichier que l’appareil a déjà ne modifie rien', async ({ page }) => {
  test.setTimeout(120_000);
  await sansSelecteur(page);
  await seConnecter(page);
  const { epreuve } = await creerEpreuvePilotee(page);
  const chemin = await exporter(page, epreuve);
  await lancerImport(page, chemin);
  const boite = fenetre(page);
  await expect(boite).toContainText('rien ne sera modifié');
  await expect(boite.getByRole('button', { name: 'Importer', exact: true })).toHaveCount(0);
  await boite.getByRole('button', { name: 'Fermer' }).click();
  await expect(boite).toHaveCount(0);
});
