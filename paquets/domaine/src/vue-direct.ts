// Vue en direct (US-132, ADR-0029) : ce que le pilote publie pour les écrans géants et les spectateurs. Elle est
// calculée ici à partir de la projection du journal ; le serveur la garde et la diffuse sans la lire. Elle est publique :
// des tireurs, seuls le nom affiché (« Prénom N. » si le réglage l'exige, US-032) et le club (ADR-0014). Ni émargement
// individuel (US-160 : seulement le nombre d'émargés), ni licence, ni classement fédéral, ni droits, ni identifiant
// d'appareil.
import type { Arme, Horaires, Sexe, Statut, TypeEpreuve } from './epreuve';
import { membresDe } from './equipes';
import {
  contexteTableau,
  equipesDe,
  parEquipes,
  participantsDe,
  poulesDe,
  qualifiesDirects,
  tableauDe,
  tireursDe,
  type Epreuve,
  type Evenement,
} from './journal';
import { avancementPoules, classementDesPoules, matchsDePoule, resultatsPoule, type MotifRetrait } from './poules';
import { classementFinal, structureTableau, tousLesMatchs } from './tableau';
import { matchTableauVue, type ClassementVue, type MatchVue, type TableauVue } from './vue-saisie';

/** L'étape de l'épreuve, qui décide des pages d'un écran (US-134 CA-2) et de l'onglet ouvert (US-137 CA-1). */
export type EtapeDirect = 'inscriptions' | 'poules' | 'classement' | 'tableau' | 'terminee';

export interface TireurDirect {
  id: string;
  /** Nom affiché : « MARTIN Léa », ou « Léa M. » avec le réglage « Prénom N. ». */
  nom: string;
  club: string;
}

/** US-155 : une équipe de la vue en direct : ses tireurs (titulaires, puis remplaçant), au nom affiché. */
export interface EquipeDirect {
  id: string;
  membres: string[];
}

export interface PouleDirect {
  numero: number;
  piste: number;
  /** Dans l'ordre de la poule. */
  tireurIds: string[];
  matchs: MatchVue[];
  regles: number;
  total: number;
  classement: ClassementPouleDirect[];
}

/** US-142 : une ligne du classement d'une poule, avec ses touches données et reçues (TD, TR). */
export interface ClassementPouleDirect extends ClassementVue {
  touchesDonnees: number;
  touchesRecues: number;
}

/** US-141 : un score récent, pour le bandeau de l'écran géant ; le plus récent d'abord. */
export interface ScoreRecent {
  /** Heure d'enregistrement par le pilote, en millisecondes. */
  date: number;
  /** Numéro de la poule, ou null pour un match du tableau. */
  poule: number | null;
  /** Taille du tour du tableau (16, 8…, 2 ; 0 pour la 3e place), ou null pour une poule. */
  tour: number | null;
  tireurA: string;
  tireurB: string;
  touchesA: number;
  touchesB: number;
}

/** US-141 : nombre de scores récents publiés ; l'écran ne garde ensuite que ceux de ses N dernières minutes. */
export const SCORES_RECENTS_MAX = 40;

/** Une ligne du classement après les poules (US-092). */
export interface LigneClassementDirect {
  tireurId: string;
  /** Rang ; null pour un tireur retiré. */
  rang: number | null;
  exaequo: boolean;
  victoires: number;
  matchs: number;
  indice: number;
  touchesDonnees: number;
  retrait: MotifRetrait | null;
}

/** Une ligne du classement final (US-115). */
export interface LigneFinaleDirect {
  tireurId: string;
  place: number | null;
  exaequo: boolean;
  etat: 'classe' | 'elimine' | 'enLice' | 'exclusion' | 'nonQualifie';
}

/**
 * US-160 : ce que montre le mode Accueil de l'écran géant avant le lancement des poules : horaires, type, nombres
 * d'inscrits et d'émargés (des équipes complètes, par équipes), nom de la compétition et affiche (nom du fichier joint,
 * celui de l'épreuve, sinon de sa compétition, sinon de sa manifestation ; null sans affiche).
 */
export interface AccueilDirect {
  horaires: Horaires;
  typeEpreuve: TypeEpreuve;
  inscrits: number;
  emarges: number;
  competition: string | null;
  affiche: string | null;
}

/** US-160 : ce que le pilote ajoute à la vue, hors du journal (compétition, affiche). */
export interface ComplementDirect {
  competition?: string | null;
  affiche?: string | null;
}

export interface VueDirect {
  epreuveId: string;
  nom: string;
  arme: Arme;
  categorie: string | null;
  sexe: Sexe | null;
  date: string | null;
  statut: Statut;
  /** CA-4 : le serveur ferme les sockets des spectateurs quand elle ne l'est plus. */
  publiee: boolean;
  etape: EtapeDirect;
  tireurs: TireurDirect[];
  poules: PouleDirect[];
  /** Classement après les poules, dès leur lancement ; `definitif` une fois tous les matchs réglés. */
  classement: { definitif: boolean; lignes: LigneClassementDirect[] } | null;
  tableau: TableauVue | null;
  /** Classement final, dès la création du tableau ; définitif quand l'épreuve est terminée. */
  classementFinal: LigneFinaleDirect[] | null;
  /** US-141 : les derniers scores saisis (poules et tableau), le plus récent d'abord. */
  scoresRecents: ScoreRecent[];
  /**
   * US-155 : par équipes, les « tireurs » de la vue sont les équipes (nom de l'équipe, club ou « Mixte ») ; voici leurs
   * tireurs. Absent en individuel.
   */
  equipes?: EquipeDirect[];
  /** US-158 CA-6 : l'épreuve a été terminée avant la fin du tableau. Absent sinon. */
  finAnticipee?: true;
  /** US-160 : le mode Accueil de l'écran géant ; absent d'une vue publiée avant cette US. */
  accueil?: AccueilDirect;
}

/** CA-2 : « MARTIN Léa », ou « Léa M. » quand le public ne voit que l'initiale du nom. */
export function nomAffiche(nom: string, prenom: string, prenomInitiale: boolean): string {
  const nomPropre = nom.trim();
  const prenomPropre = prenom.trim();
  if (!prenomInitiale) return [nomPropre, prenomPropre].filter(Boolean).join(' ');
  const initiale = nomPropre ? `${nomPropre.charAt(0).toLocaleUpperCase('fr')}.` : '';
  return [prenomPropre, initiale].filter(Boolean).join(' ');
}

/**
 * US-141 : les derniers scores du journal, le plus récent d'abord. Un score corrigé remplace l'ancien, à l'heure de la
 * correction ; un forfait, un abandon ou une exclusion n'est pas un score.
 */
export function scoresRecents(
  evenements: readonly Evenement[],
  toursDesMatchs: ReadonlyMap<string, number> = new Map(),
): ScoreRecent[] {
  const parMatch = new Map<string, ScoreRecent>();
  for (const evenement of evenements) {
    if (evenement.type === 'ScorePouleSaisi') {
      const { poule, tireurA, tireurB, touchesA, touchesB } = evenement.donnees;
      const cle = `p${poule}:${[tireurA, tireurB].sort().join('|')}`;
      parMatch.delete(cle);
      parMatch.set(cle, { date: evenement.date, poule, tour: null, tireurA, tireurB, touchesA, touchesB });
    } else if (evenement.type === 'ScoreTableauSaisi') {
      const { match, tireurA, tireurB, touchesA, touchesB } = evenement.donnees;
      const cle = `t${match}`;
      parMatch.delete(cle);
      const tour = toursDesMatchs.get(match) ?? null;
      parMatch.set(cle, { date: evenement.date, poule: null, tour, tireurA, tireurB, touchesA, touchesB });
    }
  }
  return [...parMatch.values()].reverse().slice(0, SCORES_RECENTS_MAX);
}

/** CA-1 : la vue en direct d'une épreuve, telle que le pilote la publie ; ses événements donnent les scores récents. */
export function vueDirect(
  epreuve: Epreuve,
  evenements: readonly Evenement[] = [],
  complement: ComplementDirect = {},
): VueDirect {
  const touches = epreuve.formule.touchesPoules;
  const etat = poulesDe(epreuve);
  const prenomInitiale = epreuve.parametres.prenomInitiale;
  const individuels = tireursDe(epreuve).map(({ id, nom, prenom, club }) => ({
    id,
    nom: nomAffiche(nom, prenom, prenomInitiale),
    club,
  }));
  // US-155 CA-1 : par équipes, les participants sont les équipes (leur nom tel quel), et leurs tireurs au nom affiché.
  const equipes = parEquipes(epreuve);
  const tireurs = equipes ? participantsDe(epreuve).map(({ id, nom, club }) => ({ id, nom, club })) : individuels;
  const nomDuTireur = new Map(individuels.map(({ id, nom }) => [id, nom]));

  const poules: PouleDirect[] = etat.lancees
    ? etat.poules.map((poule) => {
        const { regles, total } = avancementPoules({ ...etat, poules: [poule] }, touches);
        return {
          numero: poule.numero,
          piste: poule.piste,
          tireurIds: [...poule.tireurIds],
          matchs: matchsDePoule(etat, poule, touches).map(
            ({ numero, tireurA, tireurB, touches: score, auTemps, forfait }) => ({
              numero,
              tireurA,
              tireurB,
              touches: score ? [score[0], score[1]] : null,
              auTemps,
              forfait,
            }),
          ),
          regles,
          total,
          classement: resultatsPoule(etat, poule, touches)
            .map(({ tireurId, rang, victoires, matchs, indice, touchesDonnees, touchesRecues, retrait }) => ({
              tireurId,
              rang,
              victoires,
              matchs,
              indice,
              touchesDonnees,
              touchesRecues,
              retrait,
            }))
            .sort((a, b) => a.rang - b.rang),
        };
      })
    : [];
  const poulesFinies = poules.length > 0 && poules.every(({ regles, total }) => regles >= total);

  const structure = structureTableau(tableauDe(epreuve), epreuve.formule.matchTroisieme);
  const tableau: TableauVue | null = structure
    ? {
        touches: contexteTableau(epreuve).touchesTableau,
        taille: structure.taille,
        matchs: tousLesMatchs(structure).map(matchTableauVue),
      }
    : null;

  const termine = epreuve.statut === 'terminee' || epreuve.statut === 'archivee';
  const etape: EtapeDirect = termine
    ? 'terminee'
    : tableau
      ? 'tableau'
      : etat.lancees
        ? poulesFinies
          ? 'classement'
          : 'poules'
        : 'inscriptions';

  return {
    epreuveId: epreuve.id,
    nom: epreuve.nom,
    arme: epreuve.arme,
    categorie: epreuve.categorie,
    sexe: epreuve.sexe,
    date: epreuve.date,
    statut: epreuve.statut,
    publiee: epreuve.publiee,
    etape,
    tireurs,
    poules,
    classement: etat.lancees
      ? {
          definitif: poulesFinies || tableau !== null,
          lignes: classementDesPoules(etat, touches).map(
            ({ tireurId, rangGeneral, exaequo, victoires, matchs, indice, touchesDonnees, retrait }) => ({
              tireurId,
              rang: rangGeneral,
              exaequo,
              victoires,
              matchs,
              indice,
              touchesDonnees,
              retrait,
            }),
          ),
        }
      : null,
    tableau,
    classementFinal: tableau
      ? classementFinal(
          etat,
          tableauDe(epreuve),
          touches,
          epreuve.formule.matchTroisieme,
          qualifiesDirects(epreuve),
        ).map(({ tireurId, place, exaequo, etat: etatFinal }) => ({ tireurId, place, exaequo, etat: etatFinal }))
      : null,
    scoresRecents: scoresRecents(evenements, new Map((tableau?.matchs ?? []).map(({ id, tour }) => [id, tour]))),
    ...(tableauDe(epreuve).finAnticipee && { finAnticipee: true as const }),
    ...(equipes && {
      equipes: equipesDe(epreuve).map((e) => ({
        id: e.id,
        membres: membresDe(e).map((id) => nomDuTireur.get(id) ?? ''),
      })),
    }),
    accueil: accueilDirect(epreuve, complement),
  };
}

/** US-160 : le mode Accueil (horaires, inscrits, émargés). Par équipes, une équipe émarge quand elle est complète. */
export function accueilDirect(epreuve: Epreuve, complement: ComplementDirect = {}): AccueilDirect {
  const participants = participantsDe(epreuve);
  return {
    horaires: { ...epreuve.horaires },
    typeEpreuve: epreuve.typeEpreuve,
    inscrits: participants.length,
    emarges: participants.filter(({ present }) => present).length,
    competition: complement.competition ?? null,
    affiche: complement.affiche ?? null,
  };
}
