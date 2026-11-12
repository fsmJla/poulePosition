// Page d'une épreuve par étapes (US-058) : navigation latérale, entête, cartes du Résumé, Formule et Paramètres dans la
// même page, menu « ⋯ », lecture seule, hors ligne, conformité à la planche 3 (docs/maquettes/ihm/3-epreuve.png). Le
// compte local est administrateur, celui de la preview un organisateur.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { ajouterCompetition, ajouterEpreuve, creerManifestationSimple } from './planche';

// US-061 : sous 40 rem, la page d'une épreuve a sa barre d'onglets et son entête compact (smartphone-organisateur.spec.ts).
// Ces tests vérifient la disposition à navigation latérale, y compris dans le projet « smartphone ».
test.use({ viewport: { width: 1100, height: 900 } });

const nomUnique = () => `E2E ${crypto.randomUUID().slice(0, 8)}`;
const MOTIF_PAGE_EPREUVE = /\/epreuves\/[0-9a-f-]{36}$/;

const navigation = (page: Page) => page.getByRole('navigation', { name: 'Étapes de l’épreuve' });
const fil = (page: Page) => page.getByRole('navigation', { name: 'Fil d’Ariane' });
const ETAPES_A_VENIR = ['Inscriptions', 'Émargement', 'Poules', 'Tableau', 'Impressions'];

/**
 * Crée une épreuve de la planche 3 (M13 Dames, sabre, mercredi 11 novembre 2026, à Pessac, appel 9 h 00, scratch 9 h 15,
 * début 9 h 30) par le formulaire : ce PC en est le pilote. Retourne les noms et ouvre sa page.
 */
async function creerEpreuvePilote(page: Page) {
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await creerManifestationSimple(page, manifestation, '2026-11-11', '2026-11-12');
  await ajouterCompetition(page, manifestation, competition, 'sabre');
  await page.goto('/epreuves/nouvelle');
  await page.getByLabel('Compétition', { exact: true }).selectOption({ label: `${competition} — ${manifestation}` });
  await page.getByLabel('Nom', { exact: true }).fill(`${competition} M13 Dames`);
  await page.getByLabel('Catégorie').selectOption('M13');
  await page.getByLabel('Sexe').selectOption('dames');
  await page.getByRole('button', { name: 'mercredi 11 novembre 2026' }).click();
  await page.getByLabel('Appel').fill('09:00');
  await page.getByLabel('Scratch').fill('09:15');
  await page.getByLabel('Début des poules').fill('09:30');
  await page.getByLabel('Lieu').fill('Pessac');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(MOTIF_PAGE_EPREUVE);
  await expect(page.getByText('Ce PC est le pilote', { exact: true })).toBeVisible();
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });
  return { manifestation, competition, epreuve: `${competition} M13 Dames` };
}

test('US-058 CA-1 : la navigation liste les étapes dans l’ordre, avec Formule et Paramètres sous un séparateur', async ({
  page,
}) => {
  await creerEpreuvePilote(page);
  const nav = navigation(page);
  await expect(nav).toBeVisible();
  const libelles = (await nav.getByRole('listitem').allInnerTexts())
    .map((texte) => texte.split('\n')[0]!.trim())
    .filter(Boolean);
  expect(libelles).toEqual(['Résumé', ...ETAPES_A_VENIR, 'Formule', 'Paramètres']);
  await expect(nav.getByRole('separator')).toHaveCount(1);
  await expect(nav.getByRole('link', { name: 'Résumé' })).toHaveAttribute('aria-current', 'page');
  expect(await nav.locator('svg[data-icone]').count()).toBe(8);
  // L'étape ouverte est mise en évidence (fond teinté).
  const fond = (lien: ReturnType<typeof page.getByRole>) => lien.evaluate((a) => getComputedStyle(a).backgroundColor);
  expect(await fond(nav.getByRole('link', { name: 'Résumé' }))).not.toBe(
    await fond(nav.getByRole('link', { name: 'Formule' })),
  );
});

test('US-058 CA-2 : les étapes à venir sont grisées, annoncées indisponibles et sans action', async ({ page }) => {
  await creerEpreuvePilote(page);
  const nav = navigation(page);
  const adresse = page.url();
  for (const etape of ETAPES_A_VENIR) {
    await expect(nav.getByRole('link', { name: etape })).toHaveCount(0);
    const ligne = nav.getByRole('listitem').filter({ hasText: etape });
    await expect(ligne.getByText('À venir')).toBeVisible();
    const inactive = ligne.locator('[aria-disabled="true"]');
    await expect(inactive).toHaveCount(1);
    await inactive.click({ force: true });
  }
  expect(page.url()).toBe(adresse);
  // Grisée : la couleur du texte est celle des éléments inactifs, pas celle des liens.
  const couleur = (element: ReturnType<typeof page.locator>) => element.evaluate((e) => getComputedStyle(e).color);
  expect(await couleur(nav.locator('[aria-disabled="true"]').first())).not.toBe(
    await couleur(nav.getByRole('link', { name: 'Formule' })),
  );
});

test('US-058 CA-3 : l’entête montre le fil, le nom court, le statut, la compétition, l’arme, la date, « Modifier » et « ⋯ »', async ({
  page,
}) => {
  const { manifestation, competition, epreuve } = await creerEpreuvePilote(page);
  await expect(fil(page).getByRole('link')).toHaveCount(3, { timeout: 20_000 });
  await expect(fil(page).getByRole('link').nth(1)).toHaveAccessibleName(manifestation);
  await expect(fil(page).getByRole('link').nth(2)).toHaveText(competition);
  await expect(fil(page).locator('[aria-current="page"]')).toHaveText(epreuve);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('M13 Dames');
  await expect(page.getByText('En préparation', { exact: true })).toBeVisible();
  await expect(page.getByText(`${competition} · Sabre · mercredi 11 novembre 2026`)).toBeVisible();
  // Le carré de couleur de la compétition précède son nom.
  await expect(page.locator('.sous-titre .carre')).toBeVisible();
  // Sur grand écran, « Modifier » et « ⋯ » sont à droite du titre ; sur écran étroit, l'entête passe sur deux lignes.
  if ((page.viewportSize()?.width ?? 0) >= 900) {
    const titre = (await page.getByRole('heading', { level: 1 }).boundingBox())!;
    const modifier = (await page.getByRole('link', { name: 'Modifier', exact: true }).boundingBox())!;
    const menu = (await page.getByRole('button', { name: `Autres actions pour ${epreuve}` }).boundingBox())!;
    expect(modifier.x).toBeGreaterThan(titre.x + titre.width);
    expect(menu.x).toBeGreaterThan(modifier.x);
  }
});

test('US-058 CA-4 : le Résumé présente les cartes Pilote, Publication, Informations, Formule, Affiche et feuille de route', async ({
  page,
}) => {
  await creerEpreuvePilote(page);
  const cartes = page.getByRole('region', { name: 'Résumé' });
  await expect(cartes).toBeVisible();
  const pilote = cartes.getByRole('region', { name: 'Pilote' });
  await expect(pilote.getByText('Ce PC est le pilote', { exact: true })).toBeVisible();
  await expect(pilote.getByText('Toutes les modifications sont envoyées au serveur.')).toBeVisible();
  const publication = cartes.getByRole('region', { name: 'Publication' });
  await expect(publication.getByText('Non publiée', { exact: true })).toBeVisible();
  await expect(publication.getByRole('button', { name: 'Publier' })).toBeVisible();
  const informations = cartes.getByRole('region', { name: 'Informations' });
  for (const [libelle, valeur] of [
    ['Lieu', 'Pessac'],
    ['Appel', '09:00'],
    ['Scratch', '09:15'],
    ['Début', '09:30'],
  ]) {
    await expect(informations.getByText(libelle!, { exact: true })).toBeVisible();
    await expect(informations.getByText(valeur!, { exact: true })).toBeVisible();
  }
  await expect(informations.getByRole('link', { name: 'Modifier les informations' })).toBeVisible();
  const formule = cartes.getByRole('region', { name: 'Formule' });
  await expect(formule.getByText(/Poules en 5 touches/)).toBeVisible();
  await expect(formule.getByRole('link', { name: 'Modifier la formule' })).toBeVisible();
  await expect(cartes.getByRole('region', { name: 'Documents' })).toBeVisible();
  await expect(cartes.getByRole('button', { name: /Joindre une affiche/ })).toBeVisible();
  // Publier puis dépublier : la carte suit, et le lien public apparaît.
  await publication.getByRole('button', { name: 'Publier' }).click();
  await expect(publication.getByText('Publiée', { exact: true })).toBeVisible();
  await expect(publication.getByRole('link', { name: 'Page publique de l’épreuve' })).toBeVisible();
  await expect(publication.getByRole('button', { name: 'Dépublier' })).toBeVisible();
});

test('US-058 CA-5 : Formule et Paramètres s’ouvrent dans la même page à étapes, à leur adresse', async ({ page }) => {
  const { epreuve } = await creerEpreuvePilote(page);
  const nav = navigation(page);
  await nav.getByRole('link', { name: 'Formule' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}\/formule$/);
  await expect(nav.getByRole('link', { name: 'Formule' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { level: 2, name: 'Formule de l’épreuve' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('M13 Dames');
  await expect(fil(page).getByRole('link', { name: epreuve })).toBeVisible();
  await nav.getByRole('link', { name: 'Paramètres' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}\/parametres$/);
  await expect(nav.getByRole('link', { name: 'Paramètres' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('heading', { level: 2, name: 'Paramètres de l’épreuve' })).toBeVisible();
  await nav.getByRole('link', { name: 'Résumé' }).click();
  await expect(page).toHaveURL(MOTIF_PAGE_EPREUVE);
  // Le rechargement rouvre l'étape à son adresse.
  await nav.getByRole('link', { name: 'Formule' }).click();
  await page.reload();
  await expect(navigation(page).getByRole('link', { name: 'Formule' })).toHaveAttribute('aria-current', 'page');
});

test('US-058 CA-6 : le menu « ⋯ » propose Dupliquer, puis Supprimer… à un administrateur', async ({ page }) => {
  const { epreuve } = await creerEpreuvePilote(page);
  await page.getByRole('button', { name: `Autres actions pour ${epreuve}` }).click();
  const menu = page.getByRole('menu', { name: `Autres actions pour ${epreuve}` });
  const actions = (await menu.getByRole('menuitem').allInnerTexts()).map((texte) => texte.split('\n')[0]);
  expect(actions).toEqual(process.env.BASE_URL ? ['Dupliquer', 'Archiver'] : ['Dupliquer', 'Archiver', 'Supprimer…']);
  await menu.getByRole('menuitem', { name: /^Dupliquer/ }).click();
  await expect(page).toHaveURL(/\/epreuves\/nouvelle\?.*copie=/);
  await expect(page.getByLabel('Nom', { exact: true })).toHaveValue(`${epreuve} (copie)`);
});

test('US-058 CA-7 : une épreuve pilotée par un autre PC est en lecture seule, avec « Prendre la main »', async ({
  page,
}) => {
  const manifestation = nomUnique();
  const competition = nomUnique();
  await seConnecter(page);
  await creerManifestationSimple(page, manifestation);
  const competitionId = await ajouterCompetition(page, manifestation, competition);
  const epreuveId = await ajouterEpreuve(page, competitionId, nomUnique());
  await page.goto(`/epreuves/${epreuveId}`);
  const cartes = page.getByRole('region', { name: 'Résumé' });
  await expect(cartes.getByText('Lecture seule : cette épreuve est pilotée par un autre PC')).toBeVisible({
    timeout: 20_000,
  });
  await expect(cartes.getByRole('button', { name: 'Prendre la main' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Modifier', exact: true })).toHaveCount(0);
  await expect(cartes.getByRole('button', { name: 'Publier' })).toHaveCount(0);
  await expect(cartes.getByRole('link', { name: 'Modifier les informations' })).toHaveCount(0);
  // La navigation s'affiche, et la formule reste lisible.
  await expect(navigation(page)).toBeVisible();
  await navigation(page).getByRole('link', { name: 'Formule' }).click();
  await expect(page.getByText('Lecture seule : cette épreuve est pilotée par un autre PC')).toBeVisible();
});

test('US-058 hors ligne : la navigation et les cartes s’affichent ; modifier et publier restent possibles sur ce PC', async ({
  page,
  context,
}) => {
  const { epreuve } = await creerEpreuvePilote(page);
  await context.setOffline(true);
  await expect(navigation(page)).toBeVisible();
  const cartes = page.getByRole('region', { name: 'Résumé' });
  await expect(cartes.getByText('Hors ligne : les modifications seront envoyées au retour du réseau.')).toBeVisible();
  // L'épreuve pilotée ici se publie hors ligne (journal local), et l'envoi attend le retour du réseau.
  await cartes.getByRole('region', { name: 'Publication' }).getByRole('button', { name: 'Publier' }).click();
  await expect(cartes.getByText('Publiée', { exact: true })).toBeVisible();
  await expect(cartes.getByText('Publication en attente d’envoi')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Modifier', exact: true })).toBeVisible();
  // Ce qui exige internet est grisé : la suppression d'un administrateur.
  await page.getByRole('button', { name: `Autres actions pour ${epreuve}` }).click();
  if (!process.env.BASE_URL) {
    await expect(page.getByRole('menuitem', { name: /^Supprimer…/ })).toHaveAttribute('aria-disabled', 'true');
  }
  await page.keyboard.press('Escape');
  await context.setOffline(false);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 30_000 });
});

test('US-058 cas limite : une épreuve inconnue affiche un message et un lien vers l’accueil', async ({ page }) => {
  await seConnecter(page);
  await page.goto('/epreuves/00000000-0000-4000-8000-000000000000');
  await expect(page.getByRole('alert')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('link', { name: "Retour à l'accueil de l'organisateur" })).toBeVisible();
  await expect(navigation(page)).toHaveCount(0);
});

test('US-058 cas limite : écran étroit, la navigation passe au-dessus du contenu en liste défilante', async ({
  page,
}) => {
  await creerEpreuvePilote(page);
  // Entre 40 et 52 rem (tablette en portrait) : sous 40 rem, c'est la barre d'onglets du bas (US-061).
  await page.setViewportSize({ width: 700, height: 844 });
  const nav = navigation(page);
  await expect(nav).toBeVisible();
  const navBoite = (await nav.boundingBox())!;
  const contenu = (await page.getByRole('region', { name: 'Résumé' }).boundingBox())!;
  expect(navBoite.y + navBoite.height).toBeLessThanOrEqual(contenu.y + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= 700)).toBe(true);
});

test('US-058 CA-8 : conforme à la planche 3 (navigation, entête, cartes du Résumé)', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1360, height: 1000 });
  await page.emulateMedia({ colorScheme: 'light' });
  const { competition } = await creerEpreuvePilote(page);
  await expect(fil(page).getByRole('link')).toHaveCount(3, { timeout: 20_000 });
  await expect(page.getByText(`${competition} · Sabre`)).toBeVisible();

  const boite = async (localisateur: ReturnType<typeof page.locator>) => (await localisateur.boundingBox())!;
  const nav = await boite(navigation(page));
  const titre = await boite(page.getByRole('heading', { level: 1 }));
  const cartes = page.getByRole('region', { name: 'Résumé' });
  const pilote = await boite(cartes.getByRole('region', { name: 'Pilote' }));
  const publication = await boite(cartes.getByRole('region', { name: 'Publication' }));
  const informations = await boite(cartes.getByRole('region', { name: 'Informations' }));
  const formule = await boite(cartes.getByRole('region', { name: 'Formule' }));
  const documents = await boite(cartes.getByRole('region', { name: 'Documents' }));

  // Navigation à gauche, contenu à droite, sous le fil d'Ariane.
  expect(nav.x).toBeLessThan(titre.x);
  expect(nav.width).toBeGreaterThan(200);
  expect(nav.width).toBeLessThan(300);
  expect(nav.y).toBeGreaterThan((await boite(fil(page))).y);
  // Trois cartes sur une ligne (Pilote, Publication, Informations), alignées en haut, dans cet ordre.
  expect(pilote.x).toBeLessThan(publication.x);
  expect(publication.x).toBeLessThan(informations.x);
  expect(Math.abs(pilote.y - publication.y)).toBeLessThan(2);
  expect(Math.abs(publication.y - informations.y)).toBeLessThan(2);
  // La carte Formule vient dessous, puis les documents sur toute la largeur du contenu.
  expect(formule.y).toBeGreaterThan(pilote.y + pilote.height - 1);
  expect(documents.y).toBeGreaterThan(formule.y + formule.height - 1);
  expect(documents.width).toBeGreaterThan(pilote.width * 2);
  // Aucun défilement horizontal, couleurs de la charte (carte blanche, fond de page).
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true,
  );
  const fondDe = (localisateur: ReturnType<typeof page.locator>) =>
    localisateur.evaluate((e) => getComputedStyle(e).backgroundColor);
  const variable = (nom: string) =>
    page.evaluate((cle) => {
      const essai = document.createElement('i');
      essai.style.backgroundColor = `var(${cle})`;
      document.body.append(essai);
      const couleur = getComputedStyle(essai).backgroundColor;
      essai.remove();
      return couleur;
    }, nom);
  expect(await fondDe(cartes.getByRole('region', { name: 'Pilote' }))).toBe(await variable('--surface'));
  expect(await fondDe(page.locator('body'))).toBe(await variable('--fond'));
  expect(await fondDe(navigation(page).getByRole('link', { name: 'Résumé' }))).toBe(await variable('--accent-teinte'));

  await testInfo.attach('3-epreuve-etapes.png', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png',
  });
});
