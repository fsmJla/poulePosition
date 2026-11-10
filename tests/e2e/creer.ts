// Aides des tests E2E pour le point d'entrée « Créer » (US-046), qui remplace les liens de création de l'accueil.
import { expect, type Page } from '@playwright/test';

/** Depuis l'accueil de l'organisateur : « Créer », puis le bouton d'une carte (« Créer une manifestation »…). */
export async function ouvrirDepuisCreer(page: Page, bouton: 'Créer une manifestation' | 'Créer une compétition seule') {
  await page.getByRole('link', { name: 'Créer', exact: true }).click();
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
