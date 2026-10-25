// Routage de l'application (US-003) : pages publiques et pages réservées aux comptes connectés.
// Vraies adresses (History API) ; Vercel et le service worker servent index.html pour toute adresse.

export type Page = 'accueil' | 'connexion' | 'organisateur';

export const CHEMINS = Object.freeze({
  accueil: '/',
  connexion: '/connexion',
  organisateur: '/organisateur',
} satisfies Record<Page, string>);

/** Pages réservées : un visiteur non connecté est renvoyé à l'écran de connexion (CA-6). */
const RESERVEES: readonly Page[] = ['organisateur'];

export type Route = { page: Page } | { redirection: string };

/** Page à afficher pour une adresse, ou adresse vers laquelle rediriger. */
export function resoudreRoute(chemin: string, connecte: boolean): Route {
  const normalise = chemin.length > 1 ? chemin.replace(/\/+$/, '') : chemin;
  const page = (Object.keys(CHEMINS) as Page[]).find((candidate) => CHEMINS[candidate] === normalise);
  if (!page) return { redirection: CHEMINS.accueil };
  if (!connecte && RESERVEES.includes(page)) return { redirection: CHEMINS.connexion };
  if (connecte && page === 'connexion') return { redirection: CHEMINS.organisateur };
  return { page };
}
