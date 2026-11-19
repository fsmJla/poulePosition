// Vue de saisie (US-095, ADR-0005) : ce que le pilote publie pour les smartphones des arbitres et des tireurs. Elle est
// calculée ici, à partir de la projection du journal ; le serveur la garde et la diffuse sans la lire ni la recalculer.
// ADR-0014 : des tireurs, seuls le nom, le prénom, le club et la poule ; le réglage « Prénom N. » vise le public, pas
// les arbitres ni les tireurs de l'épreuve.
import type { Arme, CorrectionScore, Sexe } from './epreuve';
import { poulesDe, tireursDe, type Epreuve } from './journal';
import { avancementPoules, matchsDePoule, resultatsPoule, type MotifRetrait } from './poules';

export interface TireurVue {
  id: string;
  nom: string;
  prenom: string;
  club: string;
}

/** Un match d'une poule, dans l'ordre officiel ; `touches` dans l'ordre de `tireurA` puis `tireurB`. */
export interface MatchVue {
  numero: number;
  tireurA: string;
  tireurB: string;
  touches: [number, number] | null;
  auTemps: boolean;
  forfait: boolean;
}

/** Une ligne du classement provisoire d'une poule (US-092). */
export interface ClassementVue {
  tireurId: string;
  rang: number;
  victoires: number;
  matchs: number;
  indice: number;
  retrait: MotifRetrait | null;
}

export interface PouleVue {
  numero: number;
  piste: number;
  /** Dans l'ordre de la poule (le numéro d'ordre est l'indice + 1). */
  tireurs: TireurVue[];
  matchs: MatchVue[];
  /** Avancement : matchs réglés (scores et forfaits) sur matchs prévus (« 9 matchs sur 15 »). */
  regles: number;
  total: number;
  classement: ClassementVue[];
}

/** Droits en vigueur pour les smartphones (US-032, ADR-0007) ; le pilote les applique aussi à la réception. */
export interface DroitsVue {
  arbitreSaisitScores: boolean;
  tireurSaisitPoule: boolean;
  tireurSaisitTableau: boolean;
  correctionScore: CorrectionScore;
}

export interface VueSaisie {
  epreuveId: string;
  nom: string;
  arme: Arme;
  categorie: string | null;
  sexe: Sexe | null;
  date: string | null;
  /** Nom de la compétition de l'épreuve, s'il est connu du pilote. */
  competition: string | null;
  /** Touches d'un match de poule (formule, US-028). */
  touches: number;
  droits: DroitsVue;
  /** Faux avant le lancement des poules : la vue n'a alors aucune poule. */
  lancees: boolean;
  poules: PouleVue[];
}

/** CA-1 : la vue de saisie d'une épreuve, telle que le pilote la publie. */
export function vueSaisie(epreuve: Epreuve, competition: string | null = null): VueSaisie {
  const touches = epreuve.formule.touchesPoules;
  const etat = poulesDe(epreuve);
  const parId = new Map(tireursDe(epreuve).map((tireur) => [tireur.id, tireur]));
  const { arbitreSaisitScores, tireurSaisitPoule, tireurSaisitTableau, correctionScore } = epreuve.parametres;
  const poules: PouleVue[] = etat.lancees
    ? etat.poules.map((poule) => {
        const matchs = matchsDePoule(etat, poule, touches);
        const { regles, total } = avancementPoules({ ...etat, poules: [poule] }, touches);
        return {
          numero: poule.numero,
          piste: poule.piste,
          tireurs: poule.tireurIds.map((id) => {
            const tireur = parId.get(id);
            return { id, nom: tireur?.nom ?? '', prenom: tireur?.prenom ?? '', club: tireur?.club ?? '' };
          }),
          matchs: matchs.map(({ numero, tireurA, tireurB, touches: score, auTemps, forfait }) => ({
            numero,
            tireurA,
            tireurB,
            touches: score ? [score[0], score[1]] : null,
            auTemps,
            forfait,
          })),
          regles,
          total,
          classement: resultatsPoule(etat, poule, touches)
            .map(({ tireurId, rang, victoires, matchs: joues, indice, retrait }) => ({
              tireurId,
              rang,
              victoires,
              matchs: joues,
              indice,
              retrait,
            }))
            .sort((a, b) => a.rang - b.rang),
        };
      })
    : [];
  return {
    epreuveId: epreuve.id,
    nom: epreuve.nom,
    arme: epreuve.arme,
    categorie: epreuve.categorie,
    sexe: epreuve.sexe,
    date: epreuve.date,
    competition,
    touches,
    droits: { arbitreSaisitScores, tireurSaisitPoule, tireurSaisitTableau, correctionScore },
    lancees: etat.lancees,
    poules,
  };
}
