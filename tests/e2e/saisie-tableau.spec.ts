// Saisie d'un match du tableau sur smartphone (US-106, planche 15) : le match appelé sur la piste de l'arbitre apparaît
// sous ses matchs de poule ; le score se touche en dizaine et unité, une égalité demande la priorité ; la table
// l'enregistre et le vainqueur passe au tour suivant, dans l'arbre du PC comme dans l'extrait du téléphone.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { entrerArbitre, telephone } from './saisie-outils';
import { importerEpreuve, nomDe, ordreDesQualifiees, ouvrirTableau, poulesJouees } from './tableau-outils';

const arbre = (page: Page) => page.getByRole('region', { name: /^Du |^Des |^Finale$|^Demi-finales$/ });

/**
 * PC pilote : 6 qualifiées (quarts de finale, rangs 1 et 2 exempts), le quart 4-5 appelé sur la piste 1, l'épreuve
 * envoyée au serveur ; renvoie le lien des arbitres et le nom d'une qualifiée par son rang.
 */
async function tableauAppele(page: Page) {
  await seConnecter(page);
  const poules = poulesJouees({ nombre: 6 });
  const q = ordreDesQualifiees(poules);
  const adresse = await importerEpreuve(page, [
    ...poules,
    { type: 'TableauCree', donnees: { qualifies: q } },
    { type: 'MatchTableauAppele', donnees: { match: '8-2', piste: 1 } },
  ]);
  // US-035 : l'épreuve importée part au serveur quand ce PC prend la main.
  await page.locator('[data-reprise]').getByRole('button', { name: 'Prendre la main et envoyer' }).click();
  await expect(page.locator('[data-retour="reprise"]')).toContainText('Main prise', { timeout: 20_000 });
  await page.goto(`${adresse}/parametres`);
  const acces = page.getByRole('region', { name: 'Accès par QR code' });
  await expect(acces.getByLabel('Lien des arbitres')).toHaveText(/#j=/, { timeout: 20_000 });
  const arbitres = (await acces.getByLabel('Lien des arbitres').textContent()) as string;
  await page.goto(adresse);
  await ouvrirTableau(page);
  return { arbitres, nom: (rang: number) => nomDe(q[rang - 1]!) };
}

const toucher = (arbitre: Page, cote: 0 | 1, sorte: 'Dizaine' | 'Unité', valeur: number) =>
  arbitre
    .getByRole('group')
    .nth(cote)
    .getByRole('button', { name: new RegExp(`^${sorte} ${valeur} pour `) })
    .click();

test('US-106 CA-1, CA-2, CA-4 et CA-6 : le match de la piste se saisit en 15 touches et s’inscrit au tableau (planche 15)', async ({
  page,
  browser,
  baseURL,
}, testInfo) => {
  test.setTimeout(240_000);
  const { arbitres, nom } = await tableauAppele(page);
  const { contexte, page: arbitre } = await telephone(browser, baseURL);
  try {
    await entrerArbitre(arbitre, arbitres, 'Martin', 1);
    // CA-1 : le match du tableau appelé sur la piste 1, sous les matchs de poule (tous saisis).
    const tableau = arbitre.getByRole('region', { name: 'Tableau' });
    await expect(tableau).toContainText('Match 2 · Quarts de finale', { timeout: 20_000 });
    await expect(tableau).toContainText('Piste 1 · En piste 1');
    await tableau.getByRole('button', { name: /^Saisir le score : / }).click();
    await expect(arbitre.getByText('Match 2 · Quarts de finale', { exact: true })).toBeVisible();
    await expect(arbitre.getByText(/^Piste 1 · .+ · en 15 touches$/)).toBeVisible();

    // CA-2 : dizaine puis unité ; au-delà de 15, désactivé.
    await toucher(arbitre, 0, 'Dizaine', 10);
    await expect(
      arbitre
        .getByRole('group')
        .nth(0)
        .getByRole('button', { name: /^Unité 6 pour / }),
    ).toBeDisabled();
    await toucher(arbitre, 0, 'Unité', 5);
    await toucher(arbitre, 1, 'Dizaine', 0);
    await toucher(arbitre, 1, 'Unité', 9);
    await expect(arbitre.getByText(`Victoire de ${nom(4).split(' ')[0]}, 15 à 9.`)).toBeVisible();
    // L'extrait du tableau : ce match en saisie, son voisin et la demi-finale où le vainqueur s'inscrit.
    const extrait = arbitre.getByRole('region', { name: 'Dans le tableau' });
    await expect(extrait).toContainText('Match 2 · en saisie');
    await expect(extrait).toContainText('Demi-finales');
    expect(await arbitre.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const capture = await arbitre.screenshot({ fullPage: true, path: 'test-results/saisie-tableau.png' });
    await testInfo.attach('planche-15', { body: capture, contentType: 'image/png' });

    // CA-4 : la table enregistre ; le vainqueur passe en demi-finale.
    await arbitre.getByRole('button', { name: 'Envoyer à la table' }).click();
    await expect(arbitre.getByText(/^Enregistré par la table à \d+ h \d{2}$/)).toBeVisible({ timeout: 15_000 });
    await expect(arbre(page).getByRole('button', { name: `${nom(4)} contre ${nom(5)}, Terminé` })).toBeVisible({
      timeout: 15_000,
    });
    await expect(arbre(page).getByRole('button', { name: new RegExp(`^${nom(1)} contre ${nom(4)}, `) })).toBeVisible();
  } finally {
    await contexte.close();
  }
});

test('US-106 CA-3 : une égalité demande le vainqueur par priorité', async ({ page, browser, baseURL }) => {
  test.setTimeout(240_000);
  const { arbitres, nom } = await tableauAppele(page);
  const { contexte, page: arbitre } = await telephone(browser, baseURL);
  try {
    await entrerArbitre(arbitre, arbitres, 'Martin', 1);
    await arbitre
      .getByRole('region', { name: 'Tableau' })
      .getByRole('button', { name: /^Saisir le score : / })
      .click({ timeout: 20_000 });
    for (const cote of [0, 1] as const) {
      await toucher(arbitre, cote, 'Dizaine', 0);
      await toucher(arbitre, cote, 'Unité', 9);
    }
    await expect(arbitre.getByText('Égalité : qui a la priorité ?')).toBeVisible();
    const envoyer = arbitre.getByRole('button', { name: 'Envoyer à la table' });
    await expect(envoyer).toBeDisabled();
    await arbitre
      .getByRole('group', { name: 'Vainqueur par priorité' })
      .getByRole('radio', { name: nom(5) })
      .check();
    await expect(arbitre.getByText(`Victoire de ${nom(5).split(' ')[0]} par priorité, 9 partout.`)).toBeVisible();
    await envoyer.click();
    await expect(arbitre.getByText(/^Enregistré par la table à /)).toBeVisible({ timeout: 15_000 });
    await expect(arbre(page).getByRole('button', { name: new RegExp(`^${nom(1)} contre ${nom(5)}, `) })).toBeVisible({
      timeout: 15_000,
    });
  } finally {
    await contexte.close();
  }
});
