// Aides des tests E2E pour le point d'entrée « Créer » (US-046), qui remplace les liens de création de l'accueil.
import { expect, type Page } from '@playwright/test';
import { boutonMenuCompte } from './compte';

/** US-054 : lien « Créer » de l'entête ; sur un écran étroit (< 640 px), il est dans le menu de compte (jusqu'à US-061). */
export async function ouvrirCreer(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) < 640) {
    await boutonMenuCompte(page).click();
    await page.locator('#menu-compte').getByRole('link', { name: 'Créer', exact: true }).click();
  } else {
    await page.getByRole('banner').getByRole('link', { name: 'Créer', exact: true }).click();
  }
}

/** Depuis l'accueil de l'organisateur : « Créer », puis le bouton d'une carte (« Créer une manifestation »…). */
export async function ouvrirDepuisCreer(page: Page, bouton: 'Créer une manifestation' | 'Créer une compétition seule') {
  await ouvrirCreer(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Que voulez-vous créer ?' })).toBeVisible();
  await page.getByRole('link', { name: bouton }).click();
}

/**
 * Ouvre une adresse de l'application sans recharger la page, comme un clic sur un lien interne : fonctionne aussi
 * réseau coupé. Sert aux tests qui ouvrent le formulaire « Nouvelle épreuve », que plus aucun lien de l'accueil n'ouvre.
 */
export async function ouvrirDansLApplication(page: Page, chemin: string) {
  await page.evaluate((vers) => {
    history.pushState(null, '', vers);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, chemin);
}

export const ouvrirNouvelleEpreuve = (page: Page) => ouvrirDansLApplication(page, '/epreuves/nouvelle');

/** US-054 : vérifie que « Créer » est accessible (dans l'entête, ou dans le menu de compte sur un écran étroit). */
export async function verifierCreerAccessible(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) < 640) {
    await boutonMenuCompte(page).click();
    await expect(page.locator('#menu-compte').getByRole('link', { name: 'Créer', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
  } else {
    await expect(page.getByRole('banner').getByRole('link', { name: 'Créer', exact: true })).toBeVisible();
  }
}
