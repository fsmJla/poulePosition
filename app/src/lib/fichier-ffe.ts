// Lecture du fichier d'inscription de la Fédération (US-083) : XML `BaseCompetitionIndividuelle` d'Engarde et de
// BellePoule, lu sur l'appareil (aucun envoi). On décode selon l'encodage déclaré (ISO-8859-1 ou UTF-8), on vérifie que
// c'est un fichier individuel, puis on rend les attributs de chaque `<Tireur>` ; le classement est fait par le domaine.
import type { TireurFichier } from '@poule-position/domaine';

/** CA-5 : au-delà, le fichier est refusé. */
export const TAILLE_MAX_FICHIER_FFE = 5 * 1024 * 1024;

export type ErreurFichierFfe = 'TROP_GROS' | 'PAS_INDIVIDUEL' | 'AUCUN_TIREUR';

export interface FichierFfe {
  tireurs: TireurFichier[];
  /** Attributs de la compétition du fichier (`Arme`, `Sexe`, `Categorie`…), pour l'avertissement de l'aperçu. */
  competition: Record<string, string>;
}

const ATTRIBUTS_TIREUR = ['Nom', 'Prenom', 'Sexe', 'Licence', 'Club', 'Classement'] as const;

/** Décode les octets selon l'encodage déclaré dans le prologue XML (UTF-8 par défaut). */
export function decoder(octets: Uint8Array): string {
  const debut = new TextDecoder('latin1').decode(octets.subarray(0, 200));
  const declare = /encoding\s*=\s*["']([^"']+)["']/i.exec(debut)?.[1]?.toLowerCase();
  const encodage = declare && /^(iso-8859-1|latin1|windows-1252|cp1252)$/.test(declare) ? 'windows-1252' : 'utf-8';
  return new TextDecoder(encodage).decode(octets);
}

/** Remplace les entités XML (prédéfinies et numériques). */
function entites(texte: string): string {
  return texte
    .replace(/&#x([0-9a-f]+);/gi, (_, hexa: string) => String.fromCodePoint(parseInt(hexa, 16)))
    .replace(/&#(\d+);/g, (_, decimal: string) => String.fromCodePoint(Number(decimal)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/** Les attributs `nom="valeur"` (ou entre apostrophes) d'une balise. */
function attributs(balise: string): Record<string, string> {
  const lus: Record<string, string> = {};
  for (const [, nom, , valeur] of balise.matchAll(/([A-Za-z_][\w.-]*)\s*=\s*(["'])(.*?)\2/gs)) {
    if (nom !== undefined && valeur !== undefined) lus[nom] = entites(valeur);
  }
  return lus;
}

/** CA-1 et CA-5 : lit le fichier ; refuse un fichier trop gros, par équipes, d'un autre format ou sans tireur. */
export function lireFichierFfe(
  octets: Uint8Array,
): { ok: true; fichier: FichierFfe } | { ok: false; erreur: ErreurFichierFfe } {
  if (octets.byteLength > TAILLE_MAX_FICHIER_FFE) return { ok: false, erreur: 'TROP_GROS' };
  const texte = decoder(octets).replace(/<!--[\s\S]*?-->/g, '');
  const racine = /<BaseCompetitionIndividuelle\b([^>]*)>/.exec(texte);
  if (!racine) return { ok: false, erreur: 'PAS_INDIVIDUEL' };
  const tireurs: TireurFichier[] = [];
  for (const [, contenu] of texte.matchAll(/<Tireur\b([^>]*?)\/?>/g)) {
    const lus = attributs(contenu ?? '');
    const tireur: TireurFichier = {};
    for (const nom of ATTRIBUTS_TIREUR) if (lus[nom] !== undefined) tireur[nom] = lus[nom];
    tireurs.push(tireur);
  }
  if (tireurs.length === 0) return { ok: false, erreur: 'AUCUN_TIREUR' };
  return { ok: true, fichier: { tireurs, competition: attributs(racine[1] ?? '') } };
}
