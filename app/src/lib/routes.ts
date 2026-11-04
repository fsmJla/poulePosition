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
  | 'nouvelleCompetition'
  | 'competition'
  | 'modifierCompetition'
  | 'formuleCompetition'
  | 'parametresCompetition';

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
  /** US-023 : liste, création et modification des manifestations du club. */
  manifestations: '/manifestations',
  /** US-025 : formulaire de création d'une compétition. */
  nouvelleCompetition: '/competitions/nouvelle',
} satisfies Record<
  Exclude<Page, 'competition' | 'modifierCompetition' | 'formuleCompetition' | 'parametresCompetition'>,
  string
>);

/** US-025 : page d'une compétition. */
export function cheminCompetition(competitionId: string): string {
  return `/competitions/${competitionId}`;
}

/** US-026 CA-5 : adresse de la page Manifestations avec le formulaire de création d'une manifestation ouvert. */
export const CHEMIN_NOUVELLE_MANIFESTATION = `${CHEMINS.manifestations}?nouvelle`;

/** US-026 CA-5 : adresse de la page Manifestations avec le formulaire d'une nouvelle épreuve de cette manifestation. */
export function cheminNouvelleEpreuve(manifestationId: string): string {
  return `${CHEMINS.manifestations}?epreuve=${manifestationId}`;
}

/** Formulaire que la partie « ?… » de l'adresse demande d'ouvrir sur la page Manifestations ; null si aucun. */
export function ouvertureManifestations(recherche: string): { nouvelle: true } | { epreuveDe: string } | null {
  const parametres = new URLSearchParams(recherche);
  if (parametres.has('nouvelle')) return { nouvelle: true };
  const epreuveDe = parametres.get('epreuve');
  return epreuveDe && MOTIF_IDENTIFIANT.test(epreuveDe) ? { epreuveDe } : null;
}

/** US-027 : formulaire de modification d'une compétition. */
export function cheminModificationCompetition(competitionId: string): string {
  return `/competitions/${competitionId}/modifier`;
}

/** US-028 : formule d'une compétition. */
export function cheminFormuleCompetition(competitionId: string): string {
  return `/competitions/${competitionId}/formule`;
}

/** US-032 : paramètres d'une compétition. */
export function cheminParametresCompetition(competitionId: string): string {
  return `/competitions/${competitionId}/parametres`;
}

const MOTIF_COMPETITION = /^\/competitions\/([^/]+)$/;
const MOTIF_MODIFICATION = /^\/competitions\/([^/]+)\/modifier$/;
const MOTIF_FORMULE = /^\/competitions\/([^/]+)\/formule$/;
const MOTIF_PARAMETRES = /^\/competitions\/([^/]+)\/parametres$/;

/** Pages réservées : un visiteur non connecté est renvoyé à l'écran de connexion (CA-6). */
const RESERVEES: readonly Page[] = [
  'organisateur',
  'motDePasse',
  'comptes',
  'profil',
  'manifestations',
  'nouvelleCompetition',
  'competition',
  'modifierCompetition',
  'formuleCompetition',
  'parametresCompetition',
];

/** Pages des administrateurs : un organisateur est renvoyé à son accueil (US-007 CA-6). */
const ADMINISTRATEURS: readonly Page[] = ['comptes'];

export type Route = { page: Page; competitionId?: string } | { redirection: string };

/** Page désignée par une adresse normalisée, avec l'identifiant de la compétition s'il y en a un ; null si inconnue. */
function pageDe(chemin: string): { page: Page; competitionId?: string } | null {
  const page = (
    Object.keys(CHEMINS) as Exclude<
      Page,
      'competition' | 'modifierCompetition' | 'formuleCompetition' | 'parametresCompetition'
    >[]
  ).find((candidate) => CHEMINS[candidate] === chemin);
  if (page) return { page };
  const modifiee = MOTIF_MODIFICATION.exec(chemin)?.[1];
  if (modifiee)
    return MOTIF_IDENTIFIANT.test(modifiee) ? { page: 'modifierCompetition', competitionId: modifiee } : null;
  const formule = MOTIF_FORMULE.exec(chemin)?.[1];
  if (formule) return MOTIF_IDENTIFIANT.test(formule) ? { page: 'formuleCompetition', competitionId: formule } : null;
  const parametres = MOTIF_PARAMETRES.exec(chemin)?.[1];
  if (parametres) {
    return MOTIF_IDENTIFIANT.test(parametres) ? { page: 'parametresCompetition', competitionId: parametres } : null;
  }
  const competitionId = MOTIF_COMPETITION.exec(chemin)?.[1];
  return competitionId && MOTIF_IDENTIFIANT.test(competitionId) ? { page: 'competition', competitionId } : null;
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
