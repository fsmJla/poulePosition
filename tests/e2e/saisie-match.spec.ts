// Saisie d'un match de poule sur smartphone (US-099, planche 14) : l'arbitre touche le score de chaque tireur, l'envoie
// à la table (le PC pilote), qui l'enregistre dans sa feuille ; un match déjà saisi est refusé avec son motif.
import { expect, test, type Page } from '@playwright/test';
import { ouvrirPoules, saisirBoutons } from './poules-outils';
import { entrerArbitre, poulesLancees, telephone } from './saisie-outils';

/** Le premier match de la poule 1 : ses deux tireurs, d'après la carte « À saisir maintenant ». */
async function ouvrirSaisie(arbitre: Page) {
  const maintenant = arbitre.getByRole('region', { name: /^À saisir maintenant · match \d+$/ });
  await expect(maintenant).toBeVisible({ timeout: 20_000 });
  await maintenant.getByRole('button', { name: 'Saisir le score' }).click();
  await expect(arbitre.getByText(/^Match \d+ · Poule 1$/)).toBeVisible();
}

const bouton = (arbitre: Page, cote: 0 | 1, choix: string) =>
  arbitre
    .getByRole('group')
    .nth(cote)
    .getByRole('button', { name: new RegExp(`^${choix} pour `) });

test('US-099 CA-1 à CA-5, CA-9 et CA-10 : le score part à la table, qui l’enregistre ; la feuille du PC le montre', async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(180_000);
  const { adresse, arbitres } = await poulesLancees(page);
  await ouvrirPoules(page, adresse);
  const { contexte, page: arbitre } = await telephone(browser, baseURL);
  try {
    await entrerArbitre(arbitre, arbitres, 'Martin', 1);
    await ouvrirSaisie(arbitre);
    const envoyer = arbitre.getByRole('button', { name: 'Envoyer à la table' });
    await expect(envoyer).toBeDisabled();
    // CA-3 : deux V, ou deux chiffres égaux, sont refusés.
    await bouton(arbitre, 0, 'V').click();
    await bouton(arbitre, 1, 'V').click();
    await expect(arbitre.getByText('Un seul vainqueur')).toBeVisible();
    await expect(envoyer).toBeDisabled();
    // Victoire au temps : deux chiffres différents.
    await bouton(arbitre, 0, '4').click();
    await bouton(arbitre, 1, '3').click();
    await expect(arbitre.getByText(/^Victoire au temps de .+, 4 à 3\.$/)).toBeVisible();
    // CA-2 : V et 2.
    await bouton(arbitre, 0, 'V').click();
    await bouton(arbitre, 1, '2').click();
    await expect(arbitre.getByText(/^Victoire de .+, 5 à 2\.$/)).toBeVisible();
    expect(await arbitre.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const chemin = process.env.CAPTURE;
    const capture = await arbitre.screenshot(chemin ? { path: chemin } : {});
    await testInfo.attach('planche-14', { body: capture, contentType: 'image/png' });
    await envoyer.click();
    // CA-5 : enregistré par la table, puis le match suivant est proposé.
    await expect(arbitre.getByText(/^Enregistré par la table à \d+ h \d{2}$/)).toBeVisible({ timeout: 10_000 });
    await expect(arbitre.getByRole('button', { name: /^Match suivant : / })).toBeVisible();
    // CA-9 : la feuille du PC montre le score (US-088 : « Match 2 sur 15 » est désormais en cours).
    await expect(page.getByRole('region', { name: 'Match 2 sur 15' })).toBeVisible({ timeout: 10_000 });
    await arbitre.getByRole('button', { name: /^Match suivant : / }).click();
    await expect(arbitre.getByText('Match 2 · Poule 1')).toBeVisible();
  } finally {
    await contexte.close();
  }
});

test('US-099 CA-6 : un match déjà saisi au PC est refusé avec son motif', async ({ page, browser, baseURL }) => {
  test.setTimeout(180_000);
  const { adresse, arbitres } = await poulesLancees(page);
  await ouvrirPoules(page, adresse);
  const { contexte, page: arbitre } = await telephone(browser, baseURL);
  try {
    await entrerArbitre(arbitre, arbitres, 'Martin', 1);
    await ouvrirSaisie(arbitre);
    // Pendant que l'arbitre saisit, la table enregistre ce même match.
    await saisirBoutons(page, 5, 1);
    await bouton(arbitre, 0, 'V').click();
    await bouton(arbitre, 1, '2').click();
    await arbitre.getByRole('button', { name: 'Envoyer à la table' }).click();
    await expect(arbitre.getByRole('alert')).toHaveText('Ce match a déjà un score : voyez la table.', {
      timeout: 10_000,
    });
    await arbitre.getByRole('button', { name: 'Retour aux matchs', exact: true }).click();
    await expect(arbitre.getByRole('region', { name: 'À saisir maintenant · match 2' })).toBeVisible();
  } finally {
    await contexte.close();
  }
});
