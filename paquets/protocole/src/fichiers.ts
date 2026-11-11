// Fichiers joints (US-030, ADR-0011 et ADR-0022, docs/protocole.md §15) : une affiche et une feuille de route par
// manifestation, compétition ou épreuve, gardées par le DO `Club` en morceaux de 1 Mo. La liste ne porte que les
// descriptions ; le contenu se lit par `GET /fichiers/<nom>`, public, avec un nom qui est l'empreinte du contenu.
import {
  MOTIF_NOM_FICHIER,
  PROPRIETAIRES_FICHIER,
  SORTES_FICHIER,
  TYPES_FICHIER,
  type ProprietaireFichier,
  type RaisonRefus,
  type SorteFichier,
  type TypeFichier,
} from '@poule-position/domaine';
import { type ErreurReponse } from './session';
import { aExactementLesChamps } from './validation';

/** Description d'un fichier joint, telle que le serveur la garde et la renvoie. */
export interface FichierJoint {
  proprietaire: ProprietaireFichier;
  proprietaireId: string;
  sorte: SorteFichier;
  /** Empreinte SHA-256 du contenu et extension : change quand le fichier est remplacé (CA-5). */
  nom: string;
  type: TypeFichier;
  taille: number;
  /** Date de l'envoi, en millisecondes. */
  ajouteLe: number;
  /** Nom du compte qui l'a envoyé. */
  ajoutePar: string;
}

/** Description publique d'un fichier : sans le nom du compte qui l'a joint (US-031 CA-5). */
export type FichierPublic = Omit<FichierJoint, 'ajoutePar'>;

export type ReponseFichier =
  { ok: true; fichier: FichierJoint } | { ok: false; erreur: ErreurReponse; raison?: RaisonRefus };

export type ReponseFichiers = { ok: true; fichiers: FichierJoint[] } | { ok: false; erreur: ErreurReponse };

const CHAMPS = ['proprietaire', 'proprietaireId', 'sorte', 'nom', 'type', 'taille', 'ajouteLe', 'ajoutePar'] as const;
const RAISONS: readonly string[] = [
  'VIDE',
  'TROP_GROS',
  'TYPE_REFUSE',
  'TYPE_INCOMPATIBLE',
  'IMAGE_ANIMEE',
  'IMAGE_TROP_GRANDE',
] satisfies RaisonRefus[];

function estObjet(brut: unknown): brut is Record<string, unknown> {
  return brut !== null && typeof brut === 'object' && !Array.isArray(brut);
}

const estUnDe = <T extends string>(valeurs: readonly T[], valeur: unknown): valeur is T =>
  typeof valeur === 'string' && (valeurs as readonly string[]).includes(valeur);

/** Chemin de l'envoi, du remplacement et du retrait d'un fichier. */
export function cheminFichier(proprietaire: ProprietaireFichier, id: string, sorte: SorteFichier): string {
  return `/fichiers/${proprietaire}/${encodeURIComponent(id)}/${sorte}`;
}

/** Un fichier décrit pour le public : exactement les champs de `FichierJoint`, hors `ajoutePar`. */
export function analyserFichierPublic(brut: unknown): FichierPublic | null {
  if (brut === null || typeof brut !== 'object' || Array.isArray(brut) || 'ajoutePar' in brut) return null;
  const fichier = analyserFichierJoint({ ...(brut as Record<string, unknown>), ajoutePar: '' });
  if (!fichier) return null;
  const { proprietaire, proprietaireId, sorte, nom, type, taille, ajouteLe } = fichier;
  return { proprietaire, proprietaireId, sorte, nom, type, taille, ajouteLe };
}

export function analyserFichierJoint(brut: unknown): FichierJoint | null {
  const objet = aExactementLesChamps(brut, CHAMPS);
  if (!objet) return null;
  const { proprietaire, proprietaireId, sorte, nom, type, taille, ajouteLe, ajoutePar } = objet;
  if (
    !estUnDe(PROPRIETAIRES_FICHIER, proprietaire) ||
    !estUnDe(SORTES_FICHIER, sorte) ||
    !estUnDe(TYPES_FICHIER, type)
  ) {
    return null;
  }
  if (typeof proprietaireId !== 'string' || typeof nom !== 'string' || !MOTIF_NOM_FICHIER.test(nom)) return null;
  if (!Number.isInteger(taille) || typeof ajouteLe !== 'number' || typeof ajoutePar !== 'string') return null;
  return objet as unknown as FichierJoint;
}

function erreurDe(brut: unknown): { ok: false; erreur: ErreurReponse; raison?: RaisonRefus } {
  const code = estObjet(brut) && typeof brut.erreur === 'string' ? (brut.erreur as ErreurReponse) : 'REPONSE_INVALIDE';
  const raison = estObjet(brut) && estUnDe(RAISONS, brut.raison) ? (brut.raison as RaisonRefus) : undefined;
  return raison ? { ok: false, erreur: code, raison } : { ok: false, erreur: code };
}

/** Réponse d'un envoi : le fichier décrit, ou le refus (avec sa raison pour `FICHIER_REFUSE`). */
export function analyserReponseFichier(brut: unknown): ReponseFichier {
  if (estObjet(brut) && brut.ok === true) {
    const fichier = analyserFichierJoint(brut.fichier);
    return fichier ? { ok: true, fichier } : { ok: false, erreur: 'REPONSE_INVALIDE' };
  }
  return erreurDe(brut);
}

/** Réponse de `GET /fichiers` : la description de tous les fichiers du club. */
export function analyserReponseFichiers(brut: unknown): ReponseFichiers {
  if (!estObjet(brut) || brut.ok !== true) return erreurDe(brut);
  if (!Array.isArray(brut.fichiers)) return { ok: false, erreur: 'REPONSE_INVALIDE' };
  const fichiers = brut.fichiers.map(analyserFichierJoint);
  if (fichiers.some((fichier) => fichier === null)) return { ok: false, erreur: 'REPONSE_INVALIDE' };
  return { ok: true, fichiers: fichiers as FichierJoint[] };
}
