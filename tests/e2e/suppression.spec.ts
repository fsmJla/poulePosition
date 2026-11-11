// Suppression définitive d'une épreuve (US-039) : un administrateur la supprime après avoir saisi son nom, elle
// disparaît de la liste, et un autre PC qui en gardait une copie l'efface avec une annonce. Le compte de test est
// administrateur en local ; contre la preview, le compte de test est un organisateur : seuls les tests de CA-2 y tournent.
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
  await expect(page.getByText('Ce PC est le pilote', { exact: true })).toBeVisible();
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
}

const AVEC_ADMINISTRATEUR = 'administrateur réel : local uniquement (le compte de la preview est un organisateur)';
// US-057 : « Supprimer… » est la dernière action du menu « ⋯ » de l'épreuve.
const menuSupprimer = (page: Page) => page.getByRole('menuitem', { name: /^Supprimer…/ });
const ouvrirMenu = (page: Page) => page.getByRole('button', { name: /^Autres actions pour / }).click();
async function lancerSuppression(page: Page) {
  await ouvrirMenu(page);
  await menuSupprimer(page).click();
}

test('US-039 CA-1 et CA-8 : supprimer définitivement une épreuve, après avoir saisi son nom', async ({ page }) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const nom = nomUnique();
  await seConnecter(page);
  await creerEpreuve(page, nom);

  await lancerSuppression(page);
  const fenetre = page.getByRole('group', { name: 'Supprimer définitivement cette épreuve ?' });
  const valider = fenetre.getByRole('button', { name: 'Supprimer définitivement', exact: true });
  await expect(valider).toBeDisabled();
  await fenetre.getByLabel(`Saisissez « ${nom} » pour confirmer`).fill(`${nom} x`);
  await expect(valider).toBeDisabled();
  await fenetre.getByLabel(`Saisissez « ${nom} » pour confirmer`).fill(nom);
  await expect(valider).toBeEnabled();
  await valider.click();

  await expect(page).toHaveURL(/\/organisateur$/);
  await expect(page.getByText(nom)).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(nom)).toHaveCount(0);
});

test('US-039 hors ligne : le bouton est grisé, avec « Connexion requise pour supprimer »', async ({
  page,
  context,
}) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  await seConnecter(page);
  await creerEpreuve(page, nomUnique());

  await context.setOffline(true);
  await ouvrirMenu(page);
  await expect(menuSupprimer(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('menu').getByText('Connexion requise pour supprimer')).toBeVisible();
  await page.keyboard.press('Escape');
  await context.setOffline(false);
  await ouvrirMenu(page);
  await expect(menuSupprimer(page)).not.toHaveAttribute('aria-disabled', 'true');
});

test('US-039 CA-5 : un autre PC efface sa copie à la synchronisation et l’annonce une fois', async ({
  page,
  browser,
  baseURL,
}) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const nom = nomUnique();
  await seConnecter(page);
  await creerEpreuve(page, nom);
  const adresse = new URL(page.url()).pathname;

  // Second PC : autre contexte, donc autre IndexedDB. Il garde une copie en lecture seule.
  const contexte = await browser.newContext({ baseURL });
  try {
    const autre = await contexte.newPage();
    await seConnecter(autre);
    await autre.goto(adresse);
    await expect(autre.getByText('Lecture seule : cette épreuve est pilotée par un autre PC')).toBeVisible({
      timeout: 20_000,
    });

    await lancerSuppression(page);
    const fenetre = page.getByRole('group', { name: 'Supprimer définitivement cette épreuve ?' });
    await fenetre.getByLabel(`Saisissez « ${nom} » pour confirmer`).fill(nom);
    await fenetre.getByRole('button', { name: 'Supprimer définitivement', exact: true }).click();
    await expect(page).toHaveURL(/\/organisateur$/);

    await autre.goto('/organisateur');
    await expect(autre.getByText(`L’épreuve ${nom} a été supprimée par un administrateur`)).toBeVisible({
      timeout: 20_000,
    });
    await expect(autre.getByText(nom, { exact: true })).toHaveCount(0);
  } finally {
    await contexte.close();
  }
});

test('US-039 CA-2 : un organisateur n’a pas le bouton de suppression', async ({ page }) => {
  test.skip(!process.env.BASE_URL, 'organisateur réel : preview uniquement (le compte local est un administrateur)');
  await seConnecter(page);
  await creerEpreuve(page, nomUnique());
  await expect(page.getByRole('link', { name: 'Modifier', exact: true })).toBeVisible();
  await ouvrirMenu(page);
  await expect(menuSupprimer(page)).toHaveCount(0);
});
