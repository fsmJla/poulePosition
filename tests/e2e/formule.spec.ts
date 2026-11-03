// Formule d'une compétition (US-028) : valeurs par défaut, réglage des touches et du match pour la 3e place, historique
// des changements, lecture seule hors du PC pilote, réglage hors ligne.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';

/** Nom unique, pour reconnaître la compétition de ce test parmi celles du club. */
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

const MOTIF_PAGE_COMPETITION = /\/competitions\/[0-9a-f-]{36}$/;

/** Crée une compétition par le formulaire et attend que le serveur l'ait reçue. */
async function creerCompetition(page: Page, nom: string) {
  await page.goto('/competitions/nouvelle');
  await page.getByLabel('Nom', { exact: true }).fill(nom);
  await page.getByLabel('Arme').selectOption('sabre');
  await page.getByLabel('Lieu').fill('Salle Bellegrave');
  await page.getByRole('button', { name: 'Créer la compétition' }).click();
  await expect(page).toHaveURL(MOTIF_PAGE_COMPETITION);
  // La page n'affiche le compte des envois en attente qu'une fois chargée : attendre le pilote évite un faux « zéro ».
  await expect(page.getByText('Ce PC est le pilote', { exact: true })).toBeVisible();
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
}

const ouvrirFormule = async (page: Page) => {
  await page.getByRole('link', { name: 'Formule', exact: true }).click();
  await expect(page).toHaveURL(/\/competitions\/[0-9a-f-]{36}\/formule$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Formule de la compétition');
};

const enregistrer = (page: Page) => page.getByRole('button', { name: 'Enregistrer la formule' }).click();

test('US-028 CA-1 : une nouvelle compétition a la formule par défaut', async ({ page }) => {
  await seConnecter(page);
  await creerCompetition(page, nomUnique());

  await expect(page.getByText('Poules en 5 touches, sans élimination · Tableau en 15 touches')).toBeVisible();
  await ouvrirFormule(page);
  await expect(page.getByLabel('Touches en poules')).toHaveValue('5');
  await expect(page.getByLabel('Touches au tableau')).toHaveValue('15');
  await expect(page.getByLabel('Match pour la 3e place')).not.toBeChecked();
  await expect(page.getByText('D’autres formules seront proposées plus tard.')).toBeVisible();
});

test('US-028 CA-2 et CA-6 : régler les touches et la 3e place met la formule à jour, avec son historique', async ({
  page,
}) => {
  await seConnecter(page);
  await creerCompetition(page, nomUnique());
  await ouvrirFormule(page);
  await expect(page.getByText('Aucun changement de formule')).toBeVisible();

  await page.getByLabel('Touches au tableau').selectOption('10');
  await enregistrer(page);
  await expect(page.getByText('Poules en 5 touches, sans élimination · Tableau en 10 touches')).toBeVisible();

  await page.getByLabel('Touches en poules').fill('4');
  await page.getByLabel('Match pour la 3e place').check();
  await enregistrer(page);
  await expect(
    page.getByText('Poules en 4 touches, sans élimination · Tableau en 10 touches · Match pour la 3e place'),
  ).toBeVisible();

  const historique = page.locator('section ol li');
  await expect(historique).toHaveCount(2);
  await expect(historique.first()).toContainText('Tableau en 10 touches');
  await expect(historique.last()).toContainText('Poules en 4 touches · Match pour la 3e place activé');
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });

  // La formule survit au rechargement : elle vient du journal.
  await page.reload();
  await expect(page.getByLabel('Touches en poules')).toHaveValue('4');
  await expect(page.getByLabel('Match pour la 3e place')).toBeChecked();
});

test('US-028 CA-2 : des touches hors bornes sont refusées', async ({ page }) => {
  await seConnecter(page);
  await creerCompetition(page, nomUnique());
  await ouvrirFormule(page);

  await page.getByLabel('Touches en poules').fill('12');
  await enregistrer(page);
  await expect(page.getByText('Les poules se jouent en 3 à 10 touches')).toBeVisible();
  await expect(page.getByText('Aucun changement de formule')).toBeVisible();
});

test('US-028 : un autre PC voit la formule en lecture seule', async ({ page, browser, baseURL }) => {
  await seConnecter(page);
  await creerCompetition(page, nomUnique());
  const adresse = new URL(page.url()).pathname;

  const autrePc = await browser.newContext({ baseURL });
  try {
    const autre = await autrePc.newPage();
    await seConnecter(autre);
    await autre.goto(`${adresse}/formule`);
    await expect(autre.getByText('Lecture seule : cette compétition est pilotée par un autre PC')).toBeVisible({
      timeout: 20_000,
    });
    await expect(autre.getByLabel('Touches en poules')).toBeDisabled();
    await expect(autre.getByLabel('Match pour la 3e place')).toBeDisabled();
    await expect(autre.getByRole('button', { name: 'Enregistrer la formule' })).toHaveCount(0);
  } finally {
    await autrePc.close();
  }
});

test('US-028 hors ligne : régler la formule réseau coupé, puis l’envoyer au retour du réseau', async ({
  page,
  context,
}) => {
  await seConnecter(page);
  await creerCompetition(page, nomUnique());

  await context.setOffline(true);
  await ouvrirFormule(page);
  await page.getByLabel('Match pour la 3e place').check();
  await enregistrer(page);

  await expect(
    page.getByText('Poules en 5 touches, sans élimination · Tableau en 15 touches · Match pour la 3e place'),
  ).toBeVisible();
  await expect(page.getByText('1 modification en attente d’envoi')).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
});
