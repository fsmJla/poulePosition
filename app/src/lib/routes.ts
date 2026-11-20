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
  | 'nouvelleEpreuve'
  | 'epreuve'
  | 'modifierEpreuve'
  | 'formuleEpreuve'
  | 'inscriptionsEpreuve'
  | 'emargementEpreuve'
  | 'poulesEpreuve'
  | 'classementEpreuve'
  | 'tableauEpreuve'
  | 'impressionsEpreuve'
  | 'imprimerDocument'
  | 'parametresEpreuve'
  | 'impressionAcces'
  | 'grilleEpreuves'
  | 'manifestation'
  | 'direct'
  | 'saisie'
  | 'assistantManifestation'
  | 'creer'
  | 'aideOrganisation';

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
  /** US-025 : formulaire de création d'une épreuve. */
  nouvelleEpreuve: '/epreuves/nouvelle',
  /** US-047 : assistant de création d'une manifestation, de ses compétitions et de leurs épreuves. */
  assistantManifestation: '/manifestations/nouvelle',
  /** US-046 : « Que voulez-vous créer ? », le point d'entrée unique de la création, et l'aide « Comment ça s'organise ». */
  creer: '/creer',
  aideOrganisation: '/creer/aide',
} satisfies Record<
  Exclude<
    Page,
    | 'epreuve'
    | 'modifierEpreuve'
    | 'formuleEpreuve'
    | 'inscriptionsEpreuve'
    | 'emargementEpreuve'
    | 'poulesEpreuve'
    | 'classementEpreuve'
    | 'tableauEpreuve'
    | 'impressionsEpreuve'
    | 'imprimerDocument'
    | 'parametresEpreuve'
    | 'impressionAcces'
    | 'grilleEpreuves'
    | 'manifestation'
    | 'direct'
    | 'saisie'
  >,
  string
>);

/** US-031 : lien public vers une épreuve (spectateurs et écran géant, ADR-0007) ; sans connexion. */
export function cheminDirect(epreuveId: string): string {
  return `/direct/${epreuveId}`;
}

/** US-025 : page d'une épreuve. */
export function cheminEpreuve(epreuveId: string): string {
  return `/epreuves/${epreuveId}`;
}

/** US-045 CA-4 : formulaire « Nouvelle épreuve » ouvert sur le choix « Nouvelle compétition seule ». */
export const CHEMIN_NOUVELLE_COMPETITION_SEULE = `${CHEMINS.nouvelleEpreuve}?seule`;

/** US-056 : onglets de la page d'une manifestation, et leur suffixe d'adresse. */
export type OngletManifestation = 'competitions' | 'plan' | 'documents';
export const ONGLETS_MANIFESTATION: readonly OngletManifestation[] = ['competitions', 'plan', 'documents'];

/** US-056 CA-5 : page d'une manifestation, onglet « Compétitions ». */
export function cheminManifestation(manifestationId: string): string {
  return `/manifestations/${manifestationId}`;
}

/** US-056 CA-5 : onglet « Plan » (US-049) ; c'était l'adresse de la page du plan. */
export function cheminPlanManifestation(manifestationId: string): string {
  return `/manifestations/${manifestationId}/plan`;
}

/** US-056 CA-5 : onglet « Affiche et feuille de route » (US-030). */
export function cheminDocumentsManifestation(manifestationId: string): string {
  return `/manifestations/${manifestationId}/documents`;
}

/** US-056 CA-5 : adresse de l'onglet demandé. */
export function cheminOnglet(manifestationId: string, onglet: OngletManifestation): string {
  return onglet === 'plan'
    ? cheminPlanManifestation(manifestationId)
    : onglet === 'documents'
      ? cheminDocumentsManifestation(manifestationId)
      : cheminManifestation(manifestationId);
}

/** US-056 CA-7 : page de la manifestation avec le formulaire d'une nouvelle compétition ouvert. */
export function cheminNouvelleCompetition(manifestationId: string): string {
  return `${cheminManifestation(manifestationId)}?competition=nouvelle`;
}

/** US-056 CA-7 : page de la manifestation avec le formulaire de modification de cette compétition ouvert. */
export function cheminModificationCompetition(manifestationId: string, competitionId: string): string {
  return `${cheminManifestation(manifestationId)}?competition=${competitionId}`;
}

/** US-056 CA-7 : page de la manifestation avec le formulaire de modification de la manifestation ouvert. */
export function cheminModificationManifestation(manifestationId: string): string {
  return `${cheminManifestation(manifestationId)}?modifier`;
}

/** US-056 CA-7 : formulaire que la partie « ?… » de l'adresse demande d'ouvrir sur la page d'une manifestation ; null si aucun. */
export function ouvertureFormulaire(recherche: string): { manifestation: true } | { competition: string } | null {
  const parametres = new URLSearchParams(recherche);
  if (parametres.has('modifier')) return { manifestation: true };
  const competition = parametres.get('competition');
  if (competition === 'nouvelle') return { competition };
  return competition && MOTIF_IDENTIFIANT.test(competition) ? { competition } : null;
}

/** US-027 : formulaire de modification d'une épreuve. */
export function cheminModificationEpreuve(epreuveId: string): string {
  return `/epreuves/${epreuveId}/modifier`;
}

/** US-028 : formule d'une épreuve. */
export function cheminFormuleEpreuve(epreuveId: string): string {
  return `/epreuves/${epreuveId}/formule`;
}

/** US-082 : inscriptions d'une épreuve. */
export function cheminInscriptionsEpreuve(epreuveId: string): string {
  return `/epreuves/${epreuveId}/inscriptions`;
}

/** US-084 : émargement d'une épreuve. */
export function cheminEmargementEpreuve(epreuveId: string): string {
  return `/epreuves/${epreuveId}/emargement`;
}

/** US-086 : poules d'une épreuve (constitution, ajustement, saisie). */
export function cheminPoulesEpreuve(epreuveId: string): string {
  return `/epreuves/${epreuveId}/poules`;
}

/** US-092 : classement des poules d'une épreuve. */
export function cheminClassementEpreuve(epreuveId: string): string {
  return `/epreuves/${epreuveId}/classement`;
}

/** US-109 : tableau d'une épreuve. */
export function cheminTableauEpreuve(epreuveId: string): string {
  return `/epreuves/${epreuveId}/tableau`;
}

/** US-120 : étape « Impressions » d'une épreuve. */
export function cheminImpressionsEpreuve(epreuveId: string): string {
  return `/epreuves/${epreuveId}/impressions`;
}

/** US-120 : ce qu'une page d'impression imprime (document et choix de l'étape « Impressions »). */
export interface OptionsImpression {
  document: string;
  /** Numéro de poule ; absent : toutes les poules. */
  poule?: number;
  /** Taille du tour du tableau (32, 16… ; 2 : finale). */
  tour?: number;
  format?: 'a4' | 'a3';
}

/** US-120 : page d'impression d'un document de l'épreuve. */
export function cheminImprimer(epreuveId: string, options: OptionsImpression): string {
  const parametres = new URLSearchParams({ document: options.document });
  if (options.poule !== undefined) parametres.set('poule', String(options.poule));
  if (options.tour !== undefined) parametres.set('tour', String(options.tour));
  if (options.format) parametres.set('format', options.format);
  return `/epreuves/${epreuveId}/imprimer?${parametres}`;
}

/** US-120 : les choix d'impression d'après l'adresse ; null sans document reconnaissable. */
export function optionsImpression(recherche: string): OptionsImpression | null {
  const parametres = new URLSearchParams(recherche);
  const document = parametres.get('document');
  if (!document || !/^[a-zA-Z]+$/.test(document)) return null;
  const entier = (nom: string) => {
    const valeur = Number(parametres.get(nom));
    return Number.isInteger(valeur) && valeur > 0 ? valeur : undefined;
  };
  const options: OptionsImpression = { document };
  const poule = entier('poule');
  const tour = entier('tour');
  const format = parametres.get('format');
  if (poule !== undefined) options.poule = poule;
  if (tour !== undefined) options.tour = tour;
  if (format === 'a4' || format === 'a3') options.format = format;
  return options;
}

/** US-032 : paramètres d'une épreuve. */
export function cheminParametresEpreuve(epreuveId: string): string {
  return `/epreuves/${epreuveId}/parametres`;
}

/** US-096 CA-3 : page d'impression des QR codes d'une épreuve. */
export function cheminImpressionAcces(epreuveId: string): string {
  return `/epreuves/${epreuveId}/acces/imprimer`;
}

/** US-048 : grille des épreuves d'une compétition. */
export function cheminGrilleEpreuves(competitionId: string): string {
  return `/competitions/${competitionId}/epreuves`;
}

/** US-049 CA-2 : formulaire « Nouvelle épreuve » avec la compétition et, s'il y en a un, le jour déjà choisis. */
export function cheminNouvelleEpreuveDans(competitionId: string, jour?: string | null): string {
  const parametres = new URLSearchParams({ competition: competitionId });
  if (jour) parametres.set('jour', jour);
  return `${CHEMINS.nouvelleEpreuve}?${parametres}`;
}

/**
 * US-051 CA-2 : formulaire « Nouvelle épreuve » prérempli par la copie de l'épreuve `epreuveId`. L'adresse porte ce que
 * le plan sait de toute épreuve (compétition, arme, jour) ; le reste vient du journal local si l'appareil l'a.
 */
export function cheminDupliquerEpreuve(epreuve: {
  id: string;
  nom: string;
  arme: string;
  date: string | null;
  rattachement: { competitionId: string };
}): string {
  const parametres = new URLSearchParams({ competition: epreuve.rattachement.competitionId });
  if (epreuve.date) parametres.set('jour', epreuve.date);
  parametres.set('arme', epreuve.arme);
  parametres.set('nom', epreuve.nom);
  parametres.set('copie', epreuve.id);
  return `${CHEMINS.nouvelleEpreuve}?${parametres}`;
}

/** US-051 : épreuve à copier, arme et nom de l'originale, d'après l'adresse du formulaire ; null s'il n'y a pas de copie. */
export function copieEpreuve(recherche: string): { epreuveId: string; arme: string | null; nom: string } | null {
  const parametres = new URLSearchParams(recherche);
  const epreuveId = parametres.get('copie');
  if (!epreuveId || !MOTIF_IDENTIFIANT.test(epreuveId)) return null;
  const arme = parametres.get('arme');
  return { epreuveId, arme: arme && /^[A-Za-z]+$/.test(arme) ? arme : null, nom: parametres.get('nom') ?? '' };
}

const MOTIF_DIRECT = /^\/direct\/([^/]+)$/;
const MOTIF_SAISIE = /^\/saisie\/([^/]+)$/;
const MOTIF_MANIFESTATION = /^\/manifestations\/([^/]+)(?:\/(plan|documents))?$/;
const MOTIF_GRILLE = /^\/competitions\/([^/]+)\/epreuves$/;
const MOTIF_EPREUVE = /^\/epreuves\/([^/]+)$/;
const MOTIF_MODIFICATION = /^\/epreuves\/([^/]+)\/modifier$/;
const MOTIF_FORMULE = /^\/epreuves\/([^/]+)\/formule$/;
const MOTIF_INSCRIPTIONS = /^\/epreuves\/([^/]+)\/inscriptions$/;
const MOTIF_EMARGEMENT = /^\/epreuves\/([^/]+)\/emargement$/;
const MOTIF_POULES = /^\/epreuves\/([^/]+)\/poules$/;
const MOTIF_CLASSEMENT = /^\/epreuves\/([^/]+)\/classement$/;
const MOTIF_TABLEAU = new RegExp('^/epreuves/([^/]+)/tableau$');
const MOTIF_PARAMETRES = /^\/epreuves\/([^/]+)\/parametres$/;
const MOTIF_IMPRESSIONS = /^\/epreuves\/([^/]+)\/impressions$/;
const MOTIF_IMPRIMER = /^\/epreuves\/([^/]+)\/imprimer$/;
const MOTIF_IMPRESSION_ACCES = /^\/epreuves\/([^/]+)\/acces\/imprimer$/;

/** Pages réservées : un visiteur non connecté est renvoyé à l'écran de connexion (CA-6). */
const RESERVEES: readonly Page[] = [
  'organisateur',
  'motDePasse',
  'comptes',
  'profil',
  'nouvelleEpreuve',
  'epreuve',
  'modifierEpreuve',
  'formuleEpreuve',
  'inscriptionsEpreuve',
  'emargementEpreuve',
  'poulesEpreuve',
  'classementEpreuve',
  'tableauEpreuve',
  'impressionsEpreuve',
  'imprimerDocument',
  'parametresEpreuve',
  'impressionAcces',
  'grilleEpreuves',
  'manifestation',
  'assistantManifestation',
  'creer',
  'aideOrganisation',
];

/** Pages des administrateurs : un organisateur est renvoyé à son accueil (US-007 CA-6). */
const ADMINISTRATEURS: readonly Page[] = ['comptes'];

/**
 * US-056 CA-6 : « /manifestations », la liste d'avant la page d'une manifestation, n'existe plus. Ses adresses « ?… »
 * mènent au formulaire correspondant ; sans paramètre connu, à l'accueil de l'organisateur.
 */
const ANCIENNE_LISTE = '/manifestations';

function redirectionAncienneListe(chemin: string, connecte: boolean, temporaire: boolean): Route {
  if (!connecte) return { redirection: CHEMINS.connexion };
  if (temporaire) return { redirection: CHEMINS.motDePasse };
  const parametres = new URLSearchParams(chemin.split('?')[1] ?? '');
  if (parametres.has('nouvelle')) return { redirection: CHEMINS.assistantManifestation };
  const modifier = parametres.get('modifier');
  if (modifier && MOTIF_IDENTIFIANT.test(modifier)) return { redirection: cheminModificationManifestation(modifier) };
  const competition = parametres.get('competition');
  if (competition && MOTIF_IDENTIFIANT.test(competition))
    return { redirection: cheminNouvelleCompetition(competition) };
  return { redirection: CHEMINS.organisateur };
}

export type Route =
  | { page: Page; epreuveId?: string; competitionId?: string; manifestationId?: string; onglet?: OngletManifestation }
  | { redirection: string };

/** Page désignée par une adresse normalisée, avec l'identifiant de l’épreuve s'il y en a un ; null si inconnue. */
function pageDe(chemin: string): {
  page: Page;
  epreuveId?: string;
  competitionId?: string;
  manifestationId?: string;
  onglet?: OngletManifestation;
} | null {
  const page = (
    Object.keys(CHEMINS) as Exclude<
      Page,
      | 'epreuve'
      | 'modifierEpreuve'
      | 'formuleEpreuve'
      | 'inscriptionsEpreuve'
      | 'emargementEpreuve'
      | 'poulesEpreuve'
      | 'classementEpreuve'
      | 'tableauEpreuve'
      | 'impressionsEpreuve'
      | 'imprimerDocument'
      | 'parametresEpreuve'
      | 'impressionAcces'
      | 'grilleEpreuves'
      | 'manifestation'
      | 'direct'
      | 'saisie'
    >[]
  ).find((candidate) => CHEMINS[candidate] === chemin);
  if (page) return { page };
  // US-097 : page publique du lien d'un QR code (le jeton est dans le fragment, jamais dans le chemin).
  const saisie = MOTIF_SAISIE.exec(chemin)?.[1];
  if (saisie) return MOTIF_IDENTIFIANT.test(saisie) ? { page: 'saisie', epreuveId: saisie } : null;
  const direct = MOTIF_DIRECT.exec(chemin)?.[1];
  if (direct) return MOTIF_IDENTIFIANT.test(direct) ? { page: 'direct', epreuveId: direct } : null;
  const manifestation = MOTIF_MANIFESTATION.exec(chemin);
  if (manifestation?.[1]) {
    return MOTIF_IDENTIFIANT.test(manifestation[1])
      ? {
          page: 'manifestation',
          manifestationId: manifestation[1],
          onglet: (manifestation[2] as OngletManifestation | undefined) ?? 'competitions',
        }
      : null;
  }
  const grille = MOTIF_GRILLE.exec(chemin)?.[1];
  if (grille) return MOTIF_IDENTIFIANT.test(grille) ? { page: 'grilleEpreuves', competitionId: grille } : null;
  const modifiee = MOTIF_MODIFICATION.exec(chemin)?.[1];
  if (modifiee) return MOTIF_IDENTIFIANT.test(modifiee) ? { page: 'modifierEpreuve', epreuveId: modifiee } : null;
  const formule = MOTIF_FORMULE.exec(chemin)?.[1];
  if (formule) return MOTIF_IDENTIFIANT.test(formule) ? { page: 'formuleEpreuve', epreuveId: formule } : null;
  const inscriptions = MOTIF_INSCRIPTIONS.exec(chemin)?.[1];
  if (inscriptions) {
    return MOTIF_IDENTIFIANT.test(inscriptions) ? { page: 'inscriptionsEpreuve', epreuveId: inscriptions } : null;
  }
  const emargement = MOTIF_EMARGEMENT.exec(chemin)?.[1];
  if (emargement) {
    return MOTIF_IDENTIFIANT.test(emargement) ? { page: 'emargementEpreuve', epreuveId: emargement } : null;
  }
  const poules = MOTIF_POULES.exec(chemin)?.[1];
  if (poules) return MOTIF_IDENTIFIANT.test(poules) ? { page: 'poulesEpreuve', epreuveId: poules } : null;
  const classement = MOTIF_CLASSEMENT.exec(chemin)?.[1];
  if (classement) {
    return MOTIF_IDENTIFIANT.test(classement) ? { page: 'classementEpreuve', epreuveId: classement } : null;
  }
  const tableau = MOTIF_TABLEAU.exec(chemin)?.[1];
  if (tableau) return MOTIF_IDENTIFIANT.test(tableau) ? { page: 'tableauEpreuve', epreuveId: tableau } : null;
  const impressions = MOTIF_IMPRESSIONS.exec(chemin)?.[1];
  if (impressions) {
    return MOTIF_IDENTIFIANT.test(impressions) ? { page: 'impressionsEpreuve', epreuveId: impressions } : null;
  }
  const imprimer = MOTIF_IMPRIMER.exec(chemin)?.[1];
  if (imprimer) return MOTIF_IDENTIFIANT.test(imprimer) ? { page: 'imprimerDocument', epreuveId: imprimer } : null;
  const impressionAcces = MOTIF_IMPRESSION_ACCES.exec(chemin)?.[1];
  if (impressionAcces) {
    return MOTIF_IDENTIFIANT.test(impressionAcces) ? { page: 'impressionAcces', epreuveId: impressionAcces } : null;
  }
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
  if (normalise === ANCIENNE_LISTE) return redirectionAncienneListe(chemin, connecte, temporaire);
  const route = pageDe(normalise);
  if (!route) return { redirection: CHEMINS.accueil };
  const { page } = route;
  if (connecte && temporaire && page !== 'motDePasse') return { redirection: CHEMINS.motDePasse };
  if (!connecte && RESERVEES.includes(page)) return { redirection: CHEMINS.connexion };
  if (connecte && page === 'connexion') return { redirection: CHEMINS.organisateur };
  if (connecte && !administrateur && ADMINISTRATEURS.includes(page)) return { redirection: CHEMINS.organisateur };
  return route;
}

/** US-049 CA-2 : compétition et jour que l'adresse du formulaire « Nouvelle épreuve » demande de préchoisir. */
export function preselectionEpreuve(recherche: string): { competitionId: string; jour: string | null } | null {
  const parametres = new URLSearchParams(recherche);
  const competitionId = parametres.get('competition');
  if (!competitionId || !MOTIF_IDENTIFIANT.test(competitionId)) return null;
  const jour = parametres.get('jour');
  return { competitionId, jour: jour && /^\d{4}-\d{2}-\d{2}$/.test(jour) ? jour : null };
}
