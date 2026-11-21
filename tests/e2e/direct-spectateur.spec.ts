// US-137 à US-139 : un spectateur, sans compte, suit en direct une épreuve publiée (planches 38 et 39) : onglets selon
// l'étape, tireurs suivis, lien depuis l'accueil public ; dépubliée, l'épreuve ne se suit plus.
import { expect, test, type Page } from '@playwright/test';
import { seConnecter } from './compte';
import { epreuveAvecPresentes, repartir, saisirBoutons } from './poules-outils';

async function lancer(page: Page, adresse: string) {
  await repartir(page, adresse);
  await page.getByRole('button', { name: 'Lancer les poules' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Lancer les poules' }).click();
  await expect(page.getByRole('heading', { level: 3, name: /^Feuille de la poule 1/ })).toBeVisible();
}

test('US-137 CA-1 à CA-5, US-138 et US-139 : suivre une épreuve publiée et ses tireurs, sans compte', async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  await seConnecter(page);
  const adresse = await epreuveAvecPresentes(page, 6);
  const epreuveId = adresse.split('/').pop() ?? '';
  await page.goto(adresse);
  const nom = ((await page.getByRole('heading', { level: 1 }).textContent()) ?? '').trim();
  await page.getByRole('region', { name: 'Publication' }).getByRole('button', { name: 'Publier', exact: true }).click();
  await expect(page.getByText('Publication en attente d’envoi')).toHaveCount(0, { timeout: 30_000 });
  await lancer(page, adresse);

  const visiteurContexte = await browser.newContext();
  const visiteur = await visiteurContexte.newPage();

  // US-139 CA-1 : sur l'accueil public, l'épreuve en cours se suit en direct.
  await visiteur.goto('/');
  const suivre = visiteur.getByRole('link', { name: `Suivre en direct ${nom}` });
  await expect(suivre).toBeVisible({ timeout: 30_000 });
  await expect(suivre).toContainText('En direct');
  await suivre.click();
  await expect(visiteur).toHaveURL(new RegExp(`/direct/${epreuveId}$`));

  // US-137 CA-1 : l'onglet de l'étape en cours (Poules) ; le tableau, à venir, est grisé.
  await expect(visiteur.getByRole('tab', { name: 'Poules' })).toHaveAttribute('aria-selected', 'true', {
    timeout: 30_000,
  });
  await expect(visiteur.getByRole('tab', { name: 'Tableau' })).toHaveAttribute('aria-disabled', 'true');
  await expect(visiteur.getByText('En direct', { exact: true })).toBeVisible();
  await expect(visiteur.getByText(/Mis à jour à \d\d:\d\d/)).toBeVisible();

  // US-138 CA-1 et CA-2 : suivre un tireur ; « Mes tireurs » donne sa poule et son prochain match.
  const etoile = visiteur.getByRole('button', { name: /^Suivre / }).first();
  const suivi = ((await etoile.getAttribute('aria-label')) ?? '').replace(/^Suivre /, '');
  await etoile.click();
  await expect(visiteur.getByRole('button', { name: `Ne plus suivre ${suivi}` })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await visiteur.getByRole('tab', { name: /Mes tireurs · 1/ }).click();
  const carte = visiteur.getByRole('article', { name: suivi });
  await expect(carte).toContainText(/En piste \d+ contre|Prochain match contre/);
  await expect(carte).toContainText(/1 · piste \d+/);

  // US-137 CA-2 : un score saisi au PC arrive chez le spectateur sans rechargement.
  await saisirBoutons(page, 5, 3);
  await visiteur.getByRole('tab', { name: 'Poules' }).click();
  await expect(
    visiteur.getByRole('article', { name: 'Poule 1' }).getByRole('cell', { name: '1', exact: true }).first(),
  ).toBeVisible({
    timeout: 20_000,
  });

  // US-138 CA-1 : le choix est gardé sur ce smartphone.
  await visiteur.reload();
  await expect(visiteur.getByRole('tab', { name: /Mes tireurs · 1/ })).toBeVisible({ timeout: 30_000 });

  // US-137 CA-5 : dépubliée, l'épreuve ne se suit plus.
  await page.goto(adresse);
  await page.getByRole('button', { name: 'Dépublier', exact: true }).click();
  await expect(visiteur.getByText('Cette épreuve n’est pas publiée')).toBeVisible({ timeout: 30_000 });
  await visiteurContexte.close();
});
