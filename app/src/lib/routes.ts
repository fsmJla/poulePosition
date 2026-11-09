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
  | 'manifestations'
  | 'nouvelleEpreuve'
  | 'epreuve'
  | 'modifierEpreuve'
  | 'formuleEpreuve'
  | 'parametresEpreuve';

/** Adresses fixes ; celle d'une épreuve porte son identifiant (`cheminEpreuve`). */
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
  /** US-023 : liste, création et modification des manifestations du club. */
  manifestations: '/manifestations',
  /** US-025 : formulaire de création d'une épreuve. */
  nouvelleEpreuve: '/epreuves/nouvelle',
} satisfies Record<Exclude<Page, 'epreuve' | 'modifierEpreuve' | 'formuleEpreuve' | 'parametresEpreuve'>, string>);

/** US-025 : page d'une épreuve. */
export function cheminEpreuve(epreuveId: string): string {
  return `/epreuves/${epreuveId}`;
}

/** US-026 CA-5 : adresse de la page Manifestations avec le formulaire de création d'une manifestation ouvert. */
export const CHEMIN_NOUVELLE_MANIFESTATION = `${CHEMINS.manifestations}?nouvelle`;

/** US-026 CA-5 : adresse de la page Manifestations avec le formulaire d'une nouvelle compétition de cette manifestation. */
export function cheminNouvelleCompetition(manifestationId: string): string {
  return `${CHEMINS.manifestations}?competition=${manifestationId}`;
}

/** Formulaire que la partie « ?… » de l'adresse demande d'ouvrir sur la page Manifestations ; null si aucun. */
export function ouvertureManifestations(recherche: string): { nouvelle: true } | { competitionDe: string } | null {
  const parametres = new URLSearchParams(recherche);
  if (parametres.has('nouvelle')) return { nouvelle: true };
  const competitionDe = parametres.get('competition');
  return competitionDe && MOTIF_IDENTIFIANT.test(competitionDe) ? { competitionDe } : null;
}

/** US-027 : formulaire de modification d'une épreuve. */
export function cheminModificationEpreuve(epreuveId: string): string {
  return `/epreuves/${epreuveId}/modifier`;
}

/** US-028 : formule d'une épreuve. */
export function cheminFormuleEpreuve(epreuveId: string): string {
  return `/epreuves/${epreuveId}/formule`;
}

/** US-032 : paramètres d'une épreuve. */
export function cheminParametresEpreuve(epreuveId: string): string {
  return `/epreuves/${epreuveId}/parametres`;
}

const MOTIF_EPREUVE = /^\/epreuves\/([^/]+)$/;
const MOTIF_MODIFICATION = /^\/epreuves\/([^/]+)\/modifier$/;
const MOTIF_FORMULE = /^\/epreuves\/([^/]+)\/formule$/;
const MOTIF_PARAMETRES = /^\/epreuves\/([^/]+)\/parametres$/;

/** Pages réservées : un visiteur non connecté est renvoyé à l'écran de connexion (CA-6). */
const RESERVEES: readonly Page[] = [
  'organisateur',
  'motDePasse',
  'comptes',
  'profil',
  'manifestations',
  'nouvelleEpreuve',
  'epreuve',
  'modifierEpreuve',
  'formuleEpreuve',
  'parametresEpreuve',
];

/** Pages des administrateurs : un organisateur est renvoyé à son accueil (US-007 CA-6). */
const ADMINISTRATEURS: readonly Page[] = ['comptes'];

export type Route = { page: Page; epreuveId?: string } | { redirection: string };

/** Page désignée par une adresse normalisée, avec l'identifiant de l’épreuve s'il y en a un ; null si inconnue. */
function pageDe(chemin: string): { page: Page; epreuveId?: string } | null {
  const page = (
    Object.keys(CHEMINS) as Exclude<Page, 'epreuve' | 'modifierEpreuve' | 'formuleEpreuve' | 'parametresEpreuve'>[]
  ).find((candidate) => CHEMINS[candidate] === chemin);
  if (page) return { page };
  const modifiee = MOTIF_MODIFICATION.exec(chemin)?.[1];
  if (modifiee) return MOTIF_IDENTIFIANT.test(modifiee) ? { page: 'modifierEpreuve', epreuveId: modifiee } : null;
  const formule = MOTIF_FORMULE.exec(chemin)?.[1];
  if (formule) return MOTIF_IDENTIFIANT.test(formule) ? { page: 'formuleEpreuve', epreuveId: formule } : null;
  const parametres = MOTIF_PARAMETRES.exec(chemin)?.[1];
  if (parametres) {
    return MOTIF_IDENTIFIANT.test(parametres) ? { page: 'parametresEpreuve', epreuveId: parametres } : null;
  }
  const epreuveId = MOTIF_EPREUVE.exec(chemin)?.[1];
  return epreuveId && MOTIF_IDENTIFIANT.test(epreuveId) ? { page: 'epreuve', epreuveId } : null;
}

/**
 * Page à afficher pour une adresse, ou adresse vers laquelle rediriger. Un compte au mot de passe temporaire ne
 * peut que le changer (US-010 CA-4) ; la gestion des comptes est réservée aux administrateurs (US-007).
 */
export function resoudreRoute(chemin: string, connecte: boolean, temporaire = false, administrateur = false): Route {
  // La partie « ?… » d'une adresse ne choisit pas la page (US-026 CA-5).
  const sansRecherche = chemin.split('?')[0] ?? chemin;
  const normalise = sansRecherche.length > 1 ? sansRecherche.replace(/\/+$/, '') : sansRecherche;
  const route = pageDe(normalise);
  if (!route) return { redirection: CHEMINS.accueil };
  const { page } = route;
  if (connecte && temporaire && page !== 'motDePasse') return { redirection: CHEMINS.motDePasse };
  if (!connecte && RESERVEES.includes(page)) return { redirection: CHEMINS.connexion };
  if (connecte && page === 'connexion') return { redirection: CHEMINS.organisateur };
  if (connecte && !administrateur && ADMINISTRATEURS.includes(page)) return { redirection: CHEMINS.organisateur };
  return route;
}
