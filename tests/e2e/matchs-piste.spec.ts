// Matchs de la piste d'un arbitre (US-098, planche 13) : le téléphone montre le match à saisir maintenant, les suivants
// et les terminés ; un score saisi au PC s'y affiche sans recharger ; l'arbitre peut changer de piste.
import { expect, test } from '@playwright/test';
import { ouvrirPoules, saisirBoutons } from './poules-outils';
import { entrerArbitre, poulesLancees, telephone } from './saisie-outils';

test('US-098 CA-1 à CA-3, CA-5, CA-6 et CA-8 : match à saisir, suivants, terminés en direct, changer de piste', async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(180_000);
  const { adresse, arbitres } = await poulesLancees(page);
  const { contexte, page: arbitre } = await telephone(browser, baseURL);
  try {
    await entrerArbitre(arbitre, arbitres, 'Martin', 1);
    await expect(arbitre.getByRole('heading', { level: 1, name: 'Piste 1 · Poule 1' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(arbitre.getByText('arbitre Martin · 0 match sur 15')).toBeVisible();
    const maintenant = arbitre.getByRole('region', { name: 'À saisir maintenant · match 1' });
    await expect(maintenant).toBeVisible();
    await expect(maintenant.getByRole('button', { name: 'Saisir le score' })).toBeVisible();
    await expect(arbitre.getByRole('region', { name: 'Ensuite' }).getByRole('listitem')).toHaveCount(2);
    await expect(arbitre.getByText('Aucun match terminé pour l’instant.')).toBeVisible();
    expect(await arbitre.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    // CA-5 : un score saisi au PC arrive sur le téléphone, sans recharger.
    await ouvrirPoules(page, adresse);
    await saisirBoutons(page, 5, 2);
    await expect(arbitre.getByRole('region', { name: 'À saisir maintenant · match 2' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(arbitre.getByText('arbitre Martin · 1 match sur 15')).toBeVisible();
    await expect(arbitre.getByRole('region', { name: 'Terminés' }).getByRole('listitem')).toHaveCount(1);
    await expect(arbitre.getByRole('region', { name: 'Terminés' }).getByText('5–2')).toBeVisible();
    const chemin = process.env.CAPTURE;
    const capture = await arbitre.screenshot(chemin ? { path: chemin } : {});
    await testInfo.attach('planche-13', { body: capture, contentType: 'image/png' });

    // CA-6 : changer de piste, le nom est conservé.
    await arbitre.getByRole('button', { name: 'Changer de piste' }).click();
    await expect(arbitre.getByLabel('Votre nom')).toHaveValue('Martin');
    await arbitre.getByRole('radio', { name: /^Piste 2/ }).check();
    await arbitre.getByRole('button', { name: 'Commencer' }).click();
    await expect(arbitre.getByRole('heading', { level: 1, name: 'Piste 2 · Poule 2' })).toBeVisible();
    await expect(arbitre.getByRole('region', { name: 'À saisir maintenant · match 1' })).toBeVisible();
  } finally {
    await contexte.close();
  }
});
