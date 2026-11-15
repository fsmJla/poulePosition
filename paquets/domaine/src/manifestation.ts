// Règles d'une manifestation (US-023) : champs et dates, épreuves rattachées hors des dates, manifestation vide.
// Une manifestation n'a ni journal ni pilote : elle est stockée par le serveur avec un numéro de version (ADR-0016).
import { estDate, LONGUEUR_MAX_COMMENTAIRE, LONGUEUR_MAX_LIEU, type Rattachement } from './epreuve';
import { validerNom } from './comptes';

/** Position d'une adresse choisie (US-070), en degrés décimaux. */
export interface Coordonnees {
  lat: number;
  lon: number;
}

/** Champs saisis d'une manifestation ; dates au format `AAAA-MM-JJ`, texte facultatif non saisi : null. */
export interface DonneesManifestation {
  nom: string;
  debut: string;
  fin: string;
  lieu: string | null;
  commentaire: string | null;
  /** US-070 : position de l'adresse choisie ; absente (ou null) pour un lieu saisi à la main et pour les manifestations d'avant. */
  coordonnees?: Coordonnees | null;
}

/** Vrai pour une latitude de −90 à 90 et une longitude de −180 à 180, nombres finis (US-070). */
export function sontCoordonneesValides(valeur: unknown): valeur is Coordonnees {
  if (valeur === null || typeof valeur !== 'object' || Array.isArray(valeur)) return false;
  const { lat, lon, ...autres } = valeur as Record<string, unknown>;
  return (
    Object.keys(autres).length === 0 &&
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lon) <= 180
  );
}

export type ErreurManifestation =
  | 'NOM_VIDE'
  | 'NOM_TROP_LONG'
  | 'DATE_OBLIGATOIRE'
  | 'DATE_INVALIDE'
  | 'FIN_AVANT_DEBUT'
  | 'LIEU_TROP_LONG'
  | 'COORDONNEES_INVALIDES'
  | 'COMMENTAIRE_TROP_LONG';

/** Une erreur par champ, pour l'afficher sous le champ en cause. */
export type ErreursManifestation = Partial<Record<keyof DonneesManifestation, ErreurManifestation>>;

/** Ce qu'il faut savoir d'une épreuve pour la confronter à une manifestation (résumé de l'index du club). */
export interface EpreuveRattachee {
  id: string;
  nom: string;
  date: string | null;
  rattachement: Rattachement | null;
}

/** Textes sans les espaces autour ; un texte facultatif vide devient absent. */
export function normaliserManifestation(donnees: DonneesManifestation): DonneesManifestation {
  const facultatif = (texte: string | null) => texte?.trim() || null;
  const lieu = facultatif(donnees.lieu);
  const { coordonnees, ...reste } = donnees;
  // US-070 : des coordonnées sans lieu n'ont pas de sens ; le champ est absent plutôt que null pour rester compatible.
  return {
    ...reste,
    nom: donnees.nom.trim(),
    lieu,
    commentaire: facultatif(donnees.commentaire),
    ...(coordonnees && lieu !== null ? { coordonnees } : {}),
  };
}

function erreurDate(date: string): ErreurManifestation | null {
  if (date === '') return 'DATE_OBLIGATOIRE';
  return estDate(date) ? null : 'DATE_INVALIDE';
}

/** CA-1 et CA-3 : erreurs de la saisie, une par champ ({} si elle est valide). */
export function validerManifestation(saisie: DonneesManifestation): ErreursManifestation {
  const donnees = normaliserManifestation(saisie);
  const erreurs: ErreursManifestation = {};
  const nom = validerNom(donnees.nom);
  if (nom) erreurs.nom = nom as ErreurManifestation;
  const debut = erreurDate(donnees.debut);
  if (debut) erreurs.debut = debut;
  const fin = erreurDate(donnees.fin);
  if (fin) erreurs.fin = fin;
  // Les jours `AAAA-MM-JJ` se comparent comme des textes ; une manifestation peut durer un seul jour.
  else if (!debut && donnees.fin < donnees.debut) erreurs.fin = 'FIN_AVANT_DEBUT';
  if ((donnees.lieu?.length ?? 0) > LONGUEUR_MAX_LIEU) erreurs.lieu = 'LIEU_TROP_LONG';
  if (donnees.coordonnees != null && !sontCoordonneesValides(donnees.coordonnees)) {
    erreurs.coordonnees = 'COORDONNEES_INVALIDES';
  }
  if ((donnees.commentaire?.length ?? 0) > LONGUEUR_MAX_COMMENTAIRE) erreurs.commentaire = 'COMMENTAIRE_TROP_LONG';
  return erreurs;
}

/** US-045 : une épreuve est dans la manifestation de sa compétition. */
const estRattachee = (
  manifestationId: string,
  { rattachement }: Pick<EpreuveRattachee, 'rattachement'>,
  competitions: readonly { id: string; manifestationId: string | null }[],
) =>
  rattachement !== null &&
  competitions.some(
    ({ id, manifestationId: parent }) => id === rattachement.competitionId && parent === manifestationId,
  );

/** CA-4 : épreuves de la manifestation dont la date ne serait plus comprise entre `debut` et `fin`. */
export function epreuvesHorsDates<T extends EpreuveRattachee>(
  manifestationId: string,
  debut: string,
  fin: string,
  epreuves: readonly T[],
  competitions: readonly { id: string; manifestationId: string | null }[],
): T[] {
  return epreuves.filter(
    (epreuve) =>
      estRattachee(manifestationId, epreuve, competitions) &&
      epreuve.date !== null &&
      (epreuve.date < debut || epreuve.date > fin),
  );
}

/** CA-5 : vrai si aucune compétition (US-024, US-045) ne se rattache à la manifestation ; ses épreuves sont dans ses compétitions. */
export function estVide(manifestationId: string, competitions: readonly { manifestationId: string | null }[]): boolean {
  return !competitions.some((competition) => competition.manifestationId === manifestationId);
}
