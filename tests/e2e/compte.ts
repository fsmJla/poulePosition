// Compte de test des E2E (US-003). En local, il est créé par preparation.ts sur le serveur de test (port 8791).
// Contre la preview (BASE_URL), c'est un compte existant dont les identifiants sont dans les secrets GitHub.
import { expect, type Page } from '@playwright/test';

/** Secrets du serveur local de test (`npm run dev:e2e -w serveur`) : valeurs de test, sans valeur réelle. */
export const SECRET_INSTALLATION_LOCAL = 'installation-e2e';
export const URL_SERVEUR_LOCAL = 'http://localhost:8791';

/** Cookies du navigateur contre la preview (cookie de contournement de la protection Vercel), non versionnés. */
export const ETAT_PREVIEW = 'playwright/.auth/preview.json';

const COMPTE_LOCAL = { email: 'e2e@poule-position.test', nom: 'Compte E2E', motDePasse: 'mot-de-passe-e2e-local' };

export interface CompteTest {
  email: string;
  motDePasse: string;
  /** Nom affiché attendu ; inconnu contre la preview. */
  nom?: string;
}

/** @throws {Error} contre la preview, si E2E_EMAIL ou E2E_MOT_DE_PASSE manquent */
export function compteTest(): CompteTest {
  if (!process.env.BASE_URL) return COMPTE_LOCAL;
  const { E2E_EMAIL: email, E2E_MOT_DE_PASSE: motDePasse } = process.env;
  if (!email || !motDePasse) {
    throw new Error('E2E_EMAIL et E2E_MOT_DE_PASSE sont requis pour tester la connexion sur une preview.');
  }
  return { email, motDePasse };
}

export const compteLocal = COMPTE_LOCAL;

/** Se connecte depuis l'écran de connexion et attend l'accueil de l'organisateur. */
export async function seConnecter(page: Page, compte: CompteTest = compteTest()) {
  // US-079 CA-2 : le club de test est partagé ; dès qu'une épreuve y est « en cours » (`peupler`), l'accueil s'ouvrirait
  // sur « En cours » et masquerait les données à venir créées par chaque test. On choisit donc « À venir » une fois par
  // onglet, comme un organisateur l'aurait fait ; le test du filtre par défaut retire ce choix.
  await page.addInitScript((cle) => {
    if (sessionStorage.getItem('e2e.filtrePose') !== null) return;
    sessionStorage.setItem('e2e.filtrePose', '1');
    if (sessionStorage.getItem(cle) === null) sessionStorage.setItem(cle, 'avenir');
  }, 'poulePosition.filtreListe');
  await page.goto('/connexion');
  await page.getByLabel('E-mail').fill(compte.email);
  await page.getByLabel('Mot de passe').fill(compte.motDePasse);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/organisateur$/, { timeout: 20_000 });
}

/** US-017 : bouton avatar de l'entête, qui ouvre le menu de compte. */
export const boutonMenuCompte = (page: Page) => page.getByRole('button', { name: /^Menu du compte de / });

/** US-017 : ouvre le menu de compte et choisit une entrée. */
export async function choisirDansMenuCompte(
  page: Page,
  entree: 'Éditer le profil' | 'Se déconnecter' | 'Se déconnecter et oublier cet appareil',
) {
  await boutonMenuCompte(page).click();
  const options = { name: entree, exact: true };
  await (entree === 'Éditer le profil' ? page.getByRole('link', options) : page.getByRole('button', options)).click();
}

/** US-054 : ouvre « Comptes » (administrateur) depuis l'entête, ou depuis le menu de compte sur un écran étroit (< 640 px). */
export async function ouvrirPageComptes(page: Page) {
  if ((page.viewportSize()?.width ?? 1280) < 640) {
    await boutonMenuCompte(page).click();
    await page.locator('#menu-compte').getByRole('link', { name: 'Comptes' }).click();
  } else {
    await page.getByRole('banner').getByRole('link', { name: 'Comptes' }).click();
  }
}
