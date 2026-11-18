// Inscriptions d'une épreuve (US-082, US-084) : écriture des événements d'US-081 dans le journal local du PC pilote,
// donc aussi hors ligne ; l'envoi au serveur suit (US-022). Les règles sont celles du domaine.
import type {
  AnalyseImport,
  DonneesTireurInscrit,
  DonneesTireurModifie,
  ErreurEvenement,
} from '@poule-position/domaine';
import type { Journal, ErreurJournal } from './journal';

export type ResultatInscription = { ok: true } | { ok: false; erreur: ErreurJournal };

export type Contexte = { clubId?: string | undefined; auteur: string };

export async function ecrire(
  journal: Journal,
  epreuveId: string,
  proposition: Parameters<Journal['enregistrer']>[1],
  { clubId, auteur }: Contexte,
): Promise<ResultatInscription> {
  const { epreuve } = await journal.lire(epreuveId);
  if (!epreuve) return { ok: false, erreur: 'EPREUVE_INCONNUE' };
  const resultat = await journal.enregistrer(epreuveId, proposition, { clubId: clubId ?? epreuve.clubId, auteur });
  return 'projection' in resultat ? { ok: true } : { ok: false, erreur: resultat.erreur };
}

/** US-082 CA-2 : inscrit un tireur ; son identifiant est créé ici. */
export function inscrireTireur(
  journal: Journal,
  epreuveId: string,
  champs: Omit<DonneesTireurInscrit, 'tireurId'>,
  contexte: Contexte,
  tireurId: string = crypto.randomUUID(),
): Promise<ResultatInscription> {
  const donnees: DonneesTireurInscrit = {
    tireurId,
    nom: champs.nom,
    prenom: champs.prenom,
    club: champs.club,
    ...(champs.classement !== undefined && { classement: champs.classement }),
    ...(champs.licence?.trim() && { licence: champs.licence }),
  };
  return ecrire(journal, epreuveId, { type: 'TireurInscrit', donnees }, contexte);
}

/** US-082 CA-6 : modifie les seuls champs changés d'un inscrit. */
export function modifierTireur(
  journal: Journal,
  epreuveId: string,
  donnees: DonneesTireurModifie,
  contexte: Contexte,
): Promise<ResultatInscription> {
  return ecrire(journal, epreuveId, { type: 'TireurModifie', donnees }, contexte);
}

/** US-082 CA-7 : retire un inscrit. */
export function retirerTireur(
  journal: Journal,
  epreuveId: string,
  tireurId: string,
  contexte: Contexte,
): Promise<ResultatInscription> {
  return ecrire(journal, epreuveId, { type: 'TireurRetire', donnees: { tireurId } }, contexte);
}

/** US-084 CA-2 : pointe un inscrit présent (avec l'heure `HH:MM`) ou le remet absent. */
export function pointerTireur(
  journal: Journal,
  epreuveId: string,
  tireurId: string,
  present: boolean,
  contexte: Contexte,
  heure: string = new Date().toTimeString().slice(0, 5),
): Promise<ResultatInscription> {
  return ecrire(
    journal,
    epreuveId,
    { type: 'PresenceModifiee', donnees: present ? { tireurId, present, heure } : { tireurId, present } },
    contexte,
  );
}

/** Les erreurs d'écriture que l'écran d'inscription traduit (les autres ont un message générique). */
export type ErreurInscriptionConnue = Extract<
  ErreurEvenement,
  'TIREUR_NOM_VIDE' | 'TIREUR_PRENOM_VIDE' | 'TIREUR_CHAMP_TROP_LONG' | 'CLASSEMENT_INVALIDE' | 'INSCRIPTIONS_CLOSES'
>;

/** US-083 CA-3 : le compte rendu d'un import. */
export interface CompteRenduImport {
  inscrits: number;
  misAJour: number;
  echecs: number;
}

/**
 * US-083 CA-3 : inscrit les nouveaux et les homonymes cochés, met à jour (club, classement) les déjà inscrits de même
 * licence qui ont changé ; une écriture refusée est comptée sans arrêter l'import.
 */
export async function importerTireurs(
  journal: Journal,
  epreuveId: string,
  analyse: Pick<AnalyseImport, 'nouveaux' | 'dejaInscrits' | 'homonymes'>,
  homonymesCoches: ReadonlySet<number>,
  contexte: Contexte,
): Promise<CompteRenduImport> {
  const rendu: CompteRenduImport = { inscrits: 0, misAJour: 0, echecs: 0 };
  const aInscrire = [
    ...analyse.nouveaux,
    ...analyse.homonymes.filter((_, rang) => homonymesCoches.has(rang)).map(({ importe }) => importe),
  ];
  for (const { nom, prenom, club, classement, licence } of aInscrire) {
    const resultat = await inscrireTireur(
      journal,
      epreuveId,
      { nom, prenom, club, ...(classement !== null && { classement }), ...(licence && { licence }) },
      contexte,
    );
    if (resultat.ok) rendu.inscrits++;
    else rendu.echecs++;
  }
  for (const { inscrit, changes } of analyse.dejaInscrits) {
    if (Object.keys(changes).length === 0) continue;
    const resultat = await modifierTireur(journal, epreuveId, { tireurId: inscrit.id, ...changes }, contexte);
    if (resultat.ok) rendu.misAJour++;
    else rendu.echecs++;
  }
  return rendu;
}
