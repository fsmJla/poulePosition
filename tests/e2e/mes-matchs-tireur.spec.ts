// « Mes matchs » du tireur (US-104, planches 18 et 18 bis) : sa carte « C'est à vous » ou « Votre prochain match », le
// classement provisoire de sa poule, ses matchs terminés, et la saisie d'un autre match de sa poule, signée à son nom.
import { expect, test, type Page } from '@playwright/test';
import { ouvrirPoules } from './poules-outils';
import { poulesLancees, telephone } from './saisie-outils';

const bouton = (tel: Page, cote: 0 | 1, choix: string) =>
  tel
    .getByRole('group')
    .nth(cote)
    .getByRole('button', { name: new RegExp(`^${choix} pour `) });

test('US-104 CA-1 à CA-5, CA-7 et CA-8 : mes matchs, ma poule, et la saisie d’un autre match de ma poule', async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(180_000);
  const { adresse, tireurs } = await poulesLancees(page);
  await ouvrirPoules(page, adresse);
  const { contexte, page: tireuse } = await telephone(browser, baseURL);
  try {
    await tireuse.goto(tireurs);
    await tireuse.getByLabel('Votre nom').fill('dubois', { timeout: 20_000 });
    await tireuse.getByRole('button', { name: 'Je suis DUBOIS Chloé' }).click();

    // CA-1 et CA-2 : l'entête et la carte de son prochain match.
    await expect(tireuse.getByRole('heading', { level: 1, name: 'Chloé DUBOIS' })).toBeVisible();
    await expect(tireuse.getByRole('button', { name: 'Ce n’est pas moi' })).toBeVisible();
    const carte = tireuse.getByRole('region', { name: /^(C’est à vous|Votre prochain match) · match \d+$/ });
    await expect(carte).toContainText(/contre [A-Z]+ /);
    // CA-3 : le classement provisoire de sa poule, sa ligne surlignée.
    const classement = tireuse.getByRole('region', { name: 'Ma poule · classement provisoire' });
    await expect(classement.getByRole('row').filter({ hasText: 'DUBOIS Chloé' })).toHaveClass(/moi/);
    await expect(tireuse.getByRole('region', { name: 'Mes matchs terminés' })).toContainText('Aucun');
    expect(await tireuse.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await testInfo.attach('planche-18', {
      body: await tireuse.screenshot({ fullPage: true }),
      contentType: 'image/png',
    });

    // CA-5 et planche 18 bis : elle saisit un match de sa poule où elle ne tire pas.
    const autres = tireuse.getByRole('region', { name: 'Autres matchs de ma poule · à tirer' });
    await autres
      .getByRole('button', { name: /^Saisir le score du match \d+, / })
      .first()
      .click();
    await bouton(tireuse, 0, 'V').click();
    await bouton(tireuse, 1, '2').click();
    await tireuse.getByRole('button', { name: 'Envoyer à la table' }).click();
    await expect(tireuse.getByText(/^Enregistré par la table à \d+ h \d{2}$/)).toBeVisible({ timeout: 15_000 });
    // Sur le PC, la saisie est signée à son nom.
    await expect(page.getByText('tireuse DUBOIS Chloé (t1)', { exact: false }).first()).toBeVisible({
      timeout: 15_000,
    });

    // CA-7 : « Ce n'est pas moi » rouvre le choix.
    await tireuse.getByRole('button', { name: 'Retour aux matchs', exact: true }).click();
    await tireuse.getByRole('button', { name: 'Ce n’est pas moi' }).click();
    await expect(tireuse.getByRole('heading', { level: 1, name: 'Qui êtes-vous ?' })).toBeVisible();
  } finally {
    await contexte.close();
  }
});
