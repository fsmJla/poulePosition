// Règles d'une compétition (US-024) : champs, arme cohérente avec ses épreuves, compétition vide. Une compétition appartient
// toujours à une manifestation et n'a pas de dates propres ; elle est stockée par le serveur (ADR-0016).
import { ARMES, LONGUEUR_MAX_COMMENTAIRE, type Arme, type Rattachement } from './epreuve';
import { validerNom } from './comptes';

/** Champs saisis d'une compétition ; arme et commentaire facultatifs non saisis : null. */
export interface DonneesCompetition {
  manifestationId: string;
  nom: string;
  arme: Arme | null;
  commentaire: string | null;
}

export type ErreurCompetition =
  'NOM_VIDE' | 'NOM_TROP_LONG' | 'MANIFESTATION_OBLIGATOIRE' | 'ARME_INVALIDE' | 'COMMENTAIRE_TROP_LONG';

/** Une erreur par champ, pour l'afficher sous le champ en cause. */
export type ErreursCompetition = Partial<Record<keyof DonneesCompetition, ErreurCompetition>>;

/** Ce qu'il faut savoir d'une épreuve pour la confronter à une compétition (résumé de l'index du club). */
export interface EpreuveDeCompetition {
  rattachement: Rattachement | null;
}

/** Textes sans les espaces autour ; un texte facultatif vide devient absent. */
export function normaliserCompetition(donnees: DonneesCompetition): DonneesCompetition {
  return { ...donnees, nom: donnees.nom.trim(), commentaire: donnees.commentaire?.trim() || null };
}

/** CA-1 à CA-3 : erreurs de la saisie, une par champ ({} si elle est valide). */
export function validerCompetition(saisie: DonneesCompetition): ErreursCompetition {
  const donnees = normaliserCompetition(saisie);
  const erreurs: ErreursCompetition = {};
  const nom = validerNom(donnees.nom);
  if (nom) erreurs.nom = nom as ErreurCompetition;
  // CA-2 : une compétition appartient toujours à une manifestation.
  if (donnees.manifestationId === '') erreurs.manifestationId = 'MANIFESTATION_OBLIGATOIRE';
  if (donnees.arme !== null && !(ARMES as readonly unknown[]).includes(donnees.arme)) erreurs.arme = 'ARME_INVALIDE';
  if ((donnees.commentaire?.length ?? 0) > LONGUEUR_MAX_COMMENTAIRE) erreurs.commentaire = 'COMMENTAIRE_TROP_LONG';
  return erreurs;
}

/** CA-5 : vrai si aucune épreuve ne se rattache à la compétition. */
export function estVideCompetition(competitionId: string, epreuves: readonly EpreuveDeCompetition[]): boolean {
  return !epreuves.some((epreuve) => epreuve.rattachement?.competitionId === competitionId);
}
