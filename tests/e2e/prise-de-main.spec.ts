// Prise de main (US-029) : un second PC du même club prend la main sur une épreuve, l'ancien pilote passe en lecture
// seule, ses modifications hors ligne sont écartées et exportables. Deux contextes de navigateur jouent les deux PC.
import { expect, test, type Browser, type Page } from '@playwright/test';
import { seConnecter } from './compte';

/** Nom unique, pour reconnaître l’épreuve de ce test parmi celles du club. */
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

const MOTIF_PAGE_EPREUVE = /\/epreuves\/[0-9a-f-]{36}$/;
const LIBELLE_PC = /\(appareil [0-9a-f]{4}\)/;

/** Crée une épreuve par le formulaire et attend que le serveur l'ait reçue. */
async function creerEpreuve(page: Page, nom: string) {
  // US-045 : toute épreuve est dans une compétition ; ici, une compétition seule créée avec elle (même nom).
  await page.goto('/epreuves/nouvelle?seule');
  await page.getByLabel('Nom de la compétition et de son épreuve').fill(nom);
  await page.getByLabel('Arme').selectOption('sabre');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(MOTIF_PAGE_EPREUVE);
  await expect(page.getByText('Ce PC est le pilote', { exact: true })).toBeVisible();
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
}

/** Second PC : un autre contexte du navigateur (autre IndexedDB, donc autre appareil), connecté au même compte. */
async function secondPc(browser: Browser, baseURL: string | undefined, adresse: string) {
  const contexte = await browser.newContext({ baseURL });
  const page = await contexte.newPage();
  await seConnecter(page);
  await page.goto(adresse);
  await expect(page.getByText('Lecture seule : cette épreuve est pilotée par un autre PC')).toBeVisible({
    timeout: 20_000,
  });
  return { contexte, page };
}

const prendreLaMain = async (page: Page) => {
  await page.getByRole('button', { name: 'Prendre la main', exact: true }).click();
  await page
    .getByRole('group', { name: 'Prendre la main sur cette épreuve ?' })
    .getByRole('button', {
      name: 'Prendre la main',
    })
    .click();
};

test('US-029 CA-1 et CA-4 : un autre PC prend la main, après avoir été averti que le pilote est connecté', async ({
  page,
  browser,
  baseURL,
}) => {
  await seConnecter(page);
  await creerEpreuve(page, nomUnique());
  const adresse = new URL(page.url()).pathname;

  const { contexte, page: autre } = await secondPc(browser, baseURL, adresse);
  try {
    await autre.getByRole('button', { name: 'Prendre la main', exact: true }).click();
    const confirmation = autre.getByRole('group', { name: 'Prendre la main sur cette épreuve ?' });
    await expect(confirmation.getByText(/est connecté et pilote cette épreuve/)).toBeVisible();
    await expect(confirmation.getByText(LIBELLE_PC)).toBeVisible();
    await confirmation.getByRole('button', { name: 'Prendre la main' }).click();

    await expect(autre.getByText('Ce PC est le pilote', { exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(autre.getByText('Lecture seule : cette épreuve est pilotée par un autre PC')).toHaveCount(0);
    await expect(autre.getByRole('link', { name: 'Modifier', exact: true })).toBeVisible();
    await expect(autre.getByRole('button', { name: 'Prendre la main', exact: true })).toHaveCount(0);
    await expect(autre.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
  } finally {
    await contexte.close();
  }
});

test('US-029 CA-2 : l’ancien pilote en ligne passe en lecture seule et sait qui a pris la main', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(120_000);
  await seConnecter(page);
  await creerEpreuve(page, nomUnique());
  const adresse = new URL(page.url()).pathname;

  const { contexte, page: autre } = await secondPc(browser, baseURL, adresse);
  try {
    await prendreLaMain(autre);
    await expect(autre.getByText('Ce PC est le pilote', { exact: true })).toBeVisible({ timeout: 20_000 });

    // Le battement du pilote arrive toutes les 30 s : l'ancien pilote le découvre au suivant.
    await expect(page.getByText(/a pris la main depuis un autre PC/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(LIBELLE_PC)).toBeVisible();
    await expect(page.getByText('Lecture seule : cette épreuve est pilotée par un autre PC')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Modifier', exact: true })).toHaveCount(0);
  } finally {
    await contexte.close();
  }
});

test('US-029 CA-3 : les modifications faites hors ligne par l’ancien pilote sont signalées et exportables', async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  await seConnecter(page);
  await creerEpreuve(page, nomUnique());
  const adresse = new URL(page.url()).pathname;

  const { contexte, page: autre } = await secondPc(browser, baseURL, adresse);
  try {
    // L'ancien pilote travaille sans réseau : une modification reste en attente d'envoi.
    await context.setOffline(true);
    await page.getByRole('link', { name: 'Modifier', exact: true }).click();
    await page.getByLabel('Nom', { exact: true }).fill(nomUnique());
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByText('1 modification en attente d’envoi')).toBeVisible();

    await prendreLaMain(autre);
    await expect(autre.getByText('Ce PC est le pilote', { exact: true })).toBeVisible({ timeout: 20_000 });

    // Retour du réseau : le serveur refuse l'envoi, la modification est écartée et l'ancien pilote prévenu.
    await context.setOffline(false);
    await expect(page.getByText('1 modification faite hors ligne n’a pas été reprise')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/a pris la main depuis un autre PC/)).toBeVisible();
    await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0);

    const telechargement = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exporter en JSON' }).click();
    const fichier = await telechargement;
    expect(fichier.suggestedFilename()).toMatch(/^modifications-ecartees-[0-9a-f-]{36}\.json$/);
    const { createReadStream } = await import('node:fs');
    const morceaux: Buffer[] = [];
    for await (const morceau of createReadStream((await fichier.path()) as string)) morceaux.push(morceau as Buffer);
    const contenu = JSON.parse(Buffer.concat(morceaux).toString('utf8')) as {
      evenements: { type: string }[];
    };
    expect(contenu.evenements.map(({ type }) => type)).toEqual(['EpreuveModifiee']);
  } finally {
    await contexte.close();
  }
});

test('US-029 hors ligne : « Prendre la main » est grisé sans réseau', async ({ page, browser, baseURL }) => {
  await seConnecter(page);
  await creerEpreuve(page, nomUnique());
  const adresse = new URL(page.url()).pathname;

  const { contexte, page: autre } = await secondPc(browser, baseURL, adresse);
  try {
    await contexte.setOffline(true);
    await expect(autre.getByRole('button', { name: 'Prendre la main', exact: true })).toBeDisabled();
    await expect(autre.getByText('Nécessite une connexion internet')).toBeVisible();
    await contexte.setOffline(false);
    await expect(autre.getByRole('button', { name: 'Prendre la main', exact: true })).toBeEnabled();
  } finally {
    await contexte.close();
  }
});
