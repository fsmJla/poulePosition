// Outils partagés des tests des poules (US-086 à US-089) : l'épreuve « M13 Dames » des planches 8 à 10, avec les 24
// tireuses de 6 clubs, importées (fichier de la Fédération, US-083) puis pointées présentes (US-084).
import { expect, type Page } from '@playwright/test';

/** Les 24 tireuses de la maquette, par rang de classement. */
export const TIREUSES: readonly (readonly [string, string, string])[] = [
  ['MARTIN', 'Léa', 'Talence'],
  ['DUBOIS', 'Chloé', 'Pessac (SPUC)'],
  ['BERNARD', 'Inès', 'Mérignac'],
  ['THOMAS', 'Jade', 'Bordeaux BEC'],
  ['ROBERT', 'Manon', 'Libourne'],
  ['RICHARD', 'Zoé', 'Pessac (SPUC)'],
  ['PETIT', 'Louise', 'Bayonne'],
  ['DURAND', 'Emma', 'Talence'],
  ['LEROY', 'Alice', 'Mérignac'],
  ['MOREAU', 'Lina', 'Bordeaux BEC'],
  ['SIMON', 'Rose', 'Pessac (SPUC)'],
  ['LAURENT', 'Anna', 'Libourne'],
  ['LEFEBVRE', 'Mia', 'Bayonne'],
  ['MICHEL', 'Julia', 'Talence'],
  ['GARCIA', 'Lou', 'Mérignac'],
  ['DAVID', 'Agathe', 'Bordeaux BEC'],
  ['BERTRAND', 'Nina', 'Pessac (SPUC)'],
  ['ROUX', 'Romane', 'Libourne'],
  ['VINCENT', 'Sarah', 'Bayonne'],
  ['FOURNIER', 'Clara', 'Talence'],
  ['MOREL', 'Eva', 'Mérignac'],
  ['GIRARD', 'Léna', 'Pessac (SPUC)'],
  ['ANDRÉ', 'Margot', 'Bordeaux BEC'],
  ['MERCIER', 'Iris', 'Libourne'],
];

const echapper = (texte: string) => texte.replaceAll('&', '&amp;').replaceAll('"', '&quot;');

/** Un fichier de la Fédération (UTF-8) avec les `nombre` premières tireuses. */
function fichier(nombre: number) {
  const lignes = TIREUSES.slice(0, nombre).map(
    ([nom, prenom, club], i) =>
      `<Tireur ID="${i + 1}" Nom="${echapper(nom)}" Prenom="${echapper(prenom)}" Sexe="F" ` +
      `Licence="9${String(i + 1).padStart(5, '0')}" Club="${echapper(club)}" Classement="${i + 1}" />`,
  );
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<BaseCompetitionIndividuelle Arme="S" Sexe="F" Categorie="M13"><Tireurs>\n' +
    `${lignes.join('\n')}\n</Tireurs></BaseCompetitionIndividuelle>\n`;
  return { name: 'inscription.xml', mimeType: 'text/xml', buffer: Buffer.from(xml, 'utf-8') };
}

/**
 * Crée une épreuve Dames au sabre pilotée par ce PC, y importe les `nombre` premières tireuses et en pointe `presentes`
 * (toutes par défaut). Retourne l'adresse de l'épreuve ; la page est sur l'émargement.
 */
export async function epreuveAvecPresentes(page: Page, nombre = 24, presentes = nombre): Promise<string> {
  await page.goto('/epreuves/nouvelle?seule');
  await page.getByLabel('Nom de la compétition et de son épreuve').fill(`E2E ${crypto.randomUUID().slice(0, 8)}`);
  await page.getByLabel('Arme').selectOption('sabre');
  await page.getByLabel('Sexe').selectOption('dames');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  const adresse = page.url();
  await page.goto(`${adresse}/inscriptions`);
  await expect(page.getByRole('heading', { level: 2, name: 'Inscriptions' })).toBeVisible({ timeout: 20_000 });
  await page.getByLabel('Fichier d’inscription (XML Engarde / BellePoule)').setInputFiles(fichier(nombre));
  await page
    .getByRole('dialog')
    .getByRole('button', { name: `Importer ${nombre} tireur${nombre > 1 ? 's' : ''}` })
    .click();
  await expect(page.getByRole('region', { name: 'Liste des inscrits' }).locator('tbody tr')).toHaveCount(nombre);
  await page.goto(`${adresse}/emargement`);
  for (const [nom, prenom] of TIREUSES.slice(0, presentes)) {
    const ligne = page.getByRole('checkbox', { name: `Présent : ${nom} ${prenom}` });
    await ligne.click();
    await expect(ligne).toHaveAttribute('aria-checked', 'true');
  }
  return adresse;
}

/** Ouvre l'étape « Poules » de l'épreuve. */
export async function ouvrirPoules(page: Page, adresse: string) {
  await page.goto(`${adresse}/poules`);
  await expect(page.getByRole('heading', { level: 2 })).toBeVisible({ timeout: 20_000 });
}

/** Constitue les poules (US-086) avec le nombre recommandé, en automatique. */
export async function repartir(page: Page, adresse: string) {
  await ouvrirPoules(page, adresse);
  await page.getByRole('button', { name: 'Répartir les poules' }).click();
  await expect(page.getByRole('heading', { level: 2, name: 'Poules' })).toBeVisible();
}

/** La carte d'une poule (US-087). */
export const cartePoule = (page: Page, numero: number) =>
  page.getByRole('region', { name: `Poule ${numero}`, exact: true });
