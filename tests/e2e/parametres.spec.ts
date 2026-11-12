// Paramètres d'une épreuve (US-032) : valeurs par défaut, réglage des droits et des noms au public, lecture seule hors
// du PC pilote, réglage hors ligne.
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
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(MOTIF_PAGE_EPREUVE);
  // La page n'affiche le compte des envois en attente qu'une fois chargée : attendre le pilote évite un faux « zéro ».
  await expect(page.getByText('Ce PC est le pilote', { exact: true })).toBeVisible();
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
}

const ouvrirParametres = async (page: Page) => {
  await page.getByRole('link', { name: 'Paramètres', exact: true }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}\/parametres$/);
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Paramètres de l’épreuve');
};

const enregistrer = (page: Page) => page.getByRole('button', { name: 'Enregistrer les paramètres' }).click();

const ARBITRE_SAISIT = 'Saisir les scores de poule et de tableau';
const ARBITRE_DEPLACE = 'Déplacer une poule ou un match de piste';
const TIREUR_POULE = 'Saisir les scores des matchs de sa poule';
const TIREUR_TABLEAU = 'Saisir le score de ses matchs de tableau';
const CORRECTION = 'Correction d’un score déjà saisi';
const PRENOM_N = 'Afficher les noms au public sous la forme « Prénom N. »';

test('US-032 CA-1 : une nouvelle épreuve a les paramètres par défaut, et la mention des réglages à venir', async ({
  page,
}) => {
  await seConnecter(page);
  await creerEpreuve(page, nomUnique());
  await ouvrirParametres(page);

  for (const reglage of [ARBITRE_SAISIT, ARBITRE_DEPLACE, TIREUR_POULE, TIREUR_TABLEAU]) {
    await expect(page.getByLabel(reglage)).toBeChecked();
  }
  await expect(page.getByLabel(CORRECTION)).toHaveValue('arbitre');
  await expect(page.getByLabel(PRENOM_N)).not.toBeChecked();
  // CA-3 : seulement enregistrés tant que la saisie smartphone et l'affichage public n'existent pas.
  await expect(page.getByText(/seront appliqués quand la saisie par smartphone et l’affichage public/)).toBeVisible();
});

test('US-032 CA-2 : modifier les paramètres les enregistre, et ils survivent au rechargement', async ({ page }) => {
  await seConnecter(page);
  await creerEpreuve(page, nomUnique());
  await ouvrirParametres(page);

  await page.getByLabel(TIREUR_POULE).uncheck();
  await page.getByLabel(CORRECTION).selectOption('personne');
  await page.getByLabel(PRENOM_N).check();
  await enregistrer(page);
  await expect(page.getByText('Paramètres enregistrés')).toBeVisible();
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });

  await page.reload();
  await expect(page.getByLabel(TIREUR_POULE)).not.toBeChecked();
  await expect(page.getByLabel(TIREUR_TABLEAU)).toBeChecked();
  await expect(page.getByLabel(CORRECTION)).toHaveValue('personne');
  await expect(page.getByLabel(PRENOM_N)).toBeChecked();
});

test('US-032 : un autre PC voit les paramètres en lecture seule', async ({ page, browser, baseURL }) => {
  await seConnecter(page);
  await creerEpreuve(page, nomUnique());
  const adresse = new URL(page.url()).pathname;

  const autrePc = await browser.newContext({ baseURL });
  try {
    const autre = await autrePc.newPage();
    await seConnecter(autre);
    await autre.goto(`${adresse}/parametres`);
    await expect(autre.getByText('Lecture seule : cette épreuve est pilotée par un autre PC')).toBeVisible({
      timeout: 20_000,
    });
    await expect(autre.getByLabel(ARBITRE_SAISIT)).toBeDisabled();
    await expect(autre.getByLabel(CORRECTION)).toBeDisabled();
    await expect(autre.getByLabel(PRENOM_N)).toBeDisabled();
    await expect(autre.getByRole('button', { name: 'Enregistrer les paramètres' })).toHaveCount(0);
  } finally {
    await autrePc.close();
  }
});

test('US-032 hors ligne : régler les paramètres réseau coupé, puis les envoyer au retour du réseau', async ({
  page,
  context,
}) => {
  await seConnecter(page);
  await creerEpreuve(page, nomUnique());

  await context.setOffline(true);
  await ouvrirParametres(page);
  await page.getByLabel(ARBITRE_DEPLACE).uncheck();
  await enregistrer(page);

  await expect(page.getByText('Paramètres enregistrés')).toBeVisible();
  await expect(page.getByText('1 modification en attente d’envoi')).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
});
