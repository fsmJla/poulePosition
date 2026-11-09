// Plan de la manifestation (US-049) : une ligne par compétition, une colonne par jour, des tuiles pour les épreuves.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';

/** Nom unique, pour reconnaître les données de ce test parmi celles du club. */
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

const SAMEDI = 'dimanche 14 mars 2027';
const LUNDI = 'lundi 15 mars 2027';

/** Une manifestation du 14 au 15 mars 2027 avec une compétition au sabre, puis son plan ouvert depuis la page Manifestations. */
async function ouvrirLePlan(page: Page, manifestation: string, competition: string) {
  await page.goto('/manifestations');
  await page.getByRole('button', { name: 'Nouvelle manifestation' }).click();
  await page.getByLabel('Nom', { exact: true }).fill(manifestation);
  await page.getByLabel('Date de début').fill('2027-03-14');
  await page.getByLabel('Date de fin').fill('2027-03-15');
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
async function ajouterUneEpreuve(page: Page, competition: string, jour: string, nom: string) {
  await page.getByRole('button', { name: `Ajouter une épreuve à ${competition}, ${jour}` }).click();
  await expect(page.getByLabel('Compétition', { exact: true })).not.toHaveValue('');
  await expect(page.getByRole('button', { name: jour })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Nom', { exact: true }).fill(nom);
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
  await expect(panneau.getByRole('link', { name: 'Ouvrir l’épreuve' })).toBeVisible();

  // CA-4 : « Changer de jour » déplace la tuile dans la colonne du lundi.
  await panneau.getByLabel('Nouveau jour').selectOption({ label: LUNDI });
  await panneau.getByRole('button', { name: 'Changer de jour' }).click();
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
  await panneau.getByLabel('Nouveau jour').selectOption({ label: LUNDI });
  await panneau.getByRole('button', { name: 'Changer de jour' }).click();
  await expect(panneau).toContainText(`Épreuve déplacée au ${LUNDI}`);

  await context.setOffline(false);
});
