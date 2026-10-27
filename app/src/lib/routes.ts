// Routage de l'application (US-003) : pages publiques et pages réservées aux comptes connectés.
// Vraies adresses (History API) ; Vercel et le service worker servent index.html pour toute adresse.

export type Page =
  | 'accueil'
  | 'connexion'
  | 'motDePasseOublie'
  | 'reinitialisation'
  | 'organisateur'
  | 'motDePasse'
  | 'comptes'
  | 'profil';

export const CHEMINS = Object.freeze({
  accueil: '/',
  connexion: '/connexion',
  /** US-019 : demande d'un lien, puis page du lien reçu par e-mail (publiques). */
  motDePasseOublie: '/mot-de-passe-oublie',
  reinitialisation: '/reinitialisation',
  organisateur: '/organisateur',
  motDePasse: '/mot-de-passe',
  comptes: '/comptes',
  profil: '/profil',
} satisfies Record<Page, string>);

/** Pages réservées : un visiteur non connecté est renvoyé à l'écran de connexion (CA-6). */
const RESERVEES: readonly Page[] = ['organisateur', 'motDePasse', 'comptes', 'profil'];

/** Pages des administrateurs : un organisateur est renvoyé à son accueil (US-007 CA-6). */
const ADMINISTRATEURS: readonly Page[] = ['comptes'];

export type Route = { page: Page } | { redirection: string };

/**
 * Page à afficher pour une adresse, ou adresse vers laquelle rediriger. Un compte au mot de passe temporaire ne
 * peut que le changer (US-010 CA-4) ; la gestion des comptes est réservée aux administrateurs (US-007).
 */
export function resoudreRoute(chemin: string, connecte: boolean, temporaire = false, administrateur = false): Route {
  const normalise = chemin.length > 1 ? chemin.replace(/\/+$/, '') : chemin;
  const page = (Object.keys(CHEMINS) as Page[]).find((candidate) => CHEMINS[candidate] === normalise);
  if (!page) return { redirection: CHEMINS.accueil };
  if (connecte && temporaire && page !== 'motDePasse') return { redirection: CHEMINS.motDePasse };
  if (!connecte && RESERVEES.includes(page)) return { redirection: CHEMINS.connexion };
  if (connecte && page === 'connexion') return { redirection: CHEMINS.organisateur };
  if (connecte && !administrateur && ADMINISTRATEURS.includes(page)) return { redirection: CHEMINS.organisateur };
  return { page };
}
