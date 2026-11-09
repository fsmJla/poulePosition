// Modification d'une épreuve (US-027) : formulaire prérempli, événement limité aux champs changés, lecture seule hors
// du PC pilote, mêmes validations qu'à la création, modification hors ligne.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';

/** Nom unique, pour reconnaître l’épreuve de ce test parmi celles du club. */
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

const MOTIF_PAGE_EPREUVE = /\/epreuves\/[0-9a-f-]{36}$/;

/** Crée une épreuve par le formulaire et attend que le serveur l'ait reçue. */
async function creerEpreuve(page: Page, nom: string) {
  // US-045 : toute épreuve est dans une compétition ; ici, une compétition seule créée avec elle (même nom).
  await page.goto('/epreuves/nouvelle?seule');
  await page.getByLabel('Nom de la compétition et de son épreuve').fill(nom);
  await page.getByLabel('Arme').selectOption('sabre');
  await page.getByLabel('Lieu').fill('Salle Bellegrave');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(MOTIF_PAGE_EPREUVE);
  // La page n'affiche le compte des envois en attente qu'une fois chargée : attendre le pilote évite un faux « zéro ».
  await expect(page.getByText('Ce PC est le pilote', { exact: true })).toBeVisible();
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
}

const ouvrirModification = async (page: Page) => {
  await page.getByRole('link', { name: 'Modifier', exact: true }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}\/modifier$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Modifier l’épreuve');
};

const enregistrer = (page: Page) => page.getByRole('button', { name: 'Enregistrer' }).click();

test('US-027 CA-1 : modifier le nom, le lieu et les horaires met la page à jour', async ({ page }) => {
  const nom = nomUnique();
  const nouveauNom = nomUnique();
  await seConnecter(page);
  await creerEpreuve(page, nom);

  await ouvrirModification(page);
  await expect(page.getByLabel('Nom', { exact: true })).toHaveValue(nom);
  await expect(page.getByLabel('Lieu')).toHaveValue('Salle Bellegrave');
  await page.getByLabel('Nom', { exact: true }).fill(nouveauNom);
  await page.getByLabel('Lieu').fill('Gymnase Nord');
  await page.getByLabel('Appel').fill('08:30');
  await page.getByLabel('Scratch').fill('09:00');
  await enregistrer(page);

  await expect(page).toHaveURL(MOTIF_PAGE_EPREUVE);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(nouveauNom);
  await expect(page.getByText('Gymnase Nord')).toBeVisible();
  await expect(page.getByText('08:30')).toBeVisible();
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });

  // Le nouveau nom survit au rechargement : il vient du journal.
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(nouveauNom);
});

test('US-027 CA-3 : un autre PC voit l’épreuve en lecture seule, sans bouton « Modifier »', async ({
  page,
  browser,
  baseURL,
}) => {
  await seConnecter(page);
  await creerEpreuve(page, nomUnique());
  const adresse = new URL(page.url()).pathname;

  const autrePc = await browser.newContext({ baseURL });
  try {
    const autre = await autrePc.newPage();
    await seConnecter(autre);
    await autre.goto(adresse);
    await expect(autre.getByText('Lecture seule : cette épreuve est pilotée par un autre PC')).toBeVisible({
      timeout: 20_000,
    });
    await expect(autre.getByRole('link', { name: 'Modifier', exact: true })).toHaveCount(0);

    await autre.goto(`${adresse}/modifier`);
    await expect(autre.getByText('Lecture seule : cette épreuve est pilotée par un autre PC')).toBeVisible();
    await expect(autre.getByLabel('Nom', { exact: true })).toBeDisabled();
    await expect(autre.getByRole('button', { name: 'Enregistrer' })).toHaveCount(0);
  } finally {
    await autrePc.close();
  }
});

test('US-027 CA-4 : les horaires incohérents sont refusés avec le message de la création', async ({ page }) => {
  await seConnecter(page);
  await creerEpreuve(page, nomUnique());

  await ouvrirModification(page);
  await page.getByLabel('Appel').fill('09:00');
  await page.getByLabel('Scratch').fill('08:00');
  await enregistrer(page);

  await expect(page.getByText('Le scratch doit être après l’appel')).toBeVisible();
  await expect(page).toHaveURL(/\/modifier$/);

  await page.getByLabel('Nom', { exact: true }).fill('');
  await page.getByLabel('Scratch').fill('09:30');
  await enregistrer(page);
  await expect(page.getByText('Le nom est obligatoire')).toBeVisible();
});

test('US-027 CA-5 : enregistrer sans rien changer n’ajoute aucune modification en attente', async ({
  page,
  context,
}) => {
  await seConnecter(page);
  await creerEpreuve(page, nomUnique());

  // Hors ligne, une modification écrite resterait « en attente d'envoi » : son absence prouve qu'aucun événement n'a été écrit.
  await context.setOffline(true);
  await ouvrirModification(page);
  await enregistrer(page);

  await expect(page).toHaveURL(MOTIF_PAGE_EPREUVE);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0);
  await context.setOffline(false);
});

test('US-027 hors ligne : modifier réseau coupé, puis envoyer au retour du réseau', async ({ page, context }) => {
  const nouveauNom = nomUnique();
  await seConnecter(page);
  await creerEpreuve(page, nomUnique());

  await context.setOffline(true);
  await ouvrirModification(page);
  await page.getByLabel('Nom', { exact: true }).fill(nouveauNom);
  await enregistrer(page);

  await expect(page).toHaveURL(MOTIF_PAGE_EPREUVE);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(nouveauNom);
  await expect(page.getByText('1 modification en attente d’envoi')).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
});
