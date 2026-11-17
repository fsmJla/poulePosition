// Saisie des tireurs d'une épreuve (US-082, planche 7) : saisie rapide en ligne, homonyme, liste triée et filtrable,
// modification et retrait, hors ligne.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';

const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;

/** Une compétition seule et son épreuve, pilotée par ce PC ; ouvre l'étape « Inscriptions ». */
async function ouvrirInscriptions(page: Page) {
  await page.goto('/epreuves/nouvelle?seule');
  await page.getByLabel('Nom de la compétition et de son épreuve').fill(nomUnique());
  await page.getByLabel('Arme').selectOption('sabre');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  const adresse = page.url();
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
  // CA-1 : l'étape « Inscriptions » est livrée et ouvre l'écran.
  await page
    .getByRole('navigation', { name: /tapes/ })
    .getByRole('link', { name: /^Inscriptions/ })
    .click();
  await expect(page).toHaveURL(/\/inscriptions$/);
  await expect(page.getByRole('heading', { level: 2, name: 'Inscriptions' })).toBeVisible();
  return adresse;
}

async function ajouter(page: Page, nom: string, prenom: string, club: string, classement = '') {
  await page.getByLabel('Nom', { exact: true }).fill(nom);
  await page.getByLabel('Prénom', { exact: true }).fill(prenom);
  await page.getByLabel('Club', { exact: true }).fill(club);
  await page.getByLabel(/^Classement/).fill(classement);
  await page.getByLabel(/^Classement/).press('Enter');
}

const lignes = (page: Page) => page.getByRole('region', { name: 'Liste des inscrits' }).locator('tbody tr');

test('US-082 CA-1, CA-2, CA-3 et CA-5 : saisir à la suite, au clavier ; la liste est triée par classement puis par nom', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1360, height: 1000 });
  await seConnecter(page);
  await ouvrirInscriptions(page);
  await expect(page.getByText('Aucun tireur inscrit')).toBeVisible();

  // CA-2 : Entrée ajoute, Nom/Prénom/Classement se vident, le club reste, le curseur revient sur « Nom ».
  await ajouter(page, 'martin', 'Léa', 'Talence', '3');
  await expect(lignes(page)).toHaveCount(1);
  await expect(page.getByLabel('Nom', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Club', { exact: true })).toHaveValue('Talence');
  await expect(page.getByLabel('Nom', { exact: true })).toBeFocused();
  await expect(page.getByRole('status').filter({ hasText: 'MARTIN Léa ajouté à la liste' })).toHaveCount(1);

  await ajouter(page, 'DUBOIS', 'Chloé', 'Pessac', '');
  await ajouter(page, 'BERNARD', 'Inès', 'Mérignac', '8');
  await ajouter(page, 'André', 'Margot', 'Pessac', '');

  // CA-5 : classement croissant, sans classement à la fin par nom ; nombre d'inscrits et de clubs ; NOM en capitales.
  await expect(lignes(page)).toHaveCount(4);
  await expect(lignes(page).nth(0)).toContainText('MARTIN');
  await expect(lignes(page).nth(1)).toContainText('BERNARD');
  await expect(lignes(page).nth(2)).toContainText('ANDRÉ');
  await expect(lignes(page).nth(3)).toContainText('DUBOIS');
  await expect(lignes(page).nth(3)).toContainText('—');
  await expect(page.getByText('4 inscrits')).toBeVisible();
  await expect(page.getByText('3 clubs')).toBeVisible();
  await expect(page.getByText(/Trié par classement, puis par nom/)).toBeVisible();

  // CA-1 : la navigation porte le nombre d'inscrits.
  await expect(
    page.getByRole('navigation', { name: /tapes/ }).getByRole('link', { name: /^Inscriptions/ }),
  ).toContainText('4');

  // CA-5 : le filtre.
  await page.getByLabel('Filtrer les inscrits').fill('pessac');
  await expect(lignes(page)).toHaveCount(2);
  await page.getByLabel('Filtrer les inscrits').fill('');

  // CA-3 : le club se propose parmi les clubs déjà saisis.
  await expect(page.locator('#clubs-connus option[value="Mérignac"]')).toHaveCount(1);
});

test('US-082 CA-4 : un homonyme se signale et s’ajoute seulement si on le confirme ; un nom vide est refusé', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await seConnecter(page);
  await ouvrirInscriptions(page);
  await ajouter(page, 'MARTIN', 'Léa', 'Talence');
  await expect(lignes(page)).toHaveCount(1);

  await ajouter(page, 'Martin', 'LEA', 'Bayonne');
  const alerte = page.getByRole('alert').filter({ hasText: 'Un tireur du même nom est déjà inscrit' });
  await expect(alerte).toContainText('MARTIN Léa (Talence)');
  await alerte.getByRole('button', { name: 'Annuler' }).click();
  await expect(lignes(page)).toHaveCount(1);

  await ajouter(page, 'Martin', 'LEA', 'Bayonne');
  await page.getByRole('button', { name: 'Ajouter quand même' }).click();
  await expect(lignes(page)).toHaveCount(2);

  // Cas limite : nom vide.
  await page.getByLabel('Prénom', { exact: true }).fill('Sans nom');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.getByText('Le nom est obligatoire')).toBeVisible();
  await expect(page.getByLabel('Nom', { exact: true })).toHaveAttribute('aria-invalid', 'true');
});

test('US-082 CA-6 et CA-7 : modifier un inscrit au crayon, le retirer par « ⋯ » après confirmation', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await seConnecter(page);
  await ouvrirInscriptions(page);
  await ajouter(page, 'DUBOIS', 'Chloé', 'Pessac', '5');

  await page.getByRole('button', { name: 'Modifier Chloé DUBOIS' }).click();
  await page.getByRole('combobox', { name: 'Club' }).last().fill('Talence');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(lignes(page).first()).toContainText('Talence');

  await page.getByRole('button', { name: 'Autres actions pour Chloé DUBOIS' }).click();
  await page.getByRole('menuitem', { name: /^Retirer de l’épreuve/ }).click();
  const fenetre = page.getByRole('dialog');
  await expect(fenetre).toContainText('Retirer Chloé DUBOIS de l’épreuve ?');
  await fenetre.getByRole('button', { name: 'Retirer' }).click();
  await expect(page.getByText('Aucun tireur inscrit')).toBeVisible();
});

test('US-082 CA-9 : conforme à la planche 7 (zones, libellés, action principale)', async ({ page }, info) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1360, height: 1000 });
  await seConnecter(page);
  await ouvrirInscriptions(page);
  await ajouter(page, 'MARTIN', 'Léa', 'Talence', '3');

  const ajout = page.getByRole('region', { name: 'Ajouter un tireur' });
  const liste = page.getByRole('region', { name: 'Liste des inscrits' });
  const boiteAjout = (await ajout.boundingBox())!;
  const boiteListe = (await liste.boundingBox())!;
  expect(boiteAjout.y).toBeLessThan(boiteListe.y);
  await expect(page.getByRole('button', { name: /^Importer un fichier/ })).toBeDisabled();
  const ajouterBouton = ajout.getByRole('button', { name: 'Ajouter', exact: true });
  const fond = await ajouterBouton.evaluate((e) => getComputedStyle(e).backgroundColor);
  const tiffany = await page.evaluate(() => {
    const sonde = document.createElement('span');
    sonde.style.color = 'var(--palette-tiffany)';
    document.body.append(sonde);
    const couleur = getComputedStyle(sonde).color;
    sonde.remove();
    return couleur;
  });
  expect(fond).toBe(tiffany);
  const capture = await page.screenshot({ fullPage: true });
  await info.attach(`inscriptions-${info.project.name}.png`, { body: capture, contentType: 'image/png' });
});

test('US-082 hors ligne : saisir et modifier sans réseau, envoyé au retour du réseau', async ({ page, context }) => {
  test.setTimeout(120_000);
  await seConnecter(page);
  await ouvrirInscriptions(page);

  await context.setOffline(true);
  await ajouter(page, 'PETIT', 'Louise', 'Bayonne', '18');
  await ajouter(page, 'SIMON', 'Rose', 'Pessac', '30');
  await expect(lignes(page)).toHaveCount(2);
  await expect(page.getByText(/en attente d’envoi/)).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 30_000 });
  await page.reload();
  await expect(lignes(page)).toHaveCount(2, { timeout: 20_000 });
});
