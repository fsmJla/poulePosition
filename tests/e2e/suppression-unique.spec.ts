// « Supprimer… » unique (US-057) : une seule action dans le menu « ⋯ » d'une manifestation, d'une compétition et d'une
// épreuve ; confirmation simple pour un objet vide, détaillée (contenu et nom à saisir) pour un objet non vide. Les
// règles de suppression elles-mêmes (US-039, US-041, US-042) ont leurs propres specs. Les suppressions se font avec le
// compte local, qui est administrateur ; l'organisateur de la preview n'a que le cas « objet vide ».
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { peupler, type Planche } from './planche';

const AVEC_ADMINISTRATEUR = 'administrateur réel : local uniquement (le compte de la preview est un organisateur)';

const carte = (page: Page, planche: Planche) => page.getByRole('article', { name: planche.manifestation });
const menuDe = (page: Page, nom: string) => page.getByRole('button', { name: `Autres actions pour ${nom}` });
const supprimer = (page: Page) => page.getByRole('menuitem', { name: /^Supprimer…/ });

async function ouvrirAccueil(page: Page) {
  await seConnecter(page);
  const planche = await peupler(page);
  await page.goto('/organisateur');
  await expect(carte(page, planche)).toBeVisible({ timeout: 20_000 });
  // US-063 : les décomptes de la planche comptent toutes les épreuves, terminées comprises.
  await page.getByRole('button', { name: /^Toutes/ }).click();
  return planche;
}

test('US-057 CA-1 : une seule action « Supprimer… », la dernière du menu d’une manifestation et d’une compétition', async ({
  page,
}) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const planche = await ouvrirAccueil(page);

  await menuDe(page, planche.manifestation).click();
  let entrees = page.getByRole('menu').getByRole('menuitem');
  await expect(entrees).toHaveCount(4);
  await expect(entrees.last()).toContainText('Supprimer…');
  await page.keyboard.press('Escape');

  await carte(page, planche)
    .getByRole('button', { name: `Autres actions pour ${planche.competitionSabre}` })
    .click();
  entrees = page.getByRole('menu').getByRole('menuitem');
  await expect(entrees.first()).toContainText('Ajouter des épreuves');
  await expect(entrees.last()).toContainText('Supprimer…');
  // US-079 CA-3 et CA-4 : entre les deux, seulement « Publier / Dépublier toutes les épreuves ».
  for (const libelle of (await entrees.allInnerTexts()).slice(1, -1)) {
    expect(libelle).toMatch(/(Publier|Dépublier) toutes les épreuves/);
  }
  await page.keyboard.press('Escape');

  // L'ancienne action n'existe plus nulle part.
  await expect(page.getByText(/avec son contenu/i)).toHaveCount(0);
});

test('US-057 CA-1 : « Supprimer… » est aussi la dernière action du menu d’une épreuve', async ({ page }) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const planche = await ouvrirAccueil(page);
  await carte(page, planche)
    .getByRole('button', { name: new RegExp(`^${planche.competitionEpee}`) })
    .click();
  await page.getByRole('link', { name: `Ouvrir l’épreuve ${planche.competitionEpee} M13 Dames` }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);

  await page.getByRole('button', { name: /^Autres actions pour / }).click();
  const entrees = page.getByRole('menu').getByRole('menuitem');
  await expect(entrees.last()).toContainText('Supprimer…');
  await expect(page.getByRole('button', { name: 'Supprimer définitivement…' })).toHaveCount(0);
  await entrees.last().click();
  await expect(page.getByRole('group', { name: 'Supprimer définitivement cette épreuve ?' })).toBeVisible();
});

test('US-057 CA-2 : un objet vide se supprime après une confirmation simple', async ({ page }) => {
  const planche = await ouvrirAccueil(page);
  await carte(page, planche)
    .getByRole('button', { name: `Autres actions pour ${planche.competitionVide}` })
    .click();
  await supprimer(page).click();

  const fenetre = page.getByRole('dialog', { name: `Supprimer « ${planche.competitionVide} » ?` });
  await expect(fenetre).toBeVisible();
  await expect(fenetre.getByLabel(/Saisissez/)).toHaveCount(0);
  await fenetre.getByRole('button', { name: 'Supprimer', exact: true }).click();

  await expect(fenetre).toHaveCount(0, { timeout: 30_000 });
  await expect(carte(page, planche)).toContainText('2 compétitions, 4 épreuves');
  await expect(page.getByRole('button', { name: new RegExp(`^${planche.competitionVide}`) })).toHaveCount(0);
});

test('US-057 CA-3 : un objet non vide annonce son contenu, liste ses épreuves et exige son nom', async ({ page }) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const planche = await ouvrirAccueil(page);
  await carte(page, planche)
    .getByRole('button', { name: `Autres actions pour ${planche.competitionSabre}` })
    .click();
  await expect(supprimer(page)).toContainText('avec son épreuve, après confirmation');
  await supprimer(page).click();

  const fenetre = page.getByRole('dialog', {
    name: `Supprimer définitivement la compétition « ${planche.competitionSabre} » ?`,
  });
  await expect(fenetre).toContainText('Seront aussi supprimées : 1 épreuve, archivées comprises.');
  await expect(fenetre.getByRole('listitem')).toHaveText([`${planche.competitionSabre} Sans catégorie`]);
  const valider = fenetre.getByRole('button', { name: 'Supprimer définitivement', exact: true });
  await expect(valider).toBeDisabled();
  await fenetre
    .getByLabel(`Saisissez « ${planche.competitionSabre} » pour confirmer`)
    .fill(`${planche.competitionSabre} x`);
  await expect(valider).toBeDisabled();
  await fenetre.getByLabel(`Saisissez « ${planche.competitionSabre} » pour confirmer`).fill(planche.competitionSabre);
  await expect(valider).toBeEnabled();
  await valider.click();

  // CA-4 : les règles de suppression d'US-041 s'appliquent : la compétition et son épreuve disparaissent.
  await expect(fenetre).toHaveCount(0, { timeout: 30_000 });
  await expect(carte(page, planche)).toContainText('2 compétitions, 3 épreuves');
  await expect(page.getByRole('link', { name: /Sans catégorie/ })).toHaveCount(0);
});

test('US-057 CA-3 : le sous-titre du menu d’une manifestation annonce sa portée avant le clic', async ({ page }) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const planche = await ouvrirAccueil(page);
  await menuDe(page, planche.manifestation).click();
  await expect(supprimer(page)).toContainText('avec ses 3 compétitions et ses 4 épreuves, après confirmation');
});

test('US-057 CA-5 : une épreuve en cours grise « Supprimer… », avec son motif', async ({ page }) => {
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  const planche = await ouvrirAccueil(page);
  await carte(page, planche)
    .getByRole('button', { name: `Autres actions pour ${planche.competitionEpee}` })
    .click();
  await expect(supprimer(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('menu')).toContainText('Une épreuve en cours ne peut pas être supprimée');
  await page.keyboard.press('Escape');
  await menuDe(page, planche.manifestation).click();
  await expect(supprimer(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('menu')).toContainText('Une épreuve en cours ne peut pas être supprimée');
});

test('US-057 CA-5 : un organisateur ne voit « Supprimer… » que pour un objet vide', async ({ page }) => {
  test.skip(!process.env.BASE_URL, 'organisateur réel : preview uniquement (le compte local est un administrateur)');
  const planche = await ouvrirAccueil(page);
  await menuDe(page, planche.manifestation).click();
  // Modifier, Ajouter une compétition, Archiver (US-033) : pas de « Supprimer… » pour un organisateur.
  await expect(page.getByRole('menu').getByRole('menuitem')).toHaveCount(3);
  await expect(supprimer(page)).toHaveCount(0);
  await page.keyboard.press('Escape');
  await carte(page, planche)
    .getByRole('button', { name: `Autres actions pour ${planche.competitionSabre}` })
    .click();
  await expect(supprimer(page)).toHaveCount(0);
  await page.keyboard.press('Escape');
  await carte(page, planche)
    .getByRole('button', { name: `Autres actions pour ${planche.competitionVide}` })
    .click();
  await expect(supprimer(page)).toBeVisible();
});

test('US-057 hors ligne : « Supprimer… » est grisé, avec « Connexion requise pour supprimer »', async ({
  page,
  context,
}) => {
  const planche = await ouvrirAccueil(page);
  await context.setOffline(true);
  await carte(page, planche)
    .getByRole('button', { name: `Autres actions pour ${planche.competitionVide}` })
    .click();
  await expect(supprimer(page)).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('menu')).toContainText('Connexion requise pour supprimer');
  await page.keyboard.press('Escape');
  await context.setOffline(false);
});

test('US-057 CA-6 : conforme à la planche 2 (menu « ⋯ » d’une compétition ouvert)', async ({ page }, info) => {
  test.skip(info.project.name !== 'pc', 'La planche est à 1360 px : projet « pc » seulement');
  test.skip(Boolean(process.env.BASE_URL), AVEC_ADMINISTRATEUR);
  await page.setViewportSize({ width: 1360, height: 1000 });
  const planche = await ouvrirAccueil(page);
  const c = carte(page, planche);
  await c.getByRole('button', { name: `Autres actions pour ${planche.competitionSabre}` }).click();
  const menu = page.getByRole('menu');
  const entrees = menu.getByRole('menuitem');

  // « Supprimer… » : dernière action, sous un séparateur, avec la corbeille, en --etat-erreur, et son sous-titre.
  await expect(entrees.last()).toContainText('Supprimer…');
  await expect(entrees.last()).toContainText('avec son épreuve, après confirmation');
  await expect(entrees.last().locator('svg[data-icone="corbeille"]')).toHaveCount(1);
  await expect(menu.getByRole('separator')).toHaveCount(1);
  const separateurAvant = await menu.evaluate((element) => {
    const separateur = element.querySelector('hr, [role="separator"]') as HTMLElement;
    const derniere = [...element.querySelectorAll('[role^="menuitem"]')].pop() as HTMLElement;
    return !!(separateur.compareDocumentPosition(derniere) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(separateurAvant).toBe(true);
  const couleurs = await entrees.last().evaluate((element) => {
    const sonde = document.createElement('span');
    sonde.style.color = 'var(--etat-erreur)';
    document.body.append(sonde);
    const attendue = getComputedStyle(sonde).color;
    sonde.remove();
    const titre = element.querySelector('span, strong, p') as HTMLElement | null;
    return { attendue, obtenue: getComputedStyle(element).color, titre: titre ? getComputedStyle(titre).color : null };
  });
  expect([couleurs.obtenue, couleurs.titre]).toContain(couleurs.attendue);

  const capture = await menu.screenshot({ path: process.env.CAPTURE_SUPPRESSION });
  await info.attach('menu-supprimer.png', { body: capture, contentType: 'image/png' });
});
