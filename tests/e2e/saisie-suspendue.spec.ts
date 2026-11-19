// Saisie suspendue (US-102, planche 16) : quand la table (le PC pilote) perd le réseau, le téléphone de l'arbitre le dit,
// renvoie à la feuille papier et grise la saisie ; au retour, tout reprend sans action. Sans réseau sur le téléphone, même
// état, avec son propre message.
import { expect, test } from '@playwright/test';
import { ouvrirPoules } from './poules-outils';
import { entrerArbitre, poulesLancees, telephone } from './saisie-outils';

test('US-102 CA-1, CA-2, CA-4, CA-5 et CA-8 : suspendue sans table, reprise au retour ; sans réseau sur le téléphone', async ({
  page,
  context,
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(180_000);
  const { adresse, arbitres } = await poulesLancees(page);
  await ouvrirPoules(page, adresse);
  const { contexte, page: arbitre } = await telephone(browser, baseURL);
  try {
    await entrerArbitre(arbitre, arbitres, 'Martin', 1);
    const maintenant = arbitre.getByRole('region', { name: 'À saisir maintenant · match 1' });
    await expect(maintenant.getByRole('button', { name: 'Saisir le score' })).toBeEnabled({ timeout: 20_000 });

    // CA-1 et CA-2 : la table perd le réseau.
    await context.setOffline(true);
    await expect(arbitre.getByRole('status').filter({ hasText: 'Table déconnectée' })).toBeVisible({ timeout: 15_000 });
    const bandeau = arbitre.getByRole('alert').filter({ hasText: 'Saisie suspendue' });
    await expect(bandeau).toContainText('La table de marque n’est plus connectée');
    await expect(bandeau).toContainText(/Dernier échange à \d+ h \d{2} · la saisie reprendra d’elle-même\./);
    await expect(maintenant.getByRole('button', { name: 'Saisie suspendue' })).toBeDisabled();
    expect(await arbitre.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await testInfo.attach('planche-16', { body: await arbitre.screenshot(), contentType: 'image/png' });

    // CA-5 : retour du réseau, la saisie reprend d'elle-même.
    await context.setOffline(false);
    await expect(arbitre.getByRole('status').filter({ hasText: 'Table connectée' })).toBeVisible({ timeout: 20_000 });
    await expect(bandeau).toHaveCount(0);
    await expect(maintenant.getByRole('button', { name: 'Saisir le score' })).toBeEnabled();

    // CA-4 : le téléphone perd lui-même le réseau.
    await contexte.setOffline(true);
    await expect(arbitre.getByRole('alert').filter({ hasText: 'Pas de connexion sur ce téléphone' })).toBeVisible({
      timeout: 10_000,
    });
    await contexte.setOffline(false);
  } finally {
    await contexte.close();
  }
});
