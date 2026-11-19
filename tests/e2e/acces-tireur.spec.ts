// Accès tireur par QR code (US-103, planche 17) : la tireuse cherche son nom parmi celles des poules, le choisit, et
// retrouve ensuite son écran ; « Ce n'est pas moi » rouvre le choix.
import { expect, test } from '@playwright/test';
import { poulesLancees, telephone } from './saisie-outils';

test('US-103 CA-1 à CA-4 et CA-6 : chercher son nom, le choisir, le retrouver au retour sur le lien', async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(180_000);
  const { tireurs } = await poulesLancees(page);
  const { contexte, page: tireuse } = await telephone(browser, baseURL);
  try {
    await tireuse.goto(tireurs);
    await expect(tireuse.getByRole('heading', { level: 1, name: 'Qui êtes-vous ?' })).toBeVisible({ timeout: 20_000 });
    await expect(
      tireuse.getByText('Choisissez votre nom parmi les tireuses de l’épreuve.', { exact: false }),
    ).toBeVisible();
    await expect(tireuse.getByRole('link', { name: 'Suivre l’épreuve en spectateur' })).toBeVisible();
    // CA-2 : la recherche ignore les accents et les majuscules.
    await tireuse.getByLabel('Votre nom').fill('du');
    const trouvees = tireuse.getByRole('list', { name: 'Tireuses trouvées' }).getByRole('listitem');
    await expect(trouvees).toHaveCount(2);
    await expect(trouvees.first()).toContainText('DUBOIS');
    await expect(trouvees.first()).toContainText(/Pessac \(SPUC\) · poule \d/);
    await expect(tireuse.getByText('Votre nom n’apparaît pas ? Adressez-vous à la table de marque.')).toBeVisible();
    expect(await tireuse.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await testInfo.attach('planche-17', { body: await tireuse.screenshot(), contentType: 'image/png' });

    // CA-3 : le choix ouvre son écran.
    await tireuse.getByRole('button', { name: 'Je suis DUBOIS Chloé' }).click();
    await expect(tireuse.getByRole('heading', { level: 1, name: 'Chloé DUBOIS' })).toBeVisible();
    await expect(tireuse.getByText(/^Poule \d · piste \d · Pessac \(SPUC\)$/)).toBeVisible();

    // CA-4 : au retour sur le lien, elle le retrouve.
    await tireuse.goto(tireurs);
    await expect(tireuse.getByRole('heading', { level: 1, name: 'Chloé DUBOIS' })).toBeVisible({ timeout: 20_000 });

    // US-104 CA-7 : « Ce n'est pas moi » rouvre le choix.
    await tireuse.getByRole('button', { name: 'Ce n’est pas moi' }).click();
    await expect(tireuse.getByRole('heading', { level: 1, name: 'Qui êtes-vous ?' })).toBeVisible();
  } finally {
    await contexte.close();
  }
});
