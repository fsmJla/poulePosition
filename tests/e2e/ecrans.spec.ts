// US-133 : écrans géants d'une manifestation (onglet « Écrans », planches 36 et 37) et d'une compétition seule.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import {
  ajouterCompetition,
  ajouterEpreuve,
  creerManifestationSimple,
  exposerServeur,
  nomUnique,
  ouvrirManifestation,
} from './planche';

const carte = (page: Page, nom: string) => page.getByRole('article', { name: nom, exact: true });

async function manifestationAvecEpreuves(page: Page) {
  await exposerServeur(page);
  const manifestation = `Challenge ${nomUnique()}`;
  await creerManifestationSimple(page, manifestation);
  const competitionId = await ajouterCompetition(page, manifestation, 'Challenge de sabre');
  await ajouterEpreuve(page, competitionId, 'Sabre M13 Dames');
  await ajouterEpreuve(page, competitionId, 'Sabre M13 Hommes');
  await ouvrirManifestation(page, manifestation);
  await page.getByRole('tab', { name: 'Écrans' }).click();
  await expect(page).toHaveURL(/\/ecrans$/);
  return manifestation;
}

test('US-133 CA-1 à CA-5 et CA-7 : ajouter, régler, modifier, régénérer et supprimer un écran (planches 36 et 37)', async ({
  page,
}, info) => {
  await seConnecter(page);
  await manifestationAvecEpreuves(page);
  await expect(page.getByText('Aucun écran pour l’instant.')).toBeVisible();

  // CA-2 : la fenêtre de réglage (planche 37).
  await page.getByRole('button', { name: 'Ajouter un écran' }).click();
  const fenetre = page.getByRole('dialog', { name: 'Nouvel écran' });
  await expect(fenetre.getByLabel('Nom de l’écran')).toHaveValue('Écran de la salle');
  await fenetre.getByLabel('Nom de l’écran').fill('Écran de la salle A');
  await fenetre.getByRole('checkbox', { name: /Sabre M13 Dames/ }).check();
  await fenetre.getByRole('checkbox', { name: /Sabre M13 Hommes/ }).check();
  await fenetre.getByLabel('Durée d’une page').fill('20');
  await fenetre.getByRole('checkbox', { name: 'Podium' }).uncheck();
  await fenetre.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(fenetre).toBeHidden();

  // CA-1 et CA-3 : la carte, son état, ses épreuves, son lien et son QR code (planche 36).
  const ecran = carte(page, 'Écran de la salle A');
  await expect(ecran).toContainText('Jamais ouvert');
  await expect(ecran).toContainText('Sabre M13 Dames');
  await expect(ecran).toContainText('Sabre M13 Hommes');
  await expect(ecran).toContainText('20 s par page · 1 vue masquée');
  await expect(ecran.getByRole('img', { name: 'QR code du lien de Écran de la salle A' })).toBeVisible();
  const lien = ecran.locator('code');
  await expect(lien).toContainText('/ecran/');
  const premierLien = await lien.textContent();
  expect(premierLien).toMatch(/#[A-Za-z0-9_-]{22}$/);
  // CA-7 : structure de la planche 36 à 1360 px : l'onglet « Écrans » suit les trois autres, « Ajouter un écran » est à
  // droite du texte d'introduction, au-dessus des cartes ; pas de défilement horizontal.
  if (info.project.name === 'pc') {
    await page.setViewportSize({ width: 1360, height: 1100 });
    const boite = async (cible: ReturnType<Page['locator']>) => (await cible.boundingBox())!;
    const documents = await boite(page.getByRole('tab', { name: 'Affiche et feuille de route' }));
    const ongletEcrans = await boite(page.getByRole('tab', { name: 'Écrans' }));
    expect(ongletEcrans.x).toBeGreaterThan(documents.x);
    expect(Math.abs(ongletEcrans.y - documents.y)).toBeLessThan(4);
    const ajouter = await boite(page.getByRole('button', { name: 'Ajouter un écran' }));
    const premiere = await boite(ecran);
    expect(ajouter.y + ajouter.height).toBeLessThan(premiere.y);
    expect(ajouter.x + ajouter.width).toBeGreaterThan(premiere.x + premiere.width - 40);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await info.attach('planche-36', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  }

  // CA-2 : deux écrans d'une même manifestation ne portent pas le même nom.
  await page.getByRole('button', { name: 'Ajouter un écran' }).click();
  await page.getByRole('dialog').getByLabel('Nom de l’écran').fill('écran de la salle a');
  await page.getByRole('dialog').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('Un autre écran porte déjà ce nom');
  await page.getByRole('dialog').getByRole('button', { name: 'Annuler' }).click();

  // CA-5 : modifier.
  await page.getByRole('button', { name: 'Autres actions pour Écran de la salle A' }).click();
  await page.getByRole('menuitem', { name: /Modifier/ }).click();
  const modification = page.getByRole('dialog', { name: 'Écran de la salle A' });
  await expect(modification.getByLabel('Durée d’une page')).toHaveValue('20');
  await modification.getByLabel('Nom de l’écran').fill('Écran de la salle B');
  await modification.getByRole('button', { name: 'Enregistrer' }).click();
  const renomme = carte(page, 'Écran de la salle B');
  await expect(renomme).toBeVisible();

  // CA-4 : régénérer le lien, après confirmation.
  await page.getByRole('button', { name: 'Autres actions pour Écran de la salle B' }).click();
  await page.getByRole('menuitem', { name: /Régénérer le lien/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Régénérer' }).click();
  await expect(renomme.locator('code')).not.toHaveText(premierLien ?? '');

  // Hors ligne : la liste reste lisible, l'ajout est grisé.
  await page.context().setOffline(true);
  await page.reload();
  await expect(carte(page, 'Écran de la salle B')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Ajouter un écran' })).toBeDisabled();
  await expect(page.getByText(/Hors ligne : écrans du/)).toBeVisible();
  await page.context().setOffline(false);

  // CA-5 : supprimer, après confirmation.
  await page.reload();
  await page.getByRole('button', { name: 'Autres actions pour Écran de la salle B' }).click({ timeout: 20_000 });
  await page.getByRole('menuitem', { name: /Supprimer/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Supprimer' }).click();
  await expect(carte(page, 'Écran de la salle B')).toHaveCount(0);
});

test('US-133 CA-6 : une compétition seule a ses écrans, depuis le menu « ⋯ » de son épreuve', async ({ page }) => {
  await seConnecter(page);
  const nom = nomUnique();
  await page.goto('/epreuves/nouvelle?seule');
  await page.getByLabel('Nom de la compétition et de son épreuve').fill(nom);
  await page.getByLabel('Arme').selectOption('sabre');
  await page.getByRole('button', { name: 'Créer l’épreuve' }).click();
  await expect(page).toHaveURL(/\/epreuves\/[0-9a-f-]{36}$/);
  await page.getByRole('button', { name: `Autres actions pour ${nom}` }).click();
  await page.getByRole('menuitem', { name: /Écrans géants/ }).click();
  await expect(page).toHaveURL(/\/competitions\/[^/]+\/ecrans$/, { timeout: 20_000 });
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Écrans');
  await page.getByRole('button', { name: 'Ajouter un écran' }).click();
  const fenetre = page.getByRole('dialog', { name: 'Nouvel écran' });
  await expect(fenetre.getByRole('checkbox', { name: new RegExp(nom) })).toBeVisible({ timeout: 20_000 });
  await fenetre.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(carte(page, 'Écran de la salle')).toContainText('Aucune épreuve cochée');
});
