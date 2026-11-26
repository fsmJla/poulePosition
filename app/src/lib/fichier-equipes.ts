// Lecture du CSV d'équipes (US-156), sur l'appareil (aucun envoi) : décodage UTF-8 ou, à défaut, ISO-8859-1 (export
// d'Excel), puis lecture par le domaine. Les règles du format sont dans `paquets/domaine`.
import { lireCsvEquipes, type LigneEquipeFichier } from '@poule-position/domaine';

/** CA-5 : au-delà, le fichier est refusé. */
export const TAILLE_MAX_FICHIER_EQUIPES = 5 * 1024 * 1024;

export type ErreurFichierEquipes = 'TROP_GROS' | 'COLONNES_MANQUANTES' | 'AUCUNE_EQUIPE';

/** CA-1 : UTF-8 (avec ou sans BOM) ; si les octets n'en sont pas, ISO-8859-1. */
export function decoderCsv(octets: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(octets);
  } catch {
    return new TextDecoder('windows-1252').decode(octets);
  }
}

/** CA-1 et CA-5 : lit le fichier ; refuse un fichier trop gros, sans les colonnes attendues ou sans équipe. */
export function lireFichierEquipes(
  octets: Uint8Array,
): { ok: true; lignes: LigneEquipeFichier[] } | { ok: false; erreur: ErreurFichierEquipes; manquantes?: string[] } {
  if (octets.byteLength > TAILLE_MAX_FICHIER_EQUIPES) return { ok: false, erreur: 'TROP_GROS' };
  const lu = lireCsvEquipes(decoderCsv(octets));
  if (lu.ok) return lu;
  return lu.erreur === 'COLONNES_MANQUANTES'
    ? { ok: false, erreur: lu.erreur, manquantes: lu.manquantes }
    : { ok: false, erreur: lu.erreur };
}
