// Publication d'une épreuve (US-031) : non publiée par défaut, publier (même sans réseau), la voir sur la page publique
// et sur son lien public sans connexion, puis la dépublier.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter, ETAT_PREVIEW } from './compte';
import { ajouterCompetition, creerManifestationSimple, ouvrirManifestation } from './planche';

/** Nom unique, pour reconnaître les données de ce test parmi celles du club. */
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

/** Crée au serveur une manifestation du 14 au 15 mars 2027. */
async function creerManifestation(page: Page, nom: string) {
  await creerManifestationSimple(page, nom);
}

/** Ajoute une compétition à la manifestation, puis une épreuve à cette compétition ; ouvre la page de l'épreuve. */
async function creerEpreuve(page: Page, manifestation: string, competition: string, epreuve: string) {
  await ajouterCompetition(page, manifestation, competition);
  await ouvrirManifestation(page, manifestation, 'plan');
  await page.getByRole('button', { name: `Ajouter une épreuve à ${competition}, dimanche 14 mars 2027` }).click();
  await expect(page.getByLabel('Compétition', { exact: true })).not.toHaveValue('');
  await page.getByLabel('Nom', { exact: true }).fill(epreuve);
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  return page.url().split('/').at(-1)!;
}

test('US-031 CA-1 à CA-5 : publier, voir l’épreuve sur la page publique et son lien public sans connexion, puis la dépublier', async ({
  page,
  context,
  browser,
  baseURL,
}) => {
  test.setTimeout(150_000);
  const manifestation = nomUnique();
  const competition = nomUnique();
  const epreuve = `${competition} M13`;
  await seConnecter(page);
  await creerManifestation(page, manifestation);
  const epreuveId = await creerEpreuve(page, manifestation, competition, epreuve);

  // Un visiteur : aucun compte, aucune session (seul le cookie de contournement de la preview, s'il y en a un).
  const visiteurContexte = await browser.newContext({
    baseURL: baseURL ?? 'http://localhost:4280',
    ...(process.env.BASE_URL && { storageState: ETAT_PREVIEW }),
  });
  const visiteur = await visiteurContexte.newPage();
  const voit = async (nom: string) => {
    await visiteur.goto('/');
    await expect(visiteur.getByRole('heading', { name: 'Épreuves à venir' })).toBeVisible({ timeout: 20_000 });
    await expect(visiteur.getByRole('status').filter({ hasText: 'Chargement' })).toHaveCount(0, { timeout: 20_000 });
    return (await visiteur.getByText(nom, { exact: true }).count()) > 0;
  };
  const publier = page
    .getByRole('region', { name: 'Publication' })
    .getByRole('button', { name: 'Publier', exact: true });
  const depublier = page.getByRole('button', { name: 'Dépublier', exact: true });

  // CA-1 : non publiée par défaut ; ni la page publique ni le lien public ne la montrent.
  await expect(page.getByText('Non publiée', { exact: true })).toBeVisible();
  expect(await voit(epreuve)).toBe(false);
  await visiteur.goto(`/direct/${epreuveId}`);
  await expect(visiteur.getByText('Cette épreuve n’est pas publiée')).toBeVisible({ timeout: 20_000 });

  // Hors ligne : on publie sur le PC pilote (journal local) ; la page publique ne change pas avant l'envoi.
  await context.setOffline(true);
  await publier.click();
  await expect(page.getByText('Publiée', { exact: true })).toBeVisible();
  await expect(page.getByText('Publication en attente d’envoi')).toBeVisible();
  expect(await voit(epreuve)).toBe(false);

  // CA-2 : le réseau revient, l'événement part, l'épreuve apparaît sur la page publique sans connexion.
  await context.setOffline(false);
  await expect(page.getByText('Publication en attente d’envoi')).toHaveCount(0, { timeout: 30_000 });
  await expect(async () => {
    expect(await voit(epreuve)).toBe(true);
  }).toPass({ timeout: 30_000 });

  // CA-3 : groupée sous sa manifestation et sa compétition ; CA-5 : aucune donnée de tireur ni de compte.
  await expect(visiteur.getByRole('heading', { name: manifestation })).toBeVisible();
  await expect(visiteur.getByRole('region', { name: competition }).getByText(epreuve, { exact: true })).toBeVisible();
  await expect(visiteur.getByText('Sabre').first()).toBeVisible();
  await expect(visiteur.getByText(/@/)).toHaveCount(0);

  // CA-4 : le lien public répond tant que l'épreuve est publiée.
  await visiteur.goto(`/direct/${epreuveId}`);
  await expect(visiteur.getByRole('heading', { name: epreuve })).toBeVisible({ timeout: 20_000 });

  // CA-4 : dépublier retire l'épreuve de la page publique, et son lien répond qu'elle n'est pas publiée.
  await depublier.click();
  await expect(page.getByText('Non publiée', { exact: true })).toBeVisible();
  await expect(async () => {
    await visiteur.goto(`/direct/${epreuveId}`);
    await expect(visiteur.getByText('Cette épreuve n’est pas publiée')).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  expect(await voit(epreuve)).toBe(false);
  await visiteurContexte.close();
});

test('US-031 cas limite : un lien public inconnu répond « Cette épreuve n’est pas publiée »', async ({
  browser,
  baseURL,
}) => {
  const visiteurContexte = await browser.newContext({
    baseURL: baseURL ?? 'http://localhost:4280',
    ...(process.env.BASE_URL && { storageState: ETAT_PREVIEW }),
  });
  const visiteur = await visiteurContexte.newPage();
  await visiteur.goto(`/direct/${crypto.randomUUID()}`);
  await expect(visiteur.getByText('Cette épreuve n’est pas publiée')).toBeVisible({ timeout: 20_000 });
  await visiteur.getByRole('link', { name: 'Voir toutes les épreuves' }).click();
  await expect(visiteur.getByRole('heading', { name: 'Épreuves à venir' })).toBeVisible();
  await visiteurContexte.close();
});
