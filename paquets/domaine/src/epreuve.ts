// Règles d'une épreuve (US-024) : champs, arme cohérente avec ses compétitions, épreuve vide. Une épreuve appartient
// toujours à une manifestation et n'a pas de dates propres ; elle est stockée par le serveur (ADR-0016).
import { ARMES, LONGUEUR_MAX_COMMENTAIRE, type Arme, type Rattachement } from './competition';
import { validerNom } from './comptes';

/** Champs saisis d'une épreuve ; arme et commentaire facultatifs non saisis : null. */
export interface DonneesEpreuve {
  manifestationId: string;
  nom: string;
  arme: Arme | null;
  commentaire: string | null;
}

export type ErreurEpreuve =
  'NOM_VIDE' | 'NOM_TROP_LONG' | 'MANIFESTATION_OBLIGATOIRE' | 'ARME_INVALIDE' | 'COMMENTAIRE_TROP_LONG';

/** Une erreur par champ, pour l'afficher sous le champ en cause. */
export type ErreursEpreuve = Partial<Record<keyof DonneesEpreuve, ErreurEpreuve>>;

/** Ce qu'il faut savoir d'une compétition pour la confronter à une épreuve (résumé de l'index du club). */
export interface CompetitionDeEpreuve {
  rattachement: Rattachement | null;
}

/** Textes sans les espaces autour ; un texte facultatif vide devient absent. */
export function normaliserEpreuve(donnees: DonneesEpreuve): DonneesEpreuve {
  return { ...donnees, nom: donnees.nom.trim(), commentaire: donnees.commentaire?.trim() || null };
}

/** CA-1 à CA-3 : erreurs de la saisie, une par champ ({} si elle est valide). */
export function validerEpreuve(saisie: DonneesEpreuve): ErreursEpreuve {
  const donnees = normaliserEpreuve(saisie);
  const erreurs: ErreursEpreuve = {};
  const nom = validerNom(donnees.nom);
  if (nom) erreurs.nom = nom as ErreurEpreuve;
  // CA-2 : une épreuve appartient toujours à une manifestation.
  if (donnees.manifestationId === '') erreurs.manifestationId = 'MANIFESTATION_OBLIGATOIRE';
  if (donnees.arme !== null && !(ARMES as readonly unknown[]).includes(donnees.arme)) erreurs.arme = 'ARME_INVALIDE';
  if ((donnees.commentaire?.length ?? 0) > LONGUEUR_MAX_COMMENTAIRE) erreurs.commentaire = 'COMMENTAIRE_TROP_LONG';
  return erreurs;
}

/** CA-5 : vrai si aucune compétition ne se rattache à l'épreuve. */
export function estVideEpreuve(epreuveId: string, competitions: readonly CompetitionDeEpreuve[]): boolean {
  return !competitions.some((competition) => competition.rattachement?.epreuveId === epreuveId);
}
