// Retirer un tireur du tableau (US-113, planche 11) : « Abandon, forfait, exclusion… », l'adversaire passe au tour
// suivant, annulation du retrait tant que le match suivant n'est pas réglé, hors ligne.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import {
  importerEpreuve,
  nomDe,
  ordreDesQualifiees,
  ouvrirTableau,
  poulesJouees,
  resultatsPlanche11,
} from './tableau-outils';

const carte = (page: Page) => page.getByRole('region', { name: 'Saisie du match' });
const arbre = (page: Page) => page.getByRole('region', { name: /^Du |^Des |^Finale$|^Demi-finales$/ });

async function epreuvePlanche11(page: Page) {
  const poules = poulesJouees();
  const qualifies = ordreDesQualifiees(poules);
  await importerEpreuve(page, [
    ...poules,
    { type: 'TableauCree', donnees: { qualifies } },
    ...resultatsPlanche11(qualifies),
  ]);
  return (rang: number) => nomDe(qualifies[rang - 1]!);
}

async function retirer(page: Page, nom: string, motif: 'Abandon' | 'Forfait' | 'Exclusion') {
  await carte(page).getByRole('button', { name: 'Abandon, forfait, exclusion…' }).click();
  const fenetre = page.getByRole('dialog');
  await fenetre.getByRole('radio', { name: nom }).check();
  await fenetre.getByRole('radio', { name: motif }).check();
  return fenetre;
}

test('US-113 CA-1, CA-2 et CA-4 : forfait, l’adversaire passe, puis annulation du retrait', async ({ page }) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  const nom = await epreuvePlanche11(page);
  await ouvrirTableau(page);
  await expect(carte(page).getByRole('heading', { name: 'Tableau de 16 · match 4' })).toBeVisible();

  // CA-1 : la fenêtre demande le tireur et le motif, et annonce l'effet.
  const fenetre = await retirer(page, nom(13), 'Forfait');
  await expect(
    fenetre.getByRole('heading', { name: 'Abandon, forfait, exclusion · Tableau de 16 · match 4' }),
  ).toBeVisible();
  await expect(fenetre).toContainText(`${nom(4)} passe en quart de finale`);

  // CA-2 : le match est réglé par le forfait, l'adversaire passe en quart.
  await fenetre.getByRole('button', { name: 'Retirer' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(`${nom(13)} : forfait enregistré`)).toBeVisible();
  const match = arbre(page).getByRole('button', { name: `${nom(4)} contre ${nom(13)}, Terminé` });
  await expect(match).toContainText('Forfait');
  await expect(arbre(page).getByRole('button', { name: new RegExp(`^${nom(4)} contre ${nom(12)}, `) })).toBeVisible();

  // CA-4 : l'annulation rend le match à tirer.
  await match.click();
  await expect(carte(page)).toContainText(`Forfait de ${nom(13)}`);
  await carte(page).getByRole('button', { name: 'Autres actions pour Tableau de 16 · match 4' }).click();
  await page.getByRole('menuitem', { name: /^Annuler le retrait/ }).click();
  await expect(page.getByText('Tableau de 16 · match 4 : retrait annulé')).toBeVisible();
  await expect(arbre(page).getByRole('button', { name: `${nom(4)} contre ${nom(13)}, En piste 4` })).toBeVisible();
});

test('US-113 CA-4 : l’annulation est grisée une fois le match suivant réglé ; hors ligne', async ({
  page,
  context,
}) => {
  test.setTimeout(150_000);
  await seConnecter(page);
  const nom = await epreuvePlanche11(page);
  await ouvrirTableau(page);
  await context.setOffline(true);
  // Abandon de la tête de série 4, puis le quart 2 (12 contre 13) se tire.
  const fenetre = await retirer(page, nom(4), 'Abandon');
  await fenetre.getByRole('button', { name: 'Retirer' }).click();
  await arbre(page)
    .getByRole('button', { name: new RegExp(`^${nom(12)} contre ${nom(13)}, `) })
    .click();
  await carte(page)
    .getByRole('spinbutton', { name: /^Touches de/ })
    .first()
    .fill('15');
  await carte(page)
    .getByRole('spinbutton', { name: /^Touches de/ })
    .last()
    .fill('7');
  await carte(page).getByRole('button', { name: 'Valider le score' }).click();
  await expect(
    arbre(page).getByRole('button', { name: new RegExp(`^${nom(12)} contre ${nom(13)}, Terminé`) }),
  ).toBeVisible();

  await arbre(page)
    .getByRole('button', { name: `${nom(4)} contre ${nom(13)}, Terminé` })
    .click();
  await carte(page).getByRole('button', { name: 'Autres actions pour Tableau de 16 · match 4' }).click();
  const annuler = page.getByRole('menuitem', { name: /^Annuler le retrait/ });
  await expect(annuler).toHaveAttribute('aria-disabled', 'true');
  await expect(
    page.getByRole('menu').getByText('Corrigez d’abord le match suivant (quarts de finale · match 2)'),
  ).toBeVisible();
  await context.setOffline(false);
});
