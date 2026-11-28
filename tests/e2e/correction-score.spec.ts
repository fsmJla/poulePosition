// Correction d'un score depuis le smartphone (US-101) : le crayon d'un match terminé rouvre la saisie, boutons du score
// dans ses cases ; la correction remplace le score à la table, qui la note dans ses saisies reçues.
import { expect, test } from '@playwright/test';
import { ouvrirPoules } from './poules-outils';
import { entrerArbitre, poulesLancees, telephone } from './saisie-outils';

test('US-101 CA-1, CA-2 et CA-5 : corriger le score d’un match terminé depuis le téléphone', async ({
  page,
  browser,
  baseURL,
}) => {
  test.setTimeout(180_000);
  const { adresse, arbitres } = await poulesLancees(page);
  await ouvrirPoules(page, adresse);
  const { contexte, page: arbitre } = await telephone(browser, baseURL);
  try {
    await entrerArbitre(arbitre, arbitres, 'Martin', 1);
    const maintenant = arbitre.getByRole('region', { name: 'À saisir maintenant · match 1' });
    await expect(maintenant).toBeVisible({ timeout: 20_000 });
    await maintenant.getByRole('button', { name: 'Saisir le score' }).click();
    await arbitre
      .getByRole('group', { name: /^Score de / })
      .getByRole('button', { name: /^V pour / })
      .click();
    await arbitre
      .getByRole('group', { name: /^Score de / })
      .getByRole('button', { name: /^2 pour / })
      .click();
    await arbitre.getByRole('button', { name: 'Envoyer à la table' }).click();
    await expect(arbitre.getByText(/^Enregistré par la table/)).toBeVisible({ timeout: 10_000 });
    await arbitre.getByRole('button', { name: 'Retour aux matchs de la piste' }).click();

    // CA-1 : le crayon rouvre la saisie, boutons du score marqués.
    await arbitre.getByRole('button', { name: 'Corriger le match 1' }).click();
    await expect(arbitre.getByText('Corriger le match 1')).toBeVisible();
    // US-118 CA-4 : les cases montrent le score actuel, pavé fermé.
    const cases = arbitre.getByRole('button', { name: /^Score de .* : / });
    await expect(cases).toHaveText(['2', 'V']);
    await expect(arbitre.getByRole('group', { name: /^Score de / })).toHaveCount(0);
    // CA-5 : le même score ne part pas.
    const envoyer = arbitre.getByRole('button', { name: 'Envoyer la correction' });
    await expect(envoyer).toBeDisabled();
    // CA-2 : une nouvelle valeur remplace le score : la case de gauche (le second appelé, US-159), 4, puis l'autre tireur (son « V » est marqué).
    await cases.first().click();
    await arbitre
      .getByRole('group', { name: /^Score de / })
      .getByRole('button', { name: /^4 pour / })
      .click();
    await expect(
      arbitre.getByRole('group', { name: /^Score de / }).getByRole('button', { name: /^V pour / }),
    ).toHaveAttribute('aria-pressed', 'true');
    await arbitre
      .getByRole('group', { name: /^Score de / })
      .getByRole('button', { name: /^V pour / })
      .click();
    await envoyer.click();
    await expect(arbitre.getByText(/^Enregistré par la table/)).toBeVisible({ timeout: 10_000 });
    const premiere = page.getByRole('region', { name: 'Saisies reçues des smartphones' }).getByRole('listitem').first();
    await expect(premiere).toContainText('correction de 5–2 en 5–4', { timeout: 10_000 });
    await expect(premiere).toContainText('Acceptée');
  } finally {
    await contexte.close();
  }
});

test('US-101 CA-4 : sans correction permise, pas de crayon', async ({ page, browser, baseURL }) => {
  test.setTimeout(180_000);
  const { adresse, arbitres } = await poulesLancees(page);
  await page.getByLabel('Correction d’un score déjà saisi').selectOption('personne');
  await page.getByRole('button', { name: 'Enregistrer les paramètres' }).click();
  await expect(page.getByText('Paramètres enregistrés')).toBeVisible();
  await ouvrirPoules(page, adresse);
  const { contexte, page: arbitre } = await telephone(browser, baseURL);
  try {
    await entrerArbitre(arbitre, arbitres, 'Martin', 1);
    const maintenant = arbitre.getByRole('region', { name: 'À saisir maintenant · match 1' });
    await expect(maintenant).toBeVisible({ timeout: 20_000 });
    await maintenant.getByRole('button', { name: 'Saisir le score' }).click();
    await arbitre
      .getByRole('group', { name: /^Score de / })
      .getByRole('button', { name: /^V pour / })
      .click();
    await arbitre
      .getByRole('group', { name: /^Score de / })
      .getByRole('button', { name: /^2 pour / })
      .click();
    await arbitre.getByRole('button', { name: 'Envoyer à la table' }).click();
    await expect(arbitre.getByText(/^Enregistré par la table/)).toBeVisible({ timeout: 10_000 });
    await arbitre.getByRole('button', { name: 'Retour aux matchs de la piste' }).click();
    await expect(arbitre.getByRole('region', { name: 'Terminés' }).getByRole('listitem')).toHaveCount(1);
    await expect(arbitre.getByRole('button', { name: 'Corriger le match 1' })).toHaveCount(0);
  } finally {
    await contexte.close();
  }
});
