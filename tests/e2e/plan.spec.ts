// Plan de la manifestation (US-049, US-050) : une ligne par compétition, une colonne par jour, des tuiles pour les épreuves.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';

/** Nom unique, pour reconnaître les données de ce test parmi celles du club. */
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

const SAMEDI = 'dimanche 14 mars 2027';
const LUNDI = 'lundi 15 mars 2027';

/** Une manifestation du 14 mars 2027 au jour `fin` (le 15 par défaut) avec une compétition au sabre, puis son plan ouvert depuis la page Manifestations. */
async function ouvrirLePlan(page: Page, manifestation: string, competition: string, fin = '2027-03-15') {
  await page.goto('/manifestations');
  await page.getByRole('button', { name: 'Nouvelle manifestation' }).click();
  await page.getByLabel('Nom', { exact: true }).fill(manifestation);
  await page.getByLabel('Date de début').fill('2027-03-14');
  await page.getByLabel('Date de fin').fill(fin);
  await page.getByLabel('Lieu').fill('Salle Bellegrave');
  await page.getByRole('button', { name: 'Créer la manifestation' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: manifestation }).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: `Ajouter une compétition à ${manifestation}` }).click();
  await page.getByLabel('Nom de la compétition').fill(competition);
  await page.getByLabel('Arme').selectOption('sabre');
  await page.getByRole('button', { name: 'Créer la compétition' }).click();
  await expect(
    page.getByRole('region', { name: `Compétitions de ${manifestation}` }).getByText(competition),
  ).toBeVisible({ timeout: 20_000 });
  await page.getByRole('link', { name: `Voir le plan de ${manifestation}` }).click();
  await expect(page.getByRole('heading', { level: 1, name: manifestation })).toBeVisible();
}

/** « + Épreuve » d'une case : le formulaire s'ouvre avec la compétition et le jour ; on donne un nom et on crée. */
async function ajouterUneEpreuve(
  page: Page,
  competition: string,
  jour: string,
  nom: string,
  horaires?: { appel: string; scratch: string; debutPoules: string },
) {
  await page.getByRole('button', { name: `Ajouter une épreuve à ${competition}, ${jour}` }).click();
  await expect(page.getByLabel('Compétition', { exact: true })).not.toHaveValue('');
  await expect(page.getByRole('button', { name: jour })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Nom', { exact: true }).fill(nom);
  if (horaires) {
    await page.getByLabel('Appel', { exact: true }).fill(horaires.appel);
    await page.getByLabel('Scratch', { exact: true }).fill(horaires.scratch);
    await page.getByLabel('Début des poules', { exact: true }).fill(horaires.debutPoules);
  }
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
}

const tuile = (page: Page, nom: string) => page.getByRole('button', { name: `Épreuve ${nom}`, exact: true });

test('US-049 CA-1, CA-2, CA-3 et CA-4 : lire le plan, y ajouter une épreuve, voir ses valeurs reprises et la changer de jour', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const manifestation = nomUnique();
  const competition = nomUnique();
  const epreuve = `${competition} M13`;
  await seConnecter(page);
  await ouvrirLePlan(page, manifestation, competition);
  await page.setViewportSize({ width: 1280, height: 900 });

  // CA-1 : l'entête, une colonne par jour, une ligne par compétition.
  await expect(page.getByText('Aucune épreuve', { exact: true })).toBeVisible();
  await expect(page.getByText('Salle Bellegrave').first()).toBeVisible();
  await expect(page.getByRole('columnheader', { name: SAMEDI })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: LUNDI })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: new RegExp(competition) })).toContainText('Sabre');
  await expect(page.getByRole('columnheader', { name: 'Jour à fixer' })).toHaveCount(0);

  // CA-2 : « + Épreuve » préchoisit la compétition et le jour ; « Annuler » revient au plan.
  await page.getByRole('button', { name: `Ajouter une épreuve à ${competition}, ${SAMEDI}` }).click();
  await expect(page.getByLabel('Compétition', { exact: true })).not.toHaveValue('');
  await page.getByRole('link', { name: 'Annuler' }).click();
  await expect(page.getByRole('heading', { level: 1, name: manifestation })).toBeVisible();
  await ajouterUneEpreuve(page, competition, SAMEDI, epreuve);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });

  // CA-1 : la tuile est dans la case du dimanche et l'entête compte une épreuve.
  await page.goto('/manifestations');
  await page.getByRole('link', { name: `Voir le plan de ${manifestation}` }).click();
  await expect(page.getByText('1 épreuve', { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(tuile(page, epreuve)).toBeVisible();

  // CA-3 : le panneau montre les valeurs reprises avec leur origine.
  await tuile(page, epreuve).click();
  const panneau = page.getByRole('region', { name: `Détail de l’épreuve ${epreuve}` });
  await expect(panneau).toContainText('comme la compétition');
  await expect(panneau).toContainText(SAMEDI);
  // US-050 cas limite : aucun horaire renseigné, le panneau n'en montre aucun.
  await expect(panneau).toContainText(/Horaires\s*—/);
  await expect(panneau.getByRole('link', { name: 'Ouvrir l’épreuve' })).toBeVisible();

  // CA-4 : « Changer de jour » déplace la tuile dans la colonne du lundi.
  await panneau.getByRole('button', { name: 'Changer de jour : lundi' }).click();
  await expect(panneau).toContainText(`Épreuve déplacée au ${LUNDI}`);
  const colonneLundi = page.getByRole('columnheader').nth(2);
  await expect(colonneLundi).toContainText(LUNDI);
  await expect(
    page
      .locator('tbody tr td')
      .nth(1)
      .getByRole('button', { name: /^Épreuve / }),
  ).toBeVisible();
  await expect(
    page
      .locator('tbody tr td')
      .nth(0)
      .getByRole('button', { name: /^Épreuve / }),
  ).toHaveCount(0);

  // CA-2 : « Ajouter des épreuves » de la ligne ouvre la grille d'US-048.
  await page.getByRole('link', { name: `Ajouter des épreuves à ${competition}` }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Ajouter des épreuves' })).toBeVisible();
});

test('US-049 CA-6 : sur un écran étroit, un bloc par jour sans débordement horizontal', async ({ page }) => {
  test.setTimeout(90_000);
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await page.setViewportSize({ width: 390, height: 800 });
  await ouvrirLePlan(page, manifestation, competition);
  await ajouterUneEpreuve(page, competition, SAMEDI, `${competition} M15`);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
  await page.goto('/manifestations');
  await page.getByRole('link', { name: `Voir le plan de ${manifestation}` }).click();

  await expect(page.getByRole('heading', { level: 2, name: SAMEDI })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { level: 2, name: LUNDI })).toBeVisible();
  await expect(page.getByRole('table')).toHaveCount(0);
  await expect(tuile(page, `${competition} M15`)).toBeVisible();
  const debordement = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(debordement).toBeLessThanOrEqual(0);
});

test('US-049 cas limite : une manifestation sans compétition garde ses jours et invite à ajouter une première compétition', async ({
  page,
}) => {
  const manifestation = nomUnique();
  await seConnecter(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/manifestations');
  await page.getByRole('button', { name: 'Nouvelle manifestation' }).click();
  await page.getByLabel('Nom', { exact: true }).fill(manifestation);
  await page.getByLabel('Date de début').fill('2027-03-14');
  await page.getByLabel('Date de fin').fill('2027-03-15');
  await page.getByRole('button', { name: 'Créer la manifestation' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: manifestation }).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('link', { name: `Voir le plan de ${manifestation}` }).click();

  await expect(page.getByRole('heading', { level: 1, name: manifestation })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajouter une première compétition' })).toBeEnabled();
  await expect(page.getByText('Aucune épreuve', { exact: true })).toBeVisible();

  // CA-2 : « Modifier la manifestation » ouvre son formulaire sur la page Manifestations.
  await page.getByRole('button', { name: 'Modifier la manifestation' }).click();
  await expect(page.getByRole('heading', { name: `Modifier « ${manifestation} »` })).toBeVisible();
});

test('US-049 hors ligne : le plan reste affiché, on y ajoute une épreuve et on la change de jour, sans créer de compétition', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  const manifestation = nomUnique();
  const competition = nomUnique();
  const epreuve = `${competition} M17`;
  await seConnecter(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await ouvrirLePlan(page, manifestation, competition);
  // La copie de l'appareil se remplit à la lecture du plan en ligne.
  await expect(page.getByRole('rowheader', { name: new RegExp(competition) })).toBeVisible();

  await context.setOffline(true);
  await expect(page.getByText(/^Hors ligne : plan du /)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Ajouter une compétition' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Modifier la manifestation' })).toBeDisabled();
  await expect(page.getByText('Nécessite une connexion internet')).toBeVisible();

  // « + Épreuve » écrit dans le journal local de cet appareil.
  await ajouterUneEpreuve(page, competition, SAMEDI, epreuve);
  await page.goBack();
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1, name: manifestation })).toBeVisible();
  await expect(tuile(page, epreuve)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Pas encore envoyée')).toBeVisible();

  // « Changer de jour » aussi : épreuve pilotée ici, compétition connue.
  await tuile(page, epreuve).click();
  const panneau = page.getByRole('region', { name: `Détail de l’épreuve ${epreuve}` });
  await panneau.getByRole('button', { name: 'Changer de jour : lundi' }).click();
  await expect(panneau).toContainText(`Épreuve déplacée au ${LUNDI}`);

  await context.setOffline(false);
});

/** Couleur calculée d'une variable de la charte (`--marque`…), pour la comparer à celle d'un élément. */
const couleurDe = (page: Page, variable: string) =>
  page.evaluate((nom) => {
    const sonde = document.createElement('div');
    sonde.style.background = `var(${nom})`;
    document.body.append(sonde);
    const couleur = getComputedStyle(sonde).backgroundColor;
    sonde.remove();
    return couleur;
  }, variable);

test('US-050 CA-1 et CA-3 : un bandeau foncé donne le compte de compétitions et d’épreuves, et chaque compétition est une bande teintée', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await ouvrirLePlan(page, manifestation, competition);

  // CA-3 : le bandeau, de la couleur de la marque, avec le nom, le lieu, les comptes et les deux actions.
  const bandeau = page.locator('header.bandeau');
  await expect(bandeau).toContainText(manifestation);
  await expect(bandeau).toContainText('Salle Bellegrave');
  await expect(bandeau).toContainText('1 compétition');
  await expect(bandeau).toContainText('Aucune épreuve');
  await expect(bandeau.getByRole('button', { name: 'Modifier la manifestation' })).toBeVisible();
  await expect(bandeau.getByRole('button', { name: 'Ajouter une compétition' })).toBeVisible();
  expect(await bandeau.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    await couleurDe(page, '--marque'),
  );

  // CA-1 : la ligne est une bande au fond teinté, et le nom prend la couleur de la compétition.
  const ligne = page.getByRole('row').filter({ hasText: competition });
  const fondBande = await ligne.getByRole('rowheader').evaluate((cellule) => getComputedStyle(cellule).backgroundColor);
  expect(fondBande).not.toBe('rgba(0, 0, 0, 0)');
  expect(fondBande).not.toBe(await couleurDe(page, '--surface'));
  const couleurNom = await ligne.locator('.nom-competition strong').evaluate((nom) => getComputedStyle(nom).color);
  const couleurBarre = await ligne.locator('.couleur').evaluate((barre) => getComputedStyle(barre).backgroundColor);
  expect(couleurNom).toBe(couleurBarre);
});

test('US-050 CA-2, CA-4, CA-5 et CA-6 : le panneau est à côté du tableau avec tous les horaires, l’origine du jour et le changement de jour direct', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const manifestation = nomUnique();
  const competition = nomUnique();
  const epreuve = `${competition} M15`;
  await seConnecter(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await ouvrirLePlan(page, manifestation, competition);
  await ajouterUneEpreuve(page, competition, SAMEDI, epreuve, {
    appel: '08:30',
    scratch: '09:00',
    debutPoules: '09:30',
  });
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
  await page.goto('/manifestations');
  await page.getByRole('link', { name: `Voir le plan de ${manifestation}` }).click();
  await expect(tuile(page, epreuve)).toBeVisible({ timeout: 20_000 });

  // CA-2 : la tuile choisie est mise en évidence et le panneau s'ouvre à droite du tableau.
  await tuile(page, epreuve).click();
  await expect(tuile(page, epreuve)).toHaveAttribute('aria-pressed', 'true');
  expect(await tuile(page, epreuve).evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe('none');
  const panneau = page.getByRole('region', { name: `Détail de l’épreuve ${epreuve}` });
  const tableau = await page.getByRole('table').boundingBox();
  const volet = await panneau.boundingBox();
  expect(tableau && volet).toBeTruthy();
  expect(volet!.x).toBeGreaterThanOrEqual(tableau!.x + tableau!.width - 1);
  expect(volet!.y).toBeLessThan(tableau!.y + tableau!.height);

  // CA-4 : l'appel, le scratch et le début des poules. CA-5 : l'origine du jour.
  await expect(panneau).toContainText('appel 08:30 · scratch 09:00 · poules 09:30');
  await expect(panneau).toContainText(SAMEDI);
  await expect(panneau).toContainText('jour de la manifestation');

  // CA-6 : un seul geste pour changer de jour, dans les deux sens.
  await panneau.getByRole('button', { name: 'Changer de jour : lundi' }).click();
  await expect(panneau).toContainText(`Épreuve déplacée au ${LUNDI}`);
  await expect(panneau.getByRole('button', { name: 'Changer de jour : dimanche' })).toBeVisible();
  await expect(panneau.getByLabel('Nouveau jour')).toHaveCount(0);

  // CA-2 : sur un écran étroit, le panneau reste sous la liste, sans débordement horizontal.
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(page.getByRole('table')).toHaveCount(0);
  const etroit = await panneau.boundingBox();
  const tuileEtroite = await tuile(page, epreuve).boundingBox();
  expect(etroit!.y).toBeGreaterThan(tuileEtroite!.y);
  const debordement = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(debordement).toBeLessThanOrEqual(0);
});

test('US-050 CA-6 : à trois jours, le choix du jour reste proposé à la place du bouton direct', async ({ page }) => {
  test.setTimeout(120_000);
  const manifestation = nomUnique();
  const competition = nomUnique();
  const epreuve = `${competition} M17`;
  await seConnecter(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await ouvrirLePlan(page, manifestation, competition, '2027-03-16');
  await ajouterUneEpreuve(page, competition, SAMEDI, epreuve);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
  await page.goto('/manifestations');
  await page.getByRole('link', { name: `Voir le plan de ${manifestation}` }).click();
  await expect(tuile(page, epreuve)).toBeVisible({ timeout: 20_000 });

  await tuile(page, epreuve).click();
  const panneau = page.getByRole('region', { name: `Détail de l’épreuve ${epreuve}` });
  await expect(panneau.getByLabel('Nouveau jour')).toBeVisible();
  await expect(panneau.getByRole('button', { name: 'Changer de jour', exact: true })).toBeVisible();
  await expect(panneau.getByRole('button', { name: 'Changer de jour : lundi' })).toHaveCount(0);
  await panneau.getByLabel('Nouveau jour').selectOption({ label: 'mardi 16 mars 2027' });
  await panneau.getByRole('button', { name: 'Changer de jour', exact: true }).click();
  await expect(panneau).toContainText('Épreuve déplacée au mardi 16 mars 2027');
});
