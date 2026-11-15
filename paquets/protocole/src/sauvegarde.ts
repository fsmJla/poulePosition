// Sauvegarde d'une épreuve dans un fichier `.poule.json` (US-034, ADR-0003, docs/protocole.md §17) : le journal complet,
// de quoi décrire le rattachement et les fichiers joints. Le même format sert à l'import (US-035) : il est donc validé ici,
// pour que l'application et les tests n'aient qu'une définition.
import {
  ARMES,
  PROPRIETAIRES_FICHIER,
  SORTES_FICHIER,
  TYPES_FICHIER,
  type Arme,
  type Evenement,
  type ProprietaireFichier,
  type SorteFichier,
  type TypeFichier,
} from '@poule-position/domaine';
import { lireEvenement } from './journal';
import { aExactementLesChamps, estTexteOuNull } from './validation';

/** Reconnaît un fichier de poulePosition, quel que soit son contenu. */
export const FORMAT_SAUVEGARDE = 'poule-position-epreuve';

/** Version courante du format du fichier ; un fichier d'une version plus récente est refusé à l'import. */
export const VERSION_SAUVEGARDE = 1;

/** Extension d'un fichier de sauvegarde. */
export const EXTENSION_SAUVEGARDE = '.poule.json';

export interface ManifestationSauvegardee {
  id: string;
  nom: string;
  /** Jours au format `AAAA-MM-JJ`. */
  debut: string;
  fin: string;
  lieu: string | null;
}

export interface CompetitionSauvegardee {
  id: string;
  nom: string;
  arme: Arme | null;
}

/** Un fichier joint, avec son contenu en base64 (CA-2), pour une reprise complète hors ligne. */
export interface FichierSauvegarde {
  proprietaire: ProprietaireFichier;
  proprietaireId: string;
  sorte: SorteFichier;
  /** Empreinte SHA-256 et extension, comme sur le serveur. */
  nom: string;
  type: TypeFichier;
  taille: number;
  contenu: string;
}

export interface SauvegardeEpreuve {
  format: typeof FORMAT_SAUVEGARDE;
  version: number;
  /** Date de l'export, en millisecondes. */
  exporteLe: number;
  epreuveId: string;
  clubId: string;
  /** Le journal complet, dans l'ordre des `seq`. */
  journal: Evenement[];
  /** CA-3 : la compétition et la manifestation, décrites ; null si l'épreuve n'en a pas ou si elles sont inconnues. */
  competition: CompetitionSauvegardee | null;
  manifestation: ManifestationSauvegardee | null;
  fichiers: FichierSauvegarde[];
}

/** Pourquoi un fichier est refusé à l'import (US-035 CA-4). */
export type ErreurSauvegarde = 'ILLISIBLE' | 'AUTRE_FORMAT' | 'VERSION_FUTURE' | 'JOURNAL_INVALIDE';

export type ResultatSauvegarde = { ok: true; sauvegarde: SauvegardeEpreuve } | { ok: false; erreur: ErreurSauvegarde };

const CHAMPS = [
  'format',
  'version',
  'exporteLe',
  'epreuveId',
  'clubId',
  'journal',
  'competition',
  'manifestation',
  'fichiers',
];
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;
const JOUR = /^\d{4}-\d{2}-\d{2}$/;
const estTexteNonVide = (valeur: unknown): valeur is string => typeof valeur === 'string' && valeur !== '';

/** `AAAA-MM-JJ-HHhMM` d'une date locale. */
function horodatage(date: Date): string {
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())}-${deux(date.getHours())}h${deux(date.getMinutes())}`;
}

/** CA-1 : `<nom-de-l-epreuve>-<AAAA-MM-JJ-HHhMM>.poule.json` ; le nom est réduit à des lettres sans accent, chiffres et tirets. */
export function nomFichierSauvegarde(nomEpreuve: string, date: Date): string {
  const nom = nomEpreuve
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return `${nom || 'epreuve'}-${horodatage(date)}${EXTENSION_SAUVEGARDE}`;
}

function analyserManifestation(brut: unknown): ManifestationSauvegardee | null | undefined {
  if (brut === null) return null;
  const objet = aExactementLesChamps(brut, ['id', 'nom', 'debut', 'fin', 'lieu']);
  if (!objet || !estTexteNonVide(objet.id) || typeof objet.nom !== 'string') return undefined;
  if (typeof objet.debut !== 'string' || !JOUR.test(objet.debut)) return undefined;
  if (typeof objet.fin !== 'string' || !JOUR.test(objet.fin) || !estTexteOuNull(objet.lieu)) return undefined;
  return objet as unknown as ManifestationSauvegardee;
}

function analyserCompetition(brut: unknown): CompetitionSauvegardee | null | undefined {
  if (brut === null) return null;
  const objet = aExactementLesChamps(brut, ['id', 'nom', 'arme']);
  if (!objet || !estTexteNonVide(objet.id) || typeof objet.nom !== 'string') return undefined;
  if (objet.arme !== null && !(ARMES as readonly unknown[]).includes(objet.arme)) return undefined;
  return objet as unknown as CompetitionSauvegardee;
}

function analyserFichier(brut: unknown): FichierSauvegarde | null {
  const objet = aExactementLesChamps(brut, [
    'proprietaire',
    'proprietaireId',
    'sorte',
    'nom',
    'type',
    'taille',
    'contenu',
  ]);
  if (!objet) return null;
  const { proprietaire, proprietaireId, sorte, nom, type, taille, contenu } = objet;
  const connu = (valeurs: readonly string[], valeur: unknown) => typeof valeur === 'string' && valeurs.includes(valeur);
  if (!connu(PROPRIETAIRES_FICHIER, proprietaire) || !connu(SORTES_FICHIER, sorte) || !connu(TYPES_FICHIER, type)) {
    return null;
  }
  if (!estTexteNonVide(proprietaireId) || !estTexteNonVide(nom) || !Number.isInteger(taille)) return null;
  if (typeof contenu !== 'string' || !BASE64.test(contenu) || contenu.length % 4 !== 0) return null;
  return objet as unknown as FichierSauvegarde;
}

/**
 * Analyse un fichier de sauvegarde lu et décodé en JSON : un autre format, une version future ou un journal illisible
 * sont refusés avec leur raison (US-035 CA-4). Le journal doit être complet : `seq` de 1 à n, tous de la même épreuve.
 */
export function analyserSauvegarde(brut: unknown): ResultatSauvegarde {
  if (brut === null || typeof brut !== 'object' || Array.isArray(brut)) return { ok: false, erreur: 'ILLISIBLE' };
  const entete = brut as Record<string, unknown>;
  if (entete.format !== FORMAT_SAUVEGARDE) return { ok: false, erreur: 'AUTRE_FORMAT' };
  if (!Number.isInteger(entete.version) || (entete.version as number) < 1) return { ok: false, erreur: 'ILLISIBLE' };
  if ((entete.version as number) > VERSION_SAUVEGARDE) return { ok: false, erreur: 'VERSION_FUTURE' };
  const objet = aExactementLesChamps(brut, CHAMPS);
  if (!objet || !estTexteNonVide(objet.epreuveId) || !estTexteNonVide(objet.clubId)) {
    return { ok: false, erreur: 'ILLISIBLE' };
  }
  if (!Number.isFinite(objet.exporteLe) || !Array.isArray(objet.journal) || !Array.isArray(objet.fichiers)) {
    return { ok: false, erreur: 'ILLISIBLE' };
  }
  const competition = analyserCompetition(objet.competition);
  const manifestation = analyserManifestation(objet.manifestation);
  const fichiers = (objet.fichiers as unknown[]).map(analyserFichier);
  if (competition === undefined || manifestation === undefined || fichiers.includes(null)) {
    return { ok: false, erreur: 'ILLISIBLE' };
  }
  const journal: Evenement[] = [];
  for (const [i, ligne] of (objet.journal as unknown[]).entries()) {
    const evenement = lireEvenement(ligne);
    if (
      !evenement ||
      evenement.seq !== i + 1 ||
      evenement.epreuveId !== objet.epreuveId ||
      evenement.clubId !== objet.clubId
    ) {
      return { ok: false, erreur: 'JOURNAL_INVALIDE' };
    }
    journal.push(evenement);
  }
  if (journal.length === 0) return { ok: false, erreur: 'JOURNAL_INVALIDE' };
  return {
    ok: true,
    sauvegarde: {
      format: FORMAT_SAUVEGARDE,
      version: entete.version as number,
      exporteLe: objet.exporteLe as number,
      epreuveId: objet.epreuveId,
      clubId: objet.clubId,
      journal,
      competition,
      manifestation,
      fichiers: fichiers as FichierSauvegarde[],
    },
  };
}
