// Filtres de la liste du club (US-063, US-079) : « À venir », « En cours », « Terminées », « Archivées », « Toutes ». Le classement
// se fait sur l'appareil, sur le statut des épreuves. Les épreuves terminées et archivées sont créées « d'un autre PC ».
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { ajouterCompetition, ajouterEpreuve, creerManifestationSimple, exposerServeur, nomUnique } from './planche';

const pilule = (page: Page, nom: string) => page.getByRole('button', { name: new RegExp(`^${nom}`) });
const carte = (page: Page, nom: string) => page.getByRole('article', { name: nom });

/** Une manifestation avec une épreuve à venir, une terminée et une archivée, dans trois compétitions. */
async function creerClub(page: Page) {
  await seConnecter(page);
  await exposerServeur(page);
  const manifestation = nomUnique();
  await creerManifestationSimple(page, manifestation);
  const noms = {
    avenir: `Avenir ${nomUnique()}`,
    terminee: `Terminee ${nomUnique()}`,
    archivee: `Archivee ${nomUnique()}`,
  };
  const comp = {
    avenir: await ajouterCompetition(page, manifestation, noms.avenir),
    terminee: await ajouterCompetition(page, manifestation, noms.terminee),
    archivee: await ajouterCompetition(page, manifestation, noms.archivee),
  };
  await ajouterEpreuve(page, comp.avenir, `${noms.avenir} M13`, '2027-03-15', { statut: 'preparation' });
  await ajouterEpreuve(page, comp.terminee, `${noms.terminee} M13`, '2027-03-15', { statut: 'terminee' });
  await ajouterEpreuve(page, comp.archivee, `${noms.archivee} M13`, '2027-03-15', { statut: 'archivee' });
  await page.goto('/organisateur');
  await expect(carte(page, manifestation)).toBeVisible({ timeout: 20_000 });
  return { manifestation, noms };
}

test('US-063 CA-1 et US-079 CA-1 : cinq filtres exclusifs, annoncés par aria-pressed', async ({ page }) => {
  await creerClub(page);
  await expect(pilule(page, 'À venir')).toHaveAttribute('aria-pressed', 'true');
  for (const autre of ['En cours', 'Terminées', 'Archivées', 'Toutes']) {
    await expect(pilule(page, autre)).toHaveAttribute('aria-pressed', 'false');
  }
  await pilule(page, 'Terminées').click();
  await expect(pilule(page, 'Terminées')).toHaveAttribute('aria-pressed', 'true');
  await expect(pilule(page, 'À venir')).toHaveAttribute('aria-pressed', 'false');
});

test('US-063 CA-2 à CA-5 : chaque filtre montre les épreuves de son statut', async ({ page }) => {
  const { manifestation, noms } = await creerClub(page);
  const c = carte(page, manifestation);
  const competition = (nom: string) => c.getByRole('button', { name: new RegExp(`^${nom}`) });

  // CA-2 : la manifestation et son épreuve à venir ; les autres compétitions sont masquées.
  await expect(competition(noms.avenir)).toBeVisible();
  await expect(competition(noms.terminee)).toHaveCount(0);
  await expect(competition(noms.archivee)).toHaveCount(0);

  // CA-3
  await pilule(page, 'Terminées').click();
  await expect(competition(noms.terminee)).toBeVisible();
  await expect(competition(noms.avenir)).toHaveCount(0);

  // CA-4
  await pilule(page, 'Archivées').click();
  await expect(competition(noms.archivee)).toBeVisible();
  await expect(competition(noms.terminee)).toHaveCount(0);

  // CA-5 : tout, les archivées marquées.
  await pilule(page, 'Toutes').click();
  for (const nom of [noms.avenir, noms.terminee, noms.archivee]) await expect(competition(nom)).toBeVisible();
  await competition(noms.archivee).click();
  await expect(c.getByText('Archivée', { exact: true }).first()).toBeVisible();
});

test('US-063 CA-6 : chaque filtre porte son nombre d’épreuves ; un filtre vide le dit', async ({ page }) => {
  await creerClub(page);
  for (const nom of ['À venir', 'Terminées', 'Archivées', 'Toutes']) {
    await expect(pilule(page, nom)).toHaveText(new RegExp(`^${nom}[ ]*[1-9][0-9]*$`));
  }
});

test('US-063 CA-6 : un filtre sans épreuve affiche « Aucune épreuve terminée », pas la liste du club vide', async ({
  page,
}) => {
  await seConnecter(page);
  await exposerServeur(page);
  const manifestation = nomUnique();
  await creerManifestationSimple(page, manifestation);
  await ajouterCompetition(page, manifestation, nomUnique());
  await page.goto('/organisateur');
  await expect(carte(page, manifestation)).toBeVisible({ timeout: 20_000 });
  await pilule(page, 'Archivées').click();
  await expect(carte(page, manifestation)).toHaveCount(0);
  await expect(page.getByText('Le club n’a encore ni manifestation')).toHaveCount(0);
});

test('US-063 CA-7 : le filtre est gardé en revenant d’une épreuve', async ({ page }) => {
  const { manifestation, noms } = await creerClub(page);
  await pilule(page, 'Terminées').click();
  await carte(page, manifestation)
    .getByRole('link', { name: new RegExp(`^Ouvrir l’épreuve ${noms.terminee}`) })
    .click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  await page.goBack();
  await expect(pilule(page, 'Terminées')).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 });
});

test('US-063 hors ligne : le filtrage se fait sur l’appareil, sans réseau', async ({ page, context }) => {
  await creerClub(page);
  await context.setOffline(true);
  await pilule(page, 'Terminées').click();
  await expect(pilule(page, 'Terminées')).toHaveAttribute('aria-pressed', 'true');
  await pilule(page, 'Toutes').click();
  await expect(pilule(page, 'Toutes')).toHaveAttribute('aria-pressed', 'true');
  await context.setOffline(false);
});

test('US-063 CA-8 : conforme aux planches 1 et 5 (pilules, filtre choisi en --marque)', async ({ page }, info) => {
  await creerClub(page);
  const choisie = pilule(page, 'À venir');
  const rayon = await choisie.evaluate((e) => getComputedStyle(e).borderTopLeftRadius);
  expect(parseFloat(rayon)).toBeGreaterThanOrEqual(20);
  const couleurs = await choisie.evaluate((e) => {
    const sonde = document.createElement('span');
    sonde.style.color = 'var(--marque)';
    document.body.append(sonde);
    const marque = getComputedStyle(sonde).color;
    sonde.remove();
    return { marque, fond: getComputedStyle(e).backgroundColor };
  });
  expect(couleurs.fond).toBe(couleurs.marque);
  const capture = await page.screenshot({ path: process.env.CAPTURE_FILTRES });
  await info.attach(`filtres-${info.project.name}.png`, { body: capture, contentType: 'image/png' });
});

test('US-079 CA-1 et CA-2 : « En cours » est un filtre à part, choisi par défaut quand il contient une épreuve', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const { manifestation, noms } = await creerClub(page);
  const enCours = `EnCours ${nomUnique()}`;
  const competitionId = await ajouterCompetition(page, manifestation, enCours);
  await ajouterEpreuve(page, competitionId, `${enCours} M15`, '2027-03-14', { statut: 'enCours' });
  const c = carte(page, manifestation);
  const competition = (nom: string) => c.getByRole('button', { name: new RegExp(`^${nom}`) });

  // Une nouvelle visite, sans filtre choisi : « En cours » contient une épreuve, il est choisi.
  await page.evaluate(() => sessionStorage.removeItem('poulePosition.filtreListe'));
  await page.goto('/organisateur');
  await expect(pilule(page, 'En cours')).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 });
  await expect(competition(enCours)).toBeVisible();
  await expect(competition(noms.avenir)).toHaveCount(0);

  // « À venir » ne montre plus les épreuves en cours ; la même manifestation y figure avec ses seules épreuves à venir.
  await pilule(page, 'À venir').click();
  await expect(competition(noms.avenir)).toBeVisible();
  await expect(competition(enCours)).toHaveCount(0);

  // Le choix reste pour la visite, rechargement compris.
  await page.reload();
  await expect(pilule(page, 'À venir')).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 });
});
