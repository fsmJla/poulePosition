// Archiver et désarchiver (US-033) : une épreuve (sur son PC pilote, même hors ligne) ou une manifestation entière
// (réseau requis). L'archivage rend l'élément en lecture seule et le masque de la liste, sans rien supprimer.
// « En cours » ne se provoque pas encore par l'interface (E5) : CA-2 est couvert par les tests unitaires du journal.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import {
  ajouterCompetition,
  ajouterEpreuve,
  creerManifestationSimple,
  exposerServeur,
  nomUnique,
  ouvrirManifestation,
  peupler,
} from './planche';

const menuDe = (page: Page, nom: string) => page.getByRole('button', { name: `Autres actions pour ${nom}` });
const entree = (page: Page, nom: RegExp | string) => page.getByRole('menuitem', { name: nom });
const fenetre = (page: Page) => page.getByRole('dialog');

/** Crée une manifestation, une compétition et une épreuve pilotée par ce PC ; ouvre la page de l'épreuve. */
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
  return { manifestation, competition, epreuve, epreuveUrl: page.url() };
}

async function archiverEpreuve(page: Page, epreuve: string) {
  await menuDe(page, epreuve).click();
  await entree(page, /^Archiver/).click();
  await expect(fenetre(page).getByRole('heading', { name: `Archiver l’épreuve « ${epreuve} » ?` })).toBeVisible();
  await fenetre(page).getByRole('button', { name: 'Archiver', exact: true }).click();
  await expect(fenetre(page)).toHaveCount(0);
}

test('US-033 CA-1 et CA-3 : archiver une épreuve la met en lecture seule, la masque de la liste ; désarchiver la rend non publiée', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await seConnecter(page);
  const { manifestation, epreuve } = await creerEpreuvePilotee(page);
  // Publiée avant l'archivage : le désarchivage la rend non publiée (CA-3).
  await page.getByRole('region', { name: 'Publication' }).getByRole('button', { name: 'Publier', exact: true }).click();
  await expect(page.getByText('Publiée', { exact: true })).toBeVisible();

  await archiverEpreuve(page, epreuve);
  await expect(page.getByText('Archivée', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Modifier', exact: true })).toHaveCount(0);
  await menuDe(page, epreuve).click();
  await expect(entree(page, /^Désarchiver/)).toBeVisible();
  await expect(entree(page, /^Archiver/)).toHaveCount(0);
  await page.keyboard.press('Escape');

  // Masquée de « À venir » ; le filtre « Archivées » (US-063) la remontre.
  await page.goto('/organisateur');
  const carte = page.getByRole('article', { name: manifestation });
  await expect(page.getByRole('heading', { name: 'Manifestations et compétitions' })).toBeVisible({ timeout: 20_000 });
  await expect(carte).toHaveCount(0);
  await page.getByRole('button', { name: /^Archivées/ }).click();
  await expect(carte).toContainText('1 épreuve');

  // CA-3 : désarchiver rend le statut d'avant l'archivage, non publiée.
  await page.goBack();
  await menuDe(page, epreuve).click();
  await entree(page, /^Désarchiver/).click();
  await fenetre(page).getByRole('button', { name: 'Désarchiver', exact: true }).click();
  await expect(fenetre(page)).toHaveCount(0);
  await expect(page.getByText('En préparation', { exact: true })).toBeVisible();
  await expect(page.getByText('Non publiée', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Modifier', exact: true })).toBeVisible();
});

test('US-033 hors ligne : une épreuve s’archive sur son PC pilote sans réseau', async ({ page, context }) => {
  test.setTimeout(120_000);
  await seConnecter(page);
  const { epreuve } = await creerEpreuvePilotee(page);
  await context.setOffline(true);
  await archiverEpreuve(page, epreuve);
  await expect(page.getByText('Archivée', { exact: true })).toBeVisible();
  await context.setOffline(false);
  await menuDe(page, epreuve).click();
  await expect(entree(page, /^Désarchiver/)).toBeVisible();
});

test('US-033 CA-4 et CA-6 : un organisateur archive une manifestation avec ses compétitions et ses épreuves, puis la désarchive', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  const { manifestation, epreuve } = await creerEpreuvePilotee(page);

  await ouvrirManifestation(page, manifestation);
  await menuDe(page, manifestation).click();
  await entree(page, /^Archiver/).click();
  await expect(
    fenetre(page).getByRole('heading', { name: `Archiver la manifestation « ${manifestation} » ?` }),
  ).toBeVisible();
  await fenetre(page).getByRole('button', { name: 'Archiver', exact: true }).click();
  await expect(fenetre(page)).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Archivée');

  // Les épreuves sont archivées dans leur journal ; la manifestation est masquée de la liste par défaut.
  await page.goto('/organisateur');
  await expect(page.getByRole('heading', { name: 'Manifestations et compétitions' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('article', { name: manifestation })).toHaveCount(0);
  await page.getByRole('button', { name: /^Archivées/ }).click();
  const carte = page.getByRole('article', { name: manifestation });
  await expect(carte).toBeVisible();
  await expect(carte).toContainText('Archivée');

  // Désarchiver depuis la liste : le tout redevient modifiable.
  await menuDe(page, manifestation).click();
  await entree(page, /^Désarchiver/).click();
  await fenetre(page).getByRole('button', { name: 'Désarchiver', exact: true }).click();
  await expect(fenetre(page)).toHaveCount(0, { timeout: 20_000 });
  await page.getByRole('button', { name: /^À venir/ }).click();
  await expect(page.getByRole('article', { name: manifestation })).toBeVisible();
  await expect(page.getByRole('article', { name: manifestation })).toContainText('1 épreuve');
  await ouvrirManifestation(page, manifestation, 'plan');
  await expect(page.getByText(epreuve, { exact: true }).first()).toBeVisible();
});

test('US-033 CA-5 : une épreuve non archivée pilotée par un autre PC refuse l’archivage de la manifestation', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await seConnecter(page);
  const manifestation = nomUnique();
  await exposerServeur(page);
  await creerManifestationSimple(page, manifestation);
  const competitionId = await ajouterCompetition(page, manifestation, nomUnique());
  // Une épreuve « d'un autre PC » : ce PC n'en est pas le pilote.
  await ajouterEpreuve(page, competitionId, 'Épée dames ailleurs');
  await page.goto('/organisateur');
  const carte = page.getByRole('article', { name: manifestation });
  await expect(carte).toBeVisible({ timeout: 20_000 });
  await menuDe(page, manifestation).click();
  await entree(page, /^Archiver/).click();
  await fenetre(page).getByRole('button', { name: 'Archiver', exact: true }).click();
  const refus = fenetre(page).getByRole('alert');
  await expect(refus).toContainText('Prenez la main sur Épée dames ailleurs ou archivez-les depuis leur PC');
  await fenetre(page).getByRole('button', { name: 'Annuler' }).click();
  await expect(fenetre(page)).toHaveCount(0);
  // Rien n'a été archivé.
  await expect(carte).not.toContainText('Archivée');
});

test('US-033 hors ligne : archiver une manifestation est grisé sans réseau', async ({ page, context }) => {
  test.setTimeout(120_000);
  await seConnecter(page);
  const planche = await peupler(page);
  await page.goto('/organisateur');
  await expect(page.getByRole('article', { name: planche.manifestation })).toBeVisible({ timeout: 20_000 });
  await context.setOffline(true);
  await menuDe(page, planche.manifestation).click();
  const archiver = entree(page, /^Archiver/);
  await expect(archiver).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByText('Nécessite internet').first()).toBeVisible();
  await context.setOffline(false);
});
