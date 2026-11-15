// Export d'une épreuve dans un fichier (US-034, ADR-0003) : le journal local, la description de sa compétition et de sa
// manifestation et ses fichiers joints (héritage compris) en base64. Tout vient de l'appareil : l'export marche sans
// réseau ; seuls les fichiers jamais gardés ici (épreuve jamais ouverte en ligne) manquent, et l'export le dit.
import {
  FORMAT_SAUVEGARDE,
  nomFichierSauvegarde,
  VERSION_SAUVEGARDE,
  type FichierJoint,
  type FichierSauvegarde,
  type SauvegardeEpreuve,
} from '@poule-position/protocole';
import type { ProprietaireFichier, Rattachement } from '@poule-position/domaine';
import type { HierarchieClub } from './fil-ariane';
import type { Journal } from './journal';

/** Ce que l'export demande au client des fichiers joints. */
export interface SourceFichiers {
  /** Description de tous les fichiers du club : à jour si le serveur répond, sinon la dernière copie de l'appareil. */
  decrire(): Promise<readonly FichierJoint[]>;
  /** Contenu gardé sur l'appareil ou, à défaut et en ligne, téléchargé ; null s'il n'est pas disponible. */
  contenu(nom: string): Promise<Blob | null>;
}

export interface EntreesExport {
  epreuveId: string;
  nom: string;
  /** Compétition de l'épreuve, d'après sa projection (US-045) ; null si elle n'en a plus. */
  rattachement: Rattachement | null;
  journal: Pick<Journal, 'evenements'>;
  hierarchie: HierarchieClub;
  fichiers: SourceFichiers;
  maintenant?: () => Date;
}

export type ResultatPreparation =
  | {
      ok: true;
      nomFichier: string;
      contenu: string;
      evenements: number;
      /** Fichiers décrits mais dont le contenu n'est pas disponible sur cet appareil : absents du fichier. */
      fichiersManquants: number;
      fichiersInclus: number;
    }
  | { ok: false; erreur: 'JOURNAL_ABSENT' };

/** Base64 d'un contenu binaire, par morceaux pour ne pas dépasser la pile avec un fichier de plusieurs Mo. */
export async function enBase64(contenu: Blob): Promise<string> {
  const octets = new Uint8Array(await contenu.arrayBuffer());
  let texte = '';
  for (let i = 0; i < octets.length; i += 0x8000) {
    texte += String.fromCharCode(...octets.subarray(i, i + 0x8000));
  }
  return btoa(texte);
}

/**
 * CA-1 à CA-3 : construit le fichier de sauvegarde d'une épreuve. Le journal est celui de l'appareil (celui qui fait foi
 * s'il en est le pilote, sa copie sinon).
 */
export async function preparerExport({
  epreuveId,
  nom,
  rattachement,
  journal,
  hierarchie,
  fichiers,
  maintenant = () => new Date(),
}: EntreesExport): Promise<ResultatPreparation> {
  const evenements = await journal.evenements(epreuveId);
  const premier = evenements[0];
  if (!premier) return { ok: false, erreur: 'JOURNAL_ABSENT' };

  const competition = hierarchie.competitions.find(({ id }) => id === rattachement?.competitionId) ?? null;
  const manifestation = hierarchie.manifestations.find(({ id }) => id === competition?.manifestationId) ?? null;

  const proprietaires = new Map<ProprietaireFichier, string>([['epreuve', epreuveId]]);
  if (competition) proprietaires.set('competition', competition.id);
  if (manifestation) proprietaires.set('manifestation', manifestation.id);
  const concernes = (await fichiers.decrire()).filter(
    (fichier) => proprietaires.get(fichier.proprietaire) === fichier.proprietaireId,
  );

  const inclus: FichierSauvegarde[] = [];
  for (const { proprietaire, proprietaireId, sorte, nom: nomFichier, type, taille } of concernes) {
    const contenu = await fichiers.contenu(nomFichier);
    if (!contenu) continue;
    inclus.push({
      proprietaire,
      proprietaireId,
      sorte,
      nom: nomFichier,
      type,
      taille,
      contenu: await enBase64(contenu),
    });
  }

  const date = maintenant();
  const sauvegarde: SauvegardeEpreuve = {
    format: FORMAT_SAUVEGARDE,
    version: VERSION_SAUVEGARDE,
    exporteLe: date.getTime(),
    epreuveId,
    clubId: premier.clubId,
    journal: evenements,
    competition: competition ? { id: competition.id, nom: competition.nom, arme: competition.arme ?? null } : null,
    manifestation:
      manifestation?.debut && manifestation.fin
        ? {
            id: manifestation.id,
            nom: manifestation.nom,
            debut: manifestation.debut,
            fin: manifestation.fin,
            lieu: manifestation.lieu ?? null,
          }
        : null,
    fichiers: inclus,
  };
  return {
    ok: true,
    nomFichier: nomFichierSauvegarde(nom, date),
    contenu: JSON.stringify(sauvegarde),
    evenements: evenements.length,
    fichiersInclus: inclus.length,
    fichiersManquants: concernes.length - inclus.length,
  };
}

/** Ce que l'API File System Access (Chrome, Edge) ajoute à `window` ; absente ailleurs. */
interface FenetreEnregistrement {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{ createWritable(): Promise<{ write(donnees: Blob): Promise<void>; close(): Promise<void> }> }>;
}

export type ResultatEnregistrement =
  { ok: true; mode: 'choisi' | 'telecharge' } | { ok: false; erreur: 'ANNULE' | 'ECHEC' };

/**
 * CA-4 : propose de choisir l'emplacement (Chrome, Edge) ; ailleurs, ou si l'API est refusée, le fichier est téléchargé
 * (ADR-0003). Fermer le sélecteur n'est pas une erreur : rien n'est enregistré.
 */
export async function enregistrerFichier(
  nomFichier: string,
  contenu: string,
  fenetre: FenetreEnregistrement = window as unknown as FenetreEnregistrement,
): Promise<ResultatEnregistrement> {
  const blob = new Blob([contenu], { type: 'application/json' });
  if (fenetre.showSaveFilePicker) {
    try {
      const poignee = await fenetre.showSaveFilePicker({
        suggestedName: nomFichier,
        types: [{ description: 'Sauvegarde poulePosition', accept: { 'application/json': ['.json'] } }],
      });
      const flux = await poignee.createWritable();
      await flux.write(blob);
      await flux.close();
      return { ok: true, mode: 'choisi' };
    } catch (erreur) {
      if (erreur instanceof DOMException && erreur.name === 'AbortError') return { ok: false, erreur: 'ANNULE' };
      // Sélecteur indisponible (iframe, politique) : on retombe sur le téléchargement.
    }
  }
  try {
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(blob);
    lien.download = nomFichier;
    lien.click();
    setTimeout(() => URL.revokeObjectURL(lien.href), 10_000);
    return { ok: true, mode: 'telecharge' };
  } catch {
    return { ok: false, erreur: 'ECHEC' };
  }
}
