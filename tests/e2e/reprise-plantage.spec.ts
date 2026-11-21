// US-129 : reprise après un plantage. Le PC pilote, hors ligne, valide un score puis l'onglet est fermé brutalement :
// rouverte sans réseau sur son accueil, l'application revient sur l'étape quittée, sans rien perdre, et envoie tout au
// retour du réseau.
import { expect, test, type Page } from '@playwright/test';
import { choisirDansMenuCompte, compteTest, seConnecter } from './compte';
import { epreuveAvecPresentes, repartir, saisirBoutons } from './poules-outils';

const HORS_LIGNE = 'Hors ligne : la compétition continue sur ce PC';

async function lancer(page: Page, adresse: string) {
  await repartir(page, adresse);
  await page.getByRole('button', { name: 'Lancer les poules' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lancer les poules' }).click();
  await expect(page.getByRole('heading', { level: 3, name: /^Feuille de la poule 1/ })).toBeVisible();
}

const progression = (page: Page) => page.getByRole('tab', { name: /Poule 1/ });

test('US-129 CA-1, CA-2 et CA-5 : hors ligne, onglet fermé après un score, rouvert sur les poules, envoyé au retour', async ({
  page,
  context,
}, testInfo) => {
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 12);
  await lancer(page, adresse);
  await expect(page.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 20_000 });

  await context.setOffline(true);
  await expect(page.getByText(HORS_LIGNE)).toBeVisible({ timeout: 10_000 });
  await saisirBoutons(page, 5, 3);
  await expect(progression(page)).toContainText('1/15 matchs');
  // CA-1 : fermeture brutale aussitôt après la validation.
  await page.close();

  const rouverte = await context.newPage();
  await rouverte.goto('/');
  // CA-2 : l'application rouvre l'étape quittée, avec le fil d'Ariane complet.
  await expect(rouverte).toHaveURL(`${adresse}/poules`, { timeout: 20_000 });
  // Sur smartphone, le fil d'Ariane laisse place au lien de retour (US-061).
  if (testInfo.project.name === 'pc')
    await expect(rouverte.getByRole('navigation', { name: 'Fil d’Ariane' })).toBeVisible();
  await expect(progression(rouverte)).toContainText('1/15 matchs');
  await expect(
    rouverte.getByText(/1 modification en attente d’envoi|\d+ modifications en attente d’envoi/),
  ).toBeVisible({
    timeout: 10_000,
  });

  // CA-5 : au retour du réseau, tout part au serveur.
  await context.setOffline(false);
  await expect(rouverte.getByText(/en attente d’envoi/)).toHaveCount(0, { timeout: 30_000 });
});

test('US-129 CA-3 et CA-6 : après une nouvelle connexion, on revient à l’étape quittée ; l’accueil efface la reprise', async ({
  page,
}) => {
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 3);
  await expect(page).toHaveURL(`${adresse}/emargement`);

  await choisirDansMenuCompte(page, 'Se déconnecter');
  await expect(page).toHaveURL(/\/connexion$/);
  const compte = compteTest();
  await page.getByLabel('E-mail').fill(compte.email);
  await page.getByLabel('Mot de passe').fill(compte.motDePasse);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(`${adresse}/emargement`, { timeout: 20_000 });

  // CA-6 : l'accueil de l'organisateur devient le dernier écran consulté ; une réouverture y reste.
  await page.goto('/organisateur');
  await expect(page).toHaveURL(/\/organisateur$/);
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 20_000 });
  await page.goto('/');
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/$/);
});

test('US-129 CA-4 : l’épreuve n’est plus sur l’appareil, la réouverture reste sur l’accueil', async ({ page }) => {
  await seConnecter(page);
  await epreuveAvecPresentes(page, 2);
  // L'écran mémorisé désigne désormais une épreuve inconnue de l'appareil (supprimée, effacée…).
  await page.evaluate((id) => {
    const memoire = JSON.parse(localStorage.getItem('poule-position:ecran') ?? '{}');
    localStorage.setItem(
      'poule-position:ecran',
      JSON.stringify({ ...memoire, chemin: `/epreuves/${id}/poules`, epreuveId: id }),
    );
  }, 'epreuve-inconnue-0000');
  await page.goto('/');
  // Rien ne s'affiche avant la décision de reprise : une page affichée est la page définitive.
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/$/);
});
