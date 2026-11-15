// Plan de la manifestation (US-049, US-050) : une ligne par compétition, une colonne par jour, des tuiles pour les épreuves.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { regler } from './heure';
import { ajouterCompetition, creerManifestationSimple, ouvrirManifestation } from './planche';

/** Nom unique, pour reconnaître les données de ce test parmi celles du club. */
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

const SAMEDI = 'dimanche 14 mars 2027';
const LUNDI = 'lundi 15 mars 2027';

/** Une manifestation du 14 mars 2027 au jour `fin` (le 15 par défaut) avec une compétition au sabre, créées au serveur, puis son onglet « Plan » ouvert. */
async function ouvrirLePlan(page: Page, manifestation: string, competition: string, fin = '2027-03-15') {
  await creerManifestationSimple(page, manifestation, '2027-03-14', fin);
  await ajouterCompetition(page, manifestation, competition);
  await ouvrirManifestation(page, manifestation, 'plan');
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
    await regler(page, 'Appel', horaires.appel);
    await regler(page, 'Scratch', horaires.scratch);
    await regler(page, 'Début des poules', horaires.debutPoules);
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
  await expect(page.getByRole('button', { name: /^Épreuve / })).toHaveCount(0);
  await expect(page.getByText('Salle Bellegrave').first()).toBeVisible();
  await expect(page.getByRole('columnheader', { name: SAMEDI })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: LUNDI })).toBeVisible();
  await expect(page.getByRole('rowheader', { name: new RegExp(competition) })).toContainText('Sabre');
  await expect(page.getByRole('columnheader', { name: 'Jour à fixer' })).toHaveCount(0);

  // CA-2 : « + Épreuve » préchoisit la compétition et le jour ; « Annuler » revient au plan.
  await page.getByRole('button', { name: `Ajouter une épreuve à ${competition}, ${SAMEDI}` }).click();
  await expect(page.getByLabel('Compétition', { exact: true })).not.toHaveValue('');
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: manifestation })).toBeVisible();
  await ajouterUneEpreuve(page, competition, SAMEDI, epreuve);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });

  // CA-1 : la tuile est dans la case du dimanche et l'entête compte une épreuve.
  await ouvrirManifestation(page, manifestation, 'plan');
  await expect(tuile(page, epreuve)).toBeVisible({ timeout: 20_000 });

  // CA-3 : le panneau montre les valeurs reprises avec leur origine.
  await tuile(page, epreuve).click();
  const panneau = page.getByRole('region', { name: `Détail de l’épreuve ${epreuve}` });
  await expect(panneau).toContainText('comme la compétition');
  await expect(panneau).toContainText(SAMEDI);
  // US-069 : les horaires reprennent 9 h 00 par défaut (le cas « aucun horaire » reste couvert par les tests de la grille).
  await expect(panneau).toContainText(/Horaires\s*appel 09:00/);
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
  await ouvrirManifestation(page, manifestation, 'plan');

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
  await creerManifestationSimple(page, manifestation);
  await ouvrirManifestation(page, manifestation, 'plan');
  await expect(page.getByRole('heading', { level: 1, name: manifestation })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajouter une première compétition' })).toBeEnabled();
  await expect(page.getByRole('button', { name: /^Épreuve / })).toHaveCount(0);

  // US-056 CA-7 : « Modifier » ouvre le formulaire de la manifestation sur sa page.
  await page.getByRole('button', { name: 'Modifier', exact: true }).click();
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
  await expect(page.getByRole('button', { name: 'Modifier', exact: true })).toBeDisabled();
  await expect(page.getByText('Nécessite une connexion internet').first()).toBeVisible();

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

test('US-050 CA-1 : chaque compétition est une bande teintée (le bandeau d’entête est remplacé par la page de la manifestation, US-056 CA-1)', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await ouvrirLePlan(page, manifestation, competition);

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
  await ouvrirManifestation(page, manifestation, 'plan');
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
  await ouvrirManifestation(page, manifestation, 'plan');
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

/** L'onglet « Plan » de la manifestation, avec le nombre de tuiles d'épreuve attendu. */
async function rouvrirLePlan(page: Page, manifestation: string, epreuves: number) {
  await ouvrirManifestation(page, manifestation, 'plan');
  await expect(page.getByRole('button', { name: /^Épreuve / })).toHaveCount(epreuves, { timeout: 20_000 });
}

test('US-051 CA-1, CA-2, CA-3, CA-4, CA-5 et CA-6 : dupliquer une épreuve depuis le plan, sans horaires, avec un nom de copie et un avertissement si le nom est pris', async ({
  page,
}) => {
  test.setTimeout(150_000);
  const manifestation = nomUnique();
  const competition = nomUnique();
  const epreuve = `${competition} M13`;
  await seConnecter(page);
  await ouvrirLePlan(page, manifestation, competition);
  await page.setViewportSize({ width: 1280, height: 900 });
  await ajouterUneEpreuve(page, competition, SAMEDI, epreuve, {
    appel: '08:30',
    scratch: '09:00',
    debutPoules: '09:30',
  });
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
  await rouvrirLePlan(page, manifestation, 1);

  // CA-1 : « Dupliquer » est dans le panneau, à côté de « Ouvrir l'épreuve ».
  await tuile(page, epreuve).click();
  const panneau = page.getByRole('region', { name: `Détail de l’épreuve ${epreuve}` });
  await expect(panneau.getByRole('link', { name: 'Ouvrir l’épreuve' })).toBeVisible();
  await panneau.getByRole('link', { name: 'Dupliquer' }).click();

  // CA-2, CA-3 et CA-4 : formulaire prérempli (compétition, jour), horaires vides, nom « … (copie) ».
  await expect(page).toHaveURL(/\/epreuves\/nouvelle\?.*copie=/);
  await expect(page.getByLabel('Nom', { exact: true })).toHaveValue(`${epreuve} (copie)`);
  await expect(page.getByLabel('Compétition', { exact: true })).not.toHaveValue('');
  await expect(page.getByRole('button', { name: SAMEDI })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Appel — heures', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Scratch — heures', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Début des poules — heures', { exact: true })).toHaveValue('');

  // CA-2 : « Annuler » revient au plan sans rien créer.
  await page.getByRole('button', { name: 'Annuler', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: manifestation })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Épreuve / })).toHaveCount(1);

  // CA-5 : valider crée une épreuve de plus, dans la case de sa compétition et de son jour.
  await tuile(page, epreuve).click();
  await panneau.getByRole('link', { name: 'Dupliquer' }).click();
  await expect(page.getByLabel('Nom', { exact: true })).toHaveValue(`${epreuve} (copie)`);
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
  await rouvrirLePlan(page, manifestation, 2);
  await expect(tuile(page, `${epreuve} (copie)`)).toBeVisible();

  // CA-4 : une seconde copie passe à « (copie 2) ».
  await tuile(page, epreuve).click();
  await panneau.getByRole('link', { name: 'Dupliquer' }).click();
  await expect(page.getByLabel('Nom', { exact: true })).toHaveValue(`${epreuve} (copie 2)`);

  // CA-6 : un nom déjà pris est signalé, mais on peut créer quand même.
  await page.getByLabel('Nom', { exact: true }).fill(epreuve);
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Une épreuve porte déjà ce nom dans cette compétition' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/epreuves\/nouvelle/);
  await page.getByRole('button', { name: 'Créer quand même' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
  await rouvrirLePlan(page, manifestation, 3);
});

test('US-051 hors ligne : « Dupliquer » reste possible et la copie s’écrit dans le journal local', async ({
  page,
  context,
}) => {
  test.setTimeout(150_000);
  const manifestation = nomUnique();
  const competition = nomUnique();
  const epreuve = `${competition} M17`;
  await seConnecter(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await ouvrirLePlan(page, manifestation, competition);
  await expect(page.getByRole('rowheader', { name: new RegExp(competition) })).toBeVisible();

  await context.setOffline(true);
  await expect(page.getByText(/^Hors ligne : plan du /)).toBeVisible({ timeout: 20_000 });
  await ajouterUneEpreuve(page, competition, SAMEDI, epreuve);
  await page.goBack();
  await page.goBack();
  await expect(tuile(page, epreuve)).toBeVisible({ timeout: 20_000 });

  await tuile(page, epreuve).click();
  await page
    .getByRole('region', { name: `Détail de l’épreuve ${epreuve}` })
    .getByRole('link', { name: 'Dupliquer' })
    .click();
  await expect(page.getByLabel('Nom', { exact: true })).toHaveValue(`${epreuve} (copie)`);
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  await page.goBack();
  await page.goBack();
  await expect(tuile(page, `${epreuve} (copie)`)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Pas encore envoyée')).toHaveCount(2);

  await context.setOffline(false);
});
