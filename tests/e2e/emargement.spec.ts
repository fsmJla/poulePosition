// Émargement d'une épreuve (US-084, planche 19) : pointer les présents, recherche (Entrée pointe le seul résultat),
// filtres, inscription sur place, remise à absent, hors ligne.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';

const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

/** Une épreuve avec trois inscrits, pilotée par ce PC ; ouvre l'étape « Émargement ». */
async function ouvrirEmargement(page: Page) {
  await page.goto('/epreuves/nouvelle?seule');
  await page.getByLabel('Nom de la compétition et de son épreuve').fill(nomUnique());
  await page.getByLabel('Arme').selectOption('sabre');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  const adresse = page.url();
  await page.goto(`${adresse}/inscriptions`);
  for (const [nom, prenom, club] of [
    ['MARTIN', 'Léa', 'Talence'],
    ['DUBOIS', 'Chloé', 'Pessac'],
    ['BERNARD', 'Inès', 'Mérignac'],
  ] as const) {
    await page.getByLabel('Nom', { exact: true }).fill(nom);
    await page.getByLabel('Prénom', { exact: true }).fill(prenom);
    await page.getByLabel('Club', { exact: true }).fill(club);
    await page.getByLabel('Club', { exact: true }).press('Enter');
    await expect(page.getByLabel('Nom', { exact: true })).toHaveValue('');
  }
  // CA-1 : l'étape « Émargement » est livrée et porte « présents/inscrits ».
  const etape = page
    .getByRole('navigation', { name: 'Étapes de l’épreuve' })
    .getByRole('link', { name: /^Émargement/ });
  await expect(etape).toContainText('0/3');
  await etape.click();
  await expect(page).toHaveURL(/\/emargement$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Émargement' })).toBeVisible();
}

const ligne = (page: Page, nom: string) => page.getByRole('checkbox', { name: `Présent : ${nom}` });

test('US-084 CA-1, CA-2 et CA-3 : pointer, compter, filtrer, et Entrée pointe le seul résultat de la recherche', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1360, height: 1000 });
  await seConnecter(page);
  await ouvrirEmargement(page);
  await expect(page.getByText('0 présent sur 3')).toBeVisible();

  // CA-2 : un clic pointe (avec l'heure), un second remet absent.
  await ligne(page, 'MARTIN Léa').click();
  await expect(ligne(page, 'MARTIN Léa')).toHaveAttribute('aria-checked', 'true');
  await expect(ligne(page, 'MARTIN Léa')).toContainText(/Présent · \d\d:\d\d/);
  await expect(page.getByText('1 présent sur 3')).toBeVisible();
  await ligne(page, 'MARTIN Léa').click();
  await expect(ligne(page, 'MARTIN Léa')).toHaveAttribute('aria-checked', 'false');

  // CA-3 : la recherche filtre ; Entrée pointe le seul tireur restant.
  await page.getByLabel('Rechercher un tireur').fill('dubo');
  await expect(page.getByRole('checkbox', { name: /^Présent : / })).toHaveCount(1);
  await page.getByLabel('Rechercher un tireur').press('Enter');
  await expect(page.getByText('1 présent sur 3')).toBeVisible();
  await expect(page.getByLabel('Rechercher un tireur')).toHaveValue('');

  // CA-2 : les filtres portent leur nombre.
  await page.getByRole('button', { name: /^Absents/ }).click();
  await expect(page.getByRole('checkbox', { name: /^Présent : / })).toHaveCount(2);
  await page.getByRole('button', { name: /^Présents/ }).click();
  await expect(page.getByRole('checkbox', { name: /^Présent : / })).toHaveCount(1);
  await expect(
    page.getByRole('navigation', { name: 'Étapes de l’épreuve' }).getByRole('link', { name: /^Émargement/ }),
  ).toContainText('1/3');
});

test('US-084 CA-4 et CA-6 : inscrire sur place (pointé présent) ; remettre tout le monde absent après confirmation', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await seConnecter(page);
  await ouvrirEmargement(page);

  await page.getByRole('button', { name: 'Inscrire sur place' }).click();
  const surPlace = page.getByRole('region', { name: /Inscrire sur place/ });
  await surPlace.getByLabel('Nom', { exact: true }).fill('FAURE');
  await surPlace.getByLabel('Prénom', { exact: true }).fill('Lison');
  await surPlace.getByLabel('Club', { exact: true }).fill('Mérignac');
  await surPlace.getByRole('button', { name: 'Inscrire et pointer' }).click();
  await expect(ligne(page, 'FAURE Lison')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('1 présent sur 4')).toBeVisible();

  // CA-6 : « Constituer les poules » est l'action principale, active depuis US-086.
  await expect(page.getByRole('button', { name: 'Constituer les poules' })).toBeEnabled();

  await page.getByRole('button', { name: 'Autres actions pour Émargement' }).click();
  await page.getByRole('menuitem', { name: /^Remettre tout le monde absent/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remettre absents' }).click();
  await expect(page.getByText('0 présent sur 4')).toBeVisible();
});

test('US-084 hors ligne : le pointage s’écrit sans réseau et part au retour du réseau', async ({ page, context }) => {
  test.setTimeout(120_000);
  await seConnecter(page);
  await ouvrirEmargement(page);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 30_000 });

  await context.setOffline(true);
  await ligne(page, 'BERNARD Inès').click();
  await expect(ligne(page, 'BERNARD Inès')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText(/en attente d’envoi/)).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 30_000 });
});
