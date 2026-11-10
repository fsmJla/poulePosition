// Assistant de manifestation (US-047) : créer pas à pas une manifestation, ses compétitions puis leurs épreuves.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';

/** Nom unique, pour reconnaître les données de ce test parmi celles du club. */
const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

const etape = (page: Page, nom: string) => page.getByRole('listitem').filter({ hasText: nom }).first();
const apercu = (page: Page) => page.getByRole('complementary', { name: 'Aperçu en direct' });

/** Étape 1 : les champs de la manifestation du 14 au 15 mars 2027, sans valider. */
async function remplirManifestation(page: Page, nom: string) {
  await page.getByLabel('Nom', { exact: true }).fill(nom);
  await page.getByLabel('Date de début').fill('2027-03-14');
  await page.getByLabel('Date de fin').fill('2027-03-15');
  await page.getByLabel('Lieu').fill('Salle Bellegrave');
}

/** Ouvre l'assistant, remplit la manifestation et passe à l'étape Compétitions. */
async function commencer(page: Page, manifestation: string) {
  await seConnecter(page);
  await page.goto('/organisateur');
  await page.getByRole('link', { name: 'Nouvelle manifestation' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'La manifestation' })).toBeVisible();
  await remplirManifestation(page, manifestation);
  await page.getByRole('button', { name: 'Suivant : Compétitions' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Les compétitions du week-end' })).toBeVisible({
    timeout: 20_000,
  });
}

async function ajouterCompetition(page: Page, nom: string, arme: string) {
  await page.getByLabel('Nom de la compétition').fill(nom);
  await page.getByRole('button', { name: arme, exact: true }).click();
  await page.getByRole('button', { name: 'Ajouter la compétition' }).click();
  await expect(page.getByText(`Compétition « ${nom} » créée`)).toBeVisible({ timeout: 20_000 });
}

test('US-047 CA-1, CA-2 et CA-3 : quatre étapes, aperçu en direct, manifestation et compétition enregistrées', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await page.goto('/organisateur');
  await page.getByRole('link', { name: 'Nouvelle manifestation' }).click();

  // CA-1 : les quatre étapes, la première en cours.
  const etapes = page.getByRole('list', { name: 'Étapes' });
  for (const nom of ['Manifestation', 'Compétitions', 'Épreuves', 'Vérifier']) await expect(etapes).toContainText(nom);
  await expect(etape(page, 'Manifestation')).toHaveAttribute('aria-current', 'step');

  // CA-2 : l'aperçu suit la saisie.
  await expect(apercu(page)).toContainText('La manifestation apparaît ici');
  await remplirManifestation(page, manifestation);
  await expect(apercu(page)).toContainText(manifestation);
  await expect(apercu(page)).toContainText('Salle Bellegrave');

  // CA-3 : « Suivant » crée la manifestation ; l'étape suivante est en cours, la première cochée.
  await page.getByRole('button', { name: 'Suivant : Compétitions' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Les compétitions du week-end' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(etape(page, 'Compétitions')).toHaveAttribute('aria-current', 'step');
  await expect(etape(page, 'Manifestation')).toContainText('✓');

  // CA-2 : la compétition en cours de saisie apparaît dans l'aperçu, puis est créée.
  await page.getByLabel('Nom de la compétition').fill(competition);
  await expect(apercu(page)).toContainText(competition);
  await expect(apercu(page)).toContainText('en cours de saisie');
  await page.getByRole('button', { name: 'Sabre', exact: true }).click();
  await page.getByRole('button', { name: 'Ajouter la compétition' }).click();
  await expect(page.getByText(`Compétition « ${competition} » créée`)).toBeVisible({ timeout: 20_000 });
  await expect(apercu(page)).toContainText('0 épreuve');
  await expect(apercu(page)).not.toContainText('en cours de saisie');

  // CA-3 : quitter l'assistant ne perd rien, la manifestation et sa compétition sont dans la liste.
  await page.goto('/manifestations');
  const carte = page.getByRole('listitem').filter({ hasText: manifestation }).first();
  await expect(carte).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('region', { name: `Compétitions de ${manifestation}` })).toContainText(competition);
});

test('US-047 CA-3, CA-5 : les épreuves cochées à l’étape 3 se créent, l’étape Vérifier montre le plan et « Terminer » l’ouvre', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const manifestation = nomUnique();
  const competition = nomUnique();
  await commencer(page, manifestation);
  await ajouterCompetition(page, competition, 'Sabre');

  await page.getByRole('button', { name: 'Suivant : Épreuves' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Les épreuves de chaque compétition' })).toBeVisible();
  await page.getByRole('button', { name: 'M13 Hommes', exact: true }).click();
  await page.getByRole('button', { name: 'M15 Dames', exact: true }).click();
  await page.getByRole('button', { name: 'Créer les 2 épreuves' }).click();
  // CA-2 : l'aperçu recompte les épreuves de la compétition.
  await expect(apercu(page)).toContainText('2 épreuves', { timeout: 20_000 });

  await page.getByRole('button', { name: 'Suivant : Vérifier' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Vérifier le plan' })).toBeVisible();
  await expect(page.getByText('1 compétition, 2 épreuves')).toBeVisible({ timeout: 20_000 });
  const tableau = page.getByRole('table');
  await expect(tableau).toContainText(competition);
  await expect(tableau).toContainText('M13 · Hommes');
  await expect(tableau).toContainText('M15 · Dames');

  await page.getByRole('button', { name: 'Terminer' }).click();
  await expect(page).toHaveURL(/\/manifestations\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name: manifestation })).toBeVisible();
});

test('US-047 CA-4 : « Plus tard » passe les étapes sans rien créer, une manifestation peut se terminer sans compétition', async ({
  page,
}) => {
  test.setTimeout(90_000);
  const manifestation = nomUnique();
  await commencer(page, manifestation);

  await page.getByRole('button', { name: 'Plus tard' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Les épreuves de chaque compétition' })).toBeVisible();
  await expect(page.getByText('Aucune compétition pour l’instant')).toBeVisible();
  await page.getByRole('button', { name: 'Plus tard' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Vérifier le plan' })).toBeVisible();
  await expect(page.getByText('Aucune compétition, aucune épreuve')).toBeVisible();
  await expect(page.getByText('Le plan se remplira')).toBeVisible();

  await page.getByRole('button', { name: 'Terminer' }).click();
  await expect(page).toHaveURL(/\/manifestations\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name: manifestation })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ajouter une première compétition' })).toBeVisible();
});

test('US-047 CA-6 : « Précédent » revoit l’étape avec ce qui est créé, modifiable', async ({ page }) => {
  test.setTimeout(90_000);
  const manifestation = nomUnique();
  const competition = nomUnique();
  const renommee = `${competition} bis`;
  await commencer(page, manifestation);
  await ajouterCompetition(page, competition, 'Épée');

  // La compétition créée se modifie (US-024).
  await page.getByRole('button', { name: `Modifier la compétition ${competition}` }).click();
  await page.getByLabel('Nom de la compétition').fill(renommee);
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText(`Compétition « ${renommee} » créée`)).toBeVisible({ timeout: 20_000 });
  await expect(apercu(page)).toContainText(renommee);

  // Retour à la première étape : la manifestation créée est là, modifiable (US-023).
  await page.getByRole('button', { name: 'Précédent' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'La manifestation' })).toBeVisible();
  await expect(page.getByLabel('Nom', { exact: true })).toHaveValue(manifestation);
  await page.getByLabel('Lieu').fill('Gymnase Roger Vincent');
  await page.getByRole('button', { name: 'Suivant : Compétitions' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Les compétitions du week-end' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(apercu(page)).toContainText('Gymnase Roger Vincent');
  await expect(page.getByRole('list', { name: 'Compétitions créées' })).toContainText(renommee);
});

test('US-047 cas limite : une étape invalide ne se valide pas, avec le message du formulaire de la manifestation', async ({
  page,
}) => {
  await seConnecter(page);
  await page.goto('/organisateur');
  await page.getByRole('link', { name: 'Nouvelle manifestation' }).click();
  await page.getByLabel('Date de début').fill('2027-03-15');
  await page.getByLabel('Date de fin').fill('2027-03-14');
  await page.getByRole('button', { name: 'Suivant : Compétitions' }).click();
  await expect(page.getByText('Le nom est obligatoire')).toBeVisible();
  await expect(page.getByText('La date de fin doit suivre la date de début')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1, name: 'La manifestation' })).toBeVisible();
});

test('US-047 hors ligne : le réseau perdu en cours d’assistant garde ce qui est créé et laisse les épreuves', async ({
  page,
  context,
}) => {
  test.setTimeout(120_000);
  const manifestation = nomUnique();
  const competition = nomUnique();
  await commencer(page, manifestation);
  await ajouterCompetition(page, competition, 'Sabre');

  // Le réseau tombe : les créations sont suspendues, avec le message de l'étape.
  await context.setOffline(true);
  await expect(page.getByText(/Réseau perdu : ce qui est déjà créé est gardé/)).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Ajouter la compétition' })).toBeDisabled();

  // L'étape Épreuves continue hors ligne : le lot s'écrit dans le journal local.
  await page.getByRole('button', { name: 'Suivant : Épreuves' }).click();
  await page.getByRole('button', { name: 'M17 Hommes', exact: true }).click();
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(apercu(page)).toContainText('1 épreuve', { timeout: 20_000 });

  // L'entrée de l'assistant grisée sur l'accueil hors ligne est vérifiée par accueil.spec.ts (US-026) ; ici, on poursuit.
  await page.getByRole('button', { name: 'Suivant : Vérifier' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Vérifier le plan' })).toBeVisible();
  await context.setOffline(false);
});
