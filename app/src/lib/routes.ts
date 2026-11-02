// Routage de l'application (US-003) : pages publiques et pages réservées aux comptes connectés.
// Vraies adresses (History API) ; Vercel et le service worker servent index.html pour toute adresse.
import { MOTIF_IDENTIFIANT } from '@poule-position/protocole';

export type Page =
  | 'accueil'
  | 'connexion'
  | 'motDePasseOublie'
  | 'reinitialisation'
  | 'organisateur'
  | 'motDePasse'
  | 'comptes'
  | 'profil'
  | 'nouvelleCompetition'
  | 'competition';

/** Adresses fixes ; celle d'une compétition porte son identifiant (`cheminCompetition`). */
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
  /** US-025 : formulaire de création d'une compétition. */
  nouvelleCompetition: '/competitions/nouvelle',
} satisfies Record<Exclude<Page, 'competition'>, string>);

/** US-025 : page d'une compétition. */
export function cheminCompetition(competitionId: string): string {
  return `/competitions/${competitionId}`;
}

const MOTIF_COMPETITION = /^\/competitions\/([^/]+)$/;

/** Pages réservées : un visiteur non connecté est renvoyé à l'écran de connexion (CA-6). */
const RESERVEES: readonly Page[] = [
  'organisateur',
  'motDePasse',
  'comptes',
  'profil',
  'nouvelleCompetition',
  'competition',
];

/** Pages des administrateurs : un organisateur est renvoyé à son accueil (US-007 CA-6). */
const ADMINISTRATEURS: readonly Page[] = ['comptes'];

export type Route = { page: Page; competitionId?: string } | { redirection: string };

/** Page désignée par une adresse normalisée, avec l'identifiant de la compétition s'il y en a un ; null si inconnue. */
function pageDe(chemin: string): { page: Page; competitionId?: string } | null {
  const page = (Object.keys(CHEMINS) as Exclude<Page, 'competition'>[]).find(
    (candidate) => CHEMINS[candidate] === chemin,
  );
  if (page) return { page };
  const competitionId = MOTIF_COMPETITION.exec(chemin)?.[1];
  return competitionId && MOTIF_IDENTIFIANT.test(competitionId) ? { page: 'competition', competitionId } : null;
}

/**
 * Page à afficher pour une adresse, ou adresse vers laquelle rediriger. Un compte au mot de passe temporaire ne
 * peut que le changer (US-010 CA-4) ; la gestion des comptes est réservée aux administrateurs (US-007).
 */
export function resoudreRoute(chemin: string, connecte: boolean, temporaire = false, administrateur = false): Route {
  const normalise = chemin.length > 1 ? chemin.replace(/\/+$/, '') : chemin;
  const route = pageDe(normalise);
  if (!route) return { redirection: CHEMINS.accueil };
  const { page } = route;
  if (connecte && temporaire && page !== 'motDePasse') return { redirection: CHEMINS.motDePasse };
  if (!connecte && RESERVEES.includes(page)) return { redirection: CHEMINS.connexion };
  if (connecte && page === 'connexion') return { redirection: CHEMINS.organisateur };
  if (connecte && !administrateur && ADMINISTRATEURS.includes(page)) return { redirection: CHEMINS.organisateur };
  return route;
}
