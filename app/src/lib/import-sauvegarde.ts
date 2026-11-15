// Import d'une épreuve depuis un fichier `.poule.json` (US-035, ADR-0003) : lecture et contrôle du fichier, résumé à
// confirmer, puis reprise du journal et des fichiers joints sur cet appareil. Tout se fait sans réseau : c'est le cas
// d'usage principal (PC pilote en panne). Le retour en ligne est traité par `synchronisation.reprendreApresImport`.
import { planifierImport, projeter, renumeroterEpreuve, type PlanImport } from '@poule-position/domaine';
import {
  analyserSauvegarde,
  type ErreurSauvegarde,
  type FichierSauvegarde,
  type SauvegardeEpreuve,
} from '@poule-position/protocole';
import type { Journal } from './journal';

/** Au-delà de 50 Mo, le fichier est refusé sans être lu (cas limite d'US-035). */
export const TAILLE_MAX_IMPORT = 50 * 1024 * 1024;

export type ErreurImport =
  | ErreurSauvegarde
  | 'TROP_GROS'
  | 'LECTURE_IMPOSSIBLE'
  /** CA-4 : le fichier est d'un autre club. */
  | 'AUTRE_CLUB'
  | 'DIVERGENT'
  | 'ECRITURE_IMPOSSIBLE';

/** CA-1 : ce que l'organisateur confirme. */
export interface ResumeImport {
  nom: string;
  /** Jour de l'épreuve (`AAAA-MM-JJ`), s'il est connu. */
  date: string | null;
  evenements: number;
  /** Date de l'export, en millisecondes. */
  exporteLe: number;
  /** Ce que l'import fera : créer l'épreuve, prolonger la copie, ne rien changer, ou refuser (journaux divergents). */
  plan: PlanImport['mode'];
  /** Événements que l'import ajoute (tous, pour une épreuve inconnue). */
  ajouts: number;
  fichiers: number;
}

/** Entrée de la lecture : ce que le navigateur donne d'un fichier choisi. */
export interface FichierChoisi {
  size: number;
  text(): Promise<string>;
}

export type ResultatExamen =
  { ok: true; sauvegarde: SauvegardeEpreuve; resume: ResumeImport } | { ok: false; erreur: ErreurImport };

/**
 * CA-1 et CA-4 : lit le fichier et vérifie son format, son journal et son club ; rien n'est modifié. `clubId` est celui du
 * compte connecté.
 */
export async function examinerFichier(
  fichier: FichierChoisi,
  { journal, clubId }: { journal: Pick<Journal, 'evenements'>; clubId: string },
): Promise<ResultatExamen> {
  if (fichier.size > TAILLE_MAX_IMPORT) return { ok: false, erreur: 'TROP_GROS' };
  let brut: unknown;
  try {
    brut = JSON.parse(await fichier.text());
  } catch (erreur) {
    return { ok: false, erreur: erreur instanceof SyntaxError ? 'ILLISIBLE' : 'LECTURE_IMPOSSIBLE' };
  }
  const analyse = analyserSauvegarde(brut);
  if (!analyse.ok) return analyse;
  const { sauvegarde } = analyse;
  if (sauvegarde.clubId !== clubId) return { ok: false, erreur: 'AUTRE_CLUB' };
  // Le journal doit se rejouer sans anomalie : un fichier modifié à la main est refusé avant d'entrer sur l'appareil.
  const projection = projeter(sauvegarde.journal);
  if (projection.anomalie || !projection.epreuve) return { ok: false, erreur: 'JOURNAL_INVALIDE' };
  const plan = planifierImport(await journal.evenements(sauvegarde.epreuveId), sauvegarde.journal);
  return {
    ok: true,
    sauvegarde,
    resume: {
      nom: projection.epreuve.nom,
      date: projection.epreuve.date,
      evenements: sauvegarde.journal.length,
      exporteLe: sauvegarde.exporteLe,
      plan: plan.mode,
      ajouts: plan.mode === 'nouvelle' ? sauvegarde.journal.length : plan.mode === 'prolonge' ? plan.ajouts.length : 0,
      fichiers: sauvegarde.fichiers.length,
    },
  };
}

/** Ce que l'import demande au client des fichiers joints. */
export interface DestinationFichiers {
  garderImportes(fichiers: readonly FichierSauvegarde[], par: string): Promise<void>;
}

export type ResultatImportation =
  | { ok: true; epreuveId: string; mode: 'nouvelle' | 'prolonge' | 'a-jour'; ajoutes: number }
  | { ok: false; erreur: Extract<ErreurImport, 'DIVERGENT' | 'ECRITURE_IMPOSSIBLE'> };

export interface OptionsImportation {
  journal: Pick<Journal, 'importer'>;
  fichiers: DestinationFichiers;
  /** Compte qui importe (inscrit comme auteur des fichiers rejoints à l'épreuve). */
  auteur: string;
  /** `copie` : importer comme une nouvelle épreuve, sous un nouvel identifiant (journaux divergents, ou duplication). */
  comme?: 'meme' | 'copie';
  nouvelIdentifiant?: () => string;
}

/**
 * CA-2, CA-3 et cas limite : reprend le journal et les fichiers du fichier sur cet appareil, qui devient le pilote de
 * l'épreuve. Les fichiers de l'épreuve elle-même suivent son nouvel identifiant quand elle est importée comme copie.
 */
export async function importerSauvegarde(
  sauvegarde: SauvegardeEpreuve,
  { journal, fichiers, auteur, comme = 'meme', nouvelIdentifiant = () => crypto.randomUUID() }: OptionsImportation,
): Promise<ResultatImportation> {
  const epreuveId = comme === 'copie' ? nouvelIdentifiant() : sauvegarde.epreuveId;
  const evenements = comme === 'copie' ? renumeroterEpreuve(sauvegarde.journal, epreuveId) : sauvegarde.journal;
  const resultat = await journal.importer(epreuveId, evenements);
  if (!resultat.ok) return resultat;
  if (resultat.mode !== 'a-jour') {
    await fichiers.garderImportes(
      comme === 'copie'
        ? sauvegarde.fichiers.map((f) =>
            f.proprietaire === 'epreuve' && f.proprietaireId === sauvegarde.epreuveId
              ? { ...f, proprietaireId: epreuveId }
              : f,
          )
        : sauvegarde.fichiers,
      auteur,
    );
  }
  return { ok: true, epreuveId, mode: resultat.mode, ajoutes: resultat.ajoutes };
}
