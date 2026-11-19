// Appareils connectés (US-105, planche 21) : dans Paramètres, la table voit les smartphones entrés par QR code et en
// exclut un ; le téléphone exclu est coupé et ne revient pas, jusqu'à ce que la table le réadmette. Hors ligne, la
// liste n'est pas connue et l'exclusion n'est pas proposée.
import { expect, test } from '@playwright/test';
import { entrerArbitre, poulesLancees, telephone } from './saisie-outils';

test('US-105 CA-1, CA-2, CA-4, CA-5 et hors ligne : voir les appareils, exclure, réadmettre', async ({
  page,
  context,
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(180_000);
  const { arbitres } = await poulesLancees(page);
  const { contexte, page: arbitre } = await telephone(browser, baseURL);
  try {
    await entrerArbitre(arbitre, arbitres, 'Martin', 1);
    await expect(arbitre.getByRole('button', { name: 'Saisir le score' }).first()).toBeVisible({ timeout: 20_000 });

    // CA-1 : la liste, en direct.
    const section = page.getByRole('region', { name: 'Appareils connectés' });
    await expect(section).toContainText('1 en ligne');
    const ligne = section.getByRole('row').filter({ hasText: 't1' });
    await expect(ligne).toContainText('arbitre');
    await expect(ligne).toContainText('Connecté');
    await testInfo.attach('planche-21', { body: await section.screenshot(), contentType: 'image/png' });

    // CA-2 : « ⋯ › Exclure cet appareil… », confirmé.
    await ligne.getByRole('button', { name: 'Autres actions pour arbitre (t1)' }).click();
    await page.getByRole('menuitem', { name: 'Exclure cet appareil…' }).click();
    const dialogue = page.getByRole('dialog', { name: 'Exclure arbitre (t1) ?' });
    await expect(dialogue).toContainText('régénérez son QR code');
    await dialogue.getByRole('button', { name: 'Exclure', exact: true }).click();
    await expect(arbitre.getByRole('alert')).toHaveText('Votre accès a été retiré par la table de marque.', {
      timeout: 15_000,
    });
    await expect(ligne).toContainText('Exclu');
    await expect(section).toContainText('1 exclu');
    // Il ne revient pas avec ce téléphone.
    await arbitre.reload();
    await expect(arbitre.getByRole('alert')).toHaveText('Votre accès a été retiré par la table de marque.', {
      timeout: 15_000,
    });

    // CA-4 : réadmis, il revient.
    await ligne.getByRole('button', { name: 'Autres actions pour arbitre (t1)' }).click();
    await page.getByRole('menuitem', { name: 'Réadmettre' }).click();
    await expect(ligne).not.toContainText('Exclu', { timeout: 10_000 });
    await arbitre.reload();
    await expect(arbitre.getByRole('button', { name: 'Saisir le score' }).first()).toBeVisible({ timeout: 20_000 });
    await expect(ligne).toContainText('Connecté', { timeout: 10_000 });

    // Hors ligne : la liste n'est pas connue, l'exclusion n'est pas proposée.
    await context.setOffline(true);
    await expect(section).toContainText('Hors ligne : les appareils ne peuvent pas se connecter.', { timeout: 15_000 });
    await expect(section.getByRole('button', { name: /^Autres actions pour / })).toHaveCount(0);
    await context.setOffline(false);
  } finally {
    await contexte.close();
  }
});
