// Équipes d'une épreuve par équipes (US-146, US-147) : écriture des événements d'US-145 dans le journal local du PC
// pilote, donc aussi hors ligne ; l'envoi au serveur suit (US-022). Les règles sont celles du domaine.
import {
  cleTexte,
  equipesDe,
  type DonneesEquipeModifiee,
  type EquipeImportee,
  type Epreuve,
  type MembreImporte,
  type Tireur,
  type TireurImporte,
} from '@poule-position/domaine';
import { ecrire, inscrireTireur, type Contexte, type ResultatInscription } from './inscriptions';
import type { Journal } from './journal';

export interface ChampsEquipe {
  nom: string;
  titulaires: string[];
  remplacant: string | null;
}

/** US-146 CA-2 : crée une équipe ; son identifiant et son tirage au sort (US-147 CA-2) sont tirés ici. */
export function creerEquipe(
  journal: Journal,
  epreuveId: string,
  champs: ChampsEquipe,
  contexte: Contexte,
  equipeId: string = crypto.randomUUID(),
  tirage: number = Math.random(),
): Promise<ResultatInscription> {
  return ecrire(
    journal,
    epreuveId,
    { type: 'EquipeCreee', donnees: { equipeId, nom: champs.nom.trim(), ...titulairesEt(champs), tirage } },
    contexte,
  );
}

const titulairesEt = ({ titulaires, remplacant }: Pick<ChampsEquipe, 'titulaires' | 'remplacant'>) => ({
  titulaires: [...titulaires],
  remplacant,
});

/** US-146 CA-3 et CA-4 : n'écrit que les champs changés. */
export function modifierEquipe(
  journal: Journal,
  epreuveId: string,
  avant: ChampsEquipe & { id: string },
  apres: ChampsEquipe,
  contexte: Contexte,
): Promise<ResultatInscription> | null {
  const donnees: DonneesEquipeModifiee = { equipeId: avant.id };
  if (apres.nom.trim() !== avant.nom) donnees.nom = apres.nom.trim();
  if (apres.titulaires.join('|') !== avant.titulaires.join('|')) donnees.titulaires = [...apres.titulaires];
  if (apres.remplacant !== avant.remplacant) donnees.remplacant = apres.remplacant;
  if (Object.keys(donnees).length === 1) return null;
  return ecrire(journal, epreuveId, { type: 'EquipeModifiee', donnees }, contexte);
}

/** US-146 CA-3 : supprime une équipe ; ses tireurs redeviennent sans équipe. */
export function supprimerEquipe(
  journal: Journal,
  epreuveId: string,
  equipeId: string,
  contexte: Contexte,
): Promise<ResultatInscription> {
  return ecrire(journal, epreuveId, { type: 'EquipeSupprimee', donnees: { equipeId } }, contexte);
}

/** US-147 CA-3 : enregistre l'ordre corrigé à la main, ou `null` pour revenir au rang calculé. */
export function rangerEquipes(
  journal: Journal,
  epreuveId: string,
  ordre: string[] | null,
  contexte: Contexte,
): Promise<ResultatInscription> {
  return ecrire(journal, epreuveId, { type: 'RangsEquipesModifies', donnees: { ordre } }, contexte);
}

/** US-147 CA-3 : l'ordre après avoir monté (-1) ou descendu (+1) une équipe ; null si elle est déjà au bord. */
export function deplacer(ordre: readonly string[], equipeId: string, sens: -1 | 1): string[] | null {
  const i = ordre.indexOf(equipeId);
  const j = i + sens;
  if (i < 0 || j < 0 || j >= ordre.length) return null;
  const copie = [...ordre];
  [copie[i], copie[j]] = [copie[j]!, copie[i]!];
  return copie;
}

/** US-146 CA-2 : nom proposé : le club du premier tireur choisi et le premier numéro libre (« Pessac 1 », « Pessac 2 »). */
export function nomPropose(epreuve: Epreuve, premier: Tireur | undefined): string {
  const club = premier?.club.trim();
  if (!club) return '';
  const pris = new Set(equipesDe(epreuve).map(({ nom }) => cleTexte(nom)));
  let numero = 1;
  while (pris.has(cleTexte(`${club} ${numero}`))) numero += 1;
  return `${club} ${numero}`;
}

/** US-156 CA-3 : le compte rendu d'un import d'équipes. */
export interface CompteRenduImportEquipes {
  equipes: number;
  tireurs: number;
  echecs: number;
}

/**
 * US-156 CA-3 : pour chaque équipe importable, inscrit ses tireurs inconnus puis crée l'équipe. Le journal n'a pas
 * d'écriture par lot : une écriture refusée est comptée sans arrêter l'import, et une équipe dont un tireur n'a pas pu
 * être inscrit n'est pas créée.
 */
export async function importerEquipes(
  journal: Journal,
  epreuveId: string,
  equipes: readonly EquipeImportee[],
  contexte: Contexte,
): Promise<CompteRenduImportEquipes> {
  const rendu: CompteRenduImportEquipes = { equipes: 0, tireurs: 0, echecs: 0 };
  /** Un tireur à inscrire est partagé par clé (licence, sinon nom) : on ne l'inscrit qu'une fois. */
  const inscrits = new Map<string, string>();
  const cle = ({ licence, nom, prenom }: TireurImporte) =>
    licence ? `l:${licence}` : `n:${cleTexte(nom)}|${cleTexte(prenom)}`;

  const identifiant = async (membre: MembreImporte): Promise<string | null> => {
    if ('tireurId' in membre) return membre.tireurId;
    const { nouveau } = membre;
    const connu = inscrits.get(cle(nouveau));
    if (connu) return connu;
    const tireurId = crypto.randomUUID();
    const resultat = await inscrireTireur(
      journal,
      epreuveId,
      {
        nom: nouveau.nom,
        prenom: nouveau.prenom,
        club: nouveau.club,
        ...(nouveau.classement !== null && { classement: nouveau.classement }),
        ...(nouveau.licence && { licence: nouveau.licence }),
      },
      contexte,
      tireurId,
    );
    if (!resultat.ok) return null;
    inscrits.set(cle(nouveau), tireurId);
    rendu.tireurs++;
    return tireurId;
  };

  for (const equipe of equipes) {
    const titulaires: string[] = [];
    let complete = true;
    for (const membre of equipe.titulaires) {
      const id = await identifiant(membre);
      if (id) titulaires.push(id);
      else complete = false;
    }
    const remplacant = equipe.remplacant ? await identifiant(equipe.remplacant) : null;
    if (!complete || (equipe.remplacant && !remplacant)) {
      rendu.echecs++;
      continue;
    }
    const resultat = await creerEquipe(journal, epreuveId, { nom: equipe.nom, titulaires, remplacant }, contexte);
    if (resultat.ok) rendu.equipes++;
    else rendu.echecs++;
  }
  return rendu;
}
