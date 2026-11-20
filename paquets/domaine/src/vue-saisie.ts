// Vue de saisie (US-095, ADR-0005) : ce que le pilote publie pour les smartphones des arbitres et des tireurs. Elle est
// calculée ici, à partir de la projection du journal ; le serveur la garde et la diffuse sans la lire ni la recalculer.
// ADR-0014 : des tireurs, seuls le nom, le prénom, le club et la poule ; le réglage « Prénom N. » vise le public, pas
// les arbitres ni les tireurs de l'épreuve.
import type { Arme, CorrectionScore, Sexe } from './epreuve';
import { poulesDe, tableauDe, tireursDe, type Epreuve } from './journal';
import { avancementPoules, matchsDePoule, resultatsPoule, type MotifRetrait } from './poules';
import { structureTableau, tousLesMatchs, type EtatMatch, type MatchTableau } from './tableau';

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

/** US-112 CA-6 : une place d'un match du tableau : le tireur et son rang, ou le match dont il sortira. */
export interface PlaceVue {
  tireurId: string | null;
  rang: number | null;
  provenance: string | null;
}

/** US-112 CA-6 : un match du tableau, tel que les smartphones le voient (US-106). */
export interface MatchTableauVue {
  id: string;
  /** Taille du tour (16, 8…, 2 pour la finale), 0 pour la 3e place. */
  tour: number;
  numero: number;
  haut: PlaceVue;
  bas: PlaceVue;
  etat: EtatMatch;
  /** Touches du haut et du bas. */
  touches: [number, number] | null;
  vainqueur: string | null;
  parPriorite: boolean;
  piste: number | null;
  enPiste: boolean;
  /** Heure d'appel effective, en millisecondes. */
  appeleA: number | null;
}

/** US-112 CA-6 : le tableau, une fois créé. */
export interface TableauVue {
  /** Touches d'un match du tableau (formule, US-028). */
  touches: number;
  taille: number;
  matchs: MatchTableauVue[];
}

const matchVue = (m: MatchTableau): MatchTableauVue => ({
  id: m.id,
  tour: m.tour,
  numero: m.numero,
  haut: { tireurId: m.haut.tireurId, rang: m.haut.rang, provenance: m.haut.provenance },
  bas: { tireurId: m.bas.tireurId, rang: m.bas.rang, provenance: m.bas.provenance },
  etat: m.etat,
  touches: m.touches ? [m.touches[0], m.touches[1]] : null,
  vainqueur: m.vainqueur,
  parPriorite: m.parPriorite,
  piste: m.piste,
  enPiste: m.enPiste,
  appeleA: m.appeleA,
});

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
  /** US-112 CA-6 : le tableau (null avant sa création) ; absent d'une vue publiée avant US-112. */
  tableau?: TableauVue | null;
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
    tableau: tableauVue(epreuve),
  };
}

/** US-112 CA-6 : le tableau de l'épreuve pour les smartphones, ou null. */
function tableauVue(epreuve: Epreuve): TableauVue | null {
  const structure = structureTableau(tableauDe(epreuve), epreuve.formule.matchTroisieme);
  if (!structure) return null;
  return {
    touches: epreuve.formule.touchesTableau,
    taille: structure.taille,
    matchs: tousLesMatchs(structure).map(matchVue),
  };
}

/**
 * US-106 CA-1 : les matchs du tableau d'une piste (arbitre) : ceux appelés sur la piste, en piste d'abord, puis à tirer,
 * puis réglés ; les matchs en attente d'un tireur ne se saisissent pas.
 */
export function matchsTableauDeLaPiste(vue: VueSaisie | null, piste: number): MatchTableauVue[] {
  const matchs = (vue?.tableau?.matchs ?? []).filter((m) => m.piste === piste && m.etat !== 'exempt');
  const rang = (m: MatchTableauVue) => (m.etat === 'aTirer' ? (m.enPiste ? 0 : 1) : 2);
  return matchs.sort((a, b) => rang(a) - rang(b) || (a.appeleA ?? 0) - (b.appeleA ?? 0));
}

/** US-106 CA-1 : les matchs du tableau d'un tireur, à tirer d'abord, du plus récent tour au premier. */
export function matchsTableauDuTireur(vue: VueSaisie | null, tireurId: string): MatchTableauVue[] {
  const matchs = (vue?.tableau?.matchs ?? []).filter(
    (m) => m.etat !== 'exempt' && (m.haut.tireurId === tireurId || m.bas.tireurId === tireurId),
  );
  const rang = (m: MatchTableauVue) => (m.etat === 'aTirer' ? 0 : 1);
  return matchs.sort((a, b) => rang(a) - rang(b) || (a.tour || 1) - (b.tour || 1));
}

/** US-098 : un match de la piste, avec sa poule. */
export interface MatchDeLaPiste extends MatchVue {
  poule: number;
}

/** US-098 : ce que l'arbitre voit de sa piste (planche 13). */
export interface MatchsDeLaPiste {
  /** Poule en cours sur la piste : la première qui a encore un match à tirer, sinon la dernière. */
  poule: number | null;
  /** Toutes les poules de la piste, dans l'ordre. */
  poules: number[];
  /** Avancement de la poule en cours. */
  regles: number;
  total: number;
  /** CA-2 : le premier match sans score, dans l'ordre des poules puis l'ordre officiel ; null si tout est saisi. */
  maintenant: MatchDeLaPiste | null;
  /** CA-3 : les deux matchs suivants à tirer. */
  ensuite: MatchDeLaPiste[];
  /** CA-3 : les matchs réglés (scores et forfaits), du plus avancé dans l'ordre au moins avancé. */
  termines: MatchDeLaPiste[];
}

/** US-098 CA-1 à CA-4 et CA-7 : les matchs de la piste d'un arbitre, tirés de la vue de saisie. */
export function matchsDeLaPiste(vue: VueSaisie | null, piste: number): MatchsDeLaPiste {
  const poules = (vue?.poules ?? []).filter((p) => p.piste === piste).sort((a, b) => a.numero - b.numero);
  const tous = poules.flatMap((p) => p.matchs.map((match) => ({ ...match, poule: p.numero })));
  const aTirer = tous.filter(({ touches }) => touches === null);
  const enCours = poules.find(({ regles, total }) => regles < total) ?? poules.at(-1) ?? null;
  return {
    poule: enCours?.numero ?? null,
    poules: poules.map(({ numero }) => numero),
    regles: enCours?.regles ?? 0,
    total: enCours?.total ?? 0,
    maintenant: aTirer[0] ?? null,
    ensuite: aTirer.slice(1, 3),
    termines: tous.filter(({ touches }) => touches !== null).reverse(),
  };
}

/** US-103 : un tireur de la vue, avec sa poule et sa piste. */
export interface TireurDeLaVue extends TireurVue {
  poule: number;
  piste: number;
}

/** Texte sans accents ni majuscules, pour chercher un nom. */
const sansAccents = (texte: string) =>
  texte
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

/** US-103 CA-2 : les tireurs des poules dont le nom ou le prénom commence par ces lettres, triés par nom. */
export function chercherTireurs(vue: VueSaisie | null, texte: string): TireurDeLaVue[] {
  const cherche = sansAccents(texte);
  const tous = (vue?.poules ?? []).flatMap(({ numero, piste, tireurs }) =>
    tireurs.map((tireur) => ({ ...tireur, poule: numero, piste })),
  );
  return tous
    .filter(
      ({ nom, prenom }) => !cherche || sansAccents(nom).startsWith(cherche) || sansAccents(prenom).startsWith(cherche),
    )
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr'));
}

/** US-103 et US-104 : le tireur choisi sur ce téléphone, tel que la vue le connaît, ou null. */
export function tireurDeLaVue(vue: VueSaisie | null, tireurId: string | null): TireurDeLaVue | null {
  if (!tireurId) return null;
  for (const { numero, piste, tireurs } of vue?.poules ?? []) {
    const tireur = tireurs.find(({ id }) => id === tireurId);
    if (tireur) return { ...tireur, poule: numero, piste };
  }
  return null;
}

/** US-104 : un match terminé du tireur, vu de son côté. */
export interface MatchTermineDuTireur {
  numero: number;
  adversaire: string;
  victoire: boolean;
  /** Touches du tireur, puis de l'adversaire. */
  score: [number, number];
  forfait: boolean;
}

/** US-104 : ce que le tireur voit de sa poule (planches 18 et 18 bis). */
export interface MatchsDuTireur {
  poule: PouleVue;
  /** CA-2 : son prochain match à tirer, ou null. */
  prochain: MatchDeLaPiste | null;
  /** Vrai si son prochain match est le premier de la poule qui reste à tirer (« C'est à vous »). */
  aVous: boolean;
  /** Matchs à tirer de la poule avant son prochain (« dans environ N matchs »). */
  avant: number;
  /** Le match qui suit le prochain, pour lui. */
  ensuite: MatchDeLaPiste | null;
  /** Matchs à tirer avant celui qui suit (pour « Ensuite… dans environ N matchs »). */
  avantEnsuite: number;
  termines: MatchTermineDuTireur[];
  /** Planche 18 bis : les matchs à tirer de la poule où il ne tire pas. */
  autres: MatchDeLaPiste[];
  retrait: MotifRetrait | null;
}

/** US-104 CA-2 à CA-5 : les matchs d'un tireur dans sa poule, tirés de la vue de saisie. */
export function matchsDuTireur(vue: VueSaisie | null, tireurId: string): MatchsDuTireur | null {
  const poule = vue?.poules.find(({ tireurs }) => tireurs.some(({ id }) => id === tireurId));
  if (!poule) return null;
  const avecPoule = poule.matchs.map((m) => ({ ...m, poule: poule.numero }));
  const aTirer = avecPoule.filter(({ touches }) => touches === null);
  const miens = aTirer.filter(({ tireurA, tireurB }) => tireurA === tireurId || tireurB === tireurId);
  const prochain = miens[0] ?? null;
  const ensuite = miens[1] ?? null;
  const rang = (m: MatchDeLaPiste | null) => (m ? aTirer.indexOf(m) : 0);
  const noms = new Map(poule.tireurs.map((t) => [t.id, `${t.nom} ${t.prenom}`]));
  return {
    poule,
    prochain,
    aVous: prochain !== null && aTirer[0] === prochain,
    avant: rang(prochain),
    ensuite,
    avantEnsuite: rang(ensuite),
    termines: avecPoule
      .filter(({ touches, tireurA, tireurB }) => touches !== null && (tireurA === tireurId || tireurB === tireurId))
      .map(({ numero, tireurA, tireurB, touches, forfait }) => {
        const moiA = tireurA === tireurId;
        const [moi, lui] = moiA ? touches! : [touches![1], touches![0]];
        return {
          numero,
          adversaire: noms.get(moiA ? tireurB : tireurA) ?? '',
          victoire: moi > lui,
          score: [moi, lui],
          forfait,
        };
      }),
    autres: aTirer.filter(({ tireurA, tireurB }) => tireurA !== tireurId && tireurB !== tireurId),
    retrait: poule.classement.find((c) => c.tireurId === tireurId)?.retrait ?? null,
  };
}
