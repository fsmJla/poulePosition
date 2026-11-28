// Écran géant (US-134, planches 31 à 35) : les pages à faire défiler, tirées des vues en direct des épreuves cochées
// (US-132). Logique pure : l'écran reçoit les vues et ses réglages, ce module dit quoi afficher et dans quel ordre.
import type { AccueilDirect, MatchTableauVue, PouleDirect, ScoreRecent, VueDirect } from '@poule-position/domaine';
import type { EcranPublic, VueEcran } from '@poule-position/protocole';

/** Une piste sur la page « Appel des matchs » (planche 31). */
export interface CartePiste {
  piste: number;
  etat: 'enPiste' | 'aTirer' | 'libre';
  /** « Poule 1 · match 7 sur 15 », « Tableau de 16 », « Poule 5 terminée ». */
  contexte: { poule: number; numero: number; total: number } | { tour: number } | { pouleTerminee: number } | null;
  tireurs: [string, string] | null;
  puis: [string, string] | null;
}

export type PageEcran =
  | { type: 'appel'; epreuveId: string; pistes: CartePiste[] }
  | { type: 'poules'; epreuveId: string; poules: PouleDirect[] }
  | {
      type: 'classement';
      epreuveId: string;
      final: boolean;
      definitif: boolean;
      lignes: {
        rang: number | null;
        tireurId: string;
        victoires: number;
        matchs: number;
        indice: number;
        touches: number;
      }[];
    }
  | { type: 'tableau'; epreuveId: string; arbre: ArbreTableau }
  | { type: 'podium'; epreuveId: string }
  /** US-160 : le mode Accueil, avant le lancement des poules. */
  | { type: 'accueil'; epreuveId: string }
  | { type: 'attente' };

/**
 * US-143 : le tableau en arbre symétrique. Chaque côté liste ses tours, du premier affiché aux demi-finales ; la moitié
 * haute du tableau est à gauche, la basse à droite (en miroir). Pour un grand tableau, une page montre une seule moitié
 * (`moitie`), jusqu'au tableau de 16, sans finale.
 */
export interface ArbreTableau {
  /** Tailles des tours affichés de chaque côté (32, 16, 8, 4). */
  tours: number[];
  gauche: MatchTableauVue[][];
  droite: MatchTableauVue[][];
  finale: MatchTableauVue | null;
  troisieme: MatchTableauVue | null;
  moitie: 'haute' | 'basse' | null;
}

/** Nombres d'éléments par page (planches 31 à 34 ; US-142 : quatre poules). */
export const PISTES_PAR_PAGE = 6;
export const POULES_PAR_PAGE = 4;
/** US-143 CA-3 : au-delà, une page par moitié avant l'arbre complet. */
export const TAILLE_ARBRE_COMPLET = 32;
/** Retour du 2026-11-28 : deux colonnes de 12 lignes par page de classement (12 en tout auparavant). */
export const LIGNES_PAR_COLONNE = 12;
export const LIGNES_PAR_PAGE = 2 * LIGNES_PAR_COLONNE;

const parTranches = <T>(liste: readonly T[], taille: number): T[][] => {
  const tranches: T[][] = [];
  for (let i = 0; i < liste.length; i += taille) tranches.push(liste.slice(i, i + taille));
  return tranches;
};

/** Le premier match encore à tirer d'une poule, puis le suivant. */
function matchsAVenir(poule: PouleDirect) {
  const restants = poule.matchs.filter(({ touches, forfait }) => touches === null && !forfait);
  return { courant: restants[0] ?? null, suivant: restants[1] ?? null };
}

/** CA-2 (planche 31) : une carte par piste, d'après les poules en cours ou les matchs appelés du tableau. */
export function pistesDeLAppel(vue: VueDirect): CartePiste[] {
  const nom = new Map(vue.tireurs.map(({ id, nom: n }) => [id, n]));
  const paire = (a: string | null, b: string | null): [string, string] => [
    nom.get(a ?? '') ?? '—',
    nom.get(b ?? '') ?? '—',
  ];
  if (vue.etape === 'tableau' && vue.tableau) {
    const appeles = vue.tableau.matchs
      .filter((m) => m.piste !== null && m.etat === 'aTirer')
      .sort((a, b) => Number(b.enPiste) - Number(a.enPiste) || (a.appeleA ?? 0) - (b.appeleA ?? 0));
    const pistes = [...new Set(appeles.map((m) => m.piste as number))].sort((a, b) => a - b);
    return pistes.map((piste) => {
      const surPiste = appeles.filter((m) => m.piste === piste);
      const [premier, second] = surPiste;
      return {
        piste,
        etat: premier!.enPiste ? 'enPiste' : 'aTirer',
        contexte: { tour: premier!.tour },
        tireurs: paire(premier!.haut.tireurId, premier!.bas.tireurId),
        puis: second ? paire(second.haut.tireurId, second.bas.tireurId) : null,
      };
    });
  }
  const parPiste = new Map<number, PouleDirect[]>();
  for (const poule of vue.poules) parPiste.set(poule.piste, [...(parPiste.get(poule.piste) ?? []), poule]);
  return [...parPiste.entries()]
    .sort(([a], [b]) => a - b)
    .map(([piste, poules]) => {
      const enCours = poules.find((p) => matchsAVenir(p).courant !== null);
      if (!enCours) {
        return { piste, etat: 'libre', contexte: { pouleTerminee: poules.at(-1)!.numero }, tireurs: null, puis: null };
      }
      const { courant, suivant } = matchsAVenir(enCours);
      return {
        piste,
        etat: 'enPiste',
        contexte: { poule: enCours.numero, numero: courant!.numero, total: enCours.total },
        tireurs: paire(courant!.tireurA, courant!.tireurB),
        puis: suivant ? paire(suivant.tireurA, suivant.tireurB) : null,
      };
    });
}

/** US-143 : les matchs d'un tour, dans l'ordre du tableau. */
const matchsDuTour = (matchs: readonly MatchTableauVue[], tour: number) =>
  matchs.filter((m) => m.tour === tour).sort((a, b) => a.numero - b.numero);

/** US-143 CA-1 : l'arbre à partir du tour `depuis` ; une moitié seule jusqu'au tableau de 16 si `moitie` est donnée. */
export function arbreDuTableau(
  matchs: readonly MatchTableauVue[],
  depuis: number,
  moitie: 'haute' | 'basse' | null = null,
): ArbreTableau {
  const tours: number[] = [];
  for (let tour = depuis; tour >= (moitie ? 16 : 4); tour /= 2) tours.push(tour);
  const cote = (haute: boolean) =>
    tours.map((tour) => matchsDuTour(matchs, tour).filter((m) => m.numero <= tour / 4 === haute));
  return {
    tours,
    gauche: moitie === 'basse' ? cote(false) : cote(true),
    droite: moitie ? [] : cote(false),
    finale: moitie ? null : (matchsDuTour(matchs, 2)[0] ?? null),
    troisieme: moitie ? null : (matchsDuTour(matchs, 0)[0] ?? null),
    moitie,
  };
}

/** US-143 CA-1 et CA-3 : les pages du tableau ; au-delà du tableau de 32, une page par moitié puis l'arbre complet. */
function pagesDuTableau(epreuveId: string, taille: number, matchs: readonly MatchTableauVue[]): PageEcran[] {
  if (taille <= TAILLE_ARBRE_COMPLET) return [{ type: 'tableau', epreuveId, arbre: arbreDuTableau(matchs, taille) }];
  return [
    { type: 'tableau', epreuveId, arbre: arbreDuTableau(matchs, taille, 'haute') },
    { type: 'tableau', epreuveId, arbre: arbreDuTableau(matchs, taille, 'basse') },
    { type: 'tableau', epreuveId, arbre: arbreDuTableau(matchs, TAILLE_ARBRE_COMPLET) },
  ];
}

/** CA-2 : les pages d'une épreuve, selon son étape, sans les vues masquées. */
export function pagesDeLEpreuve(vue: VueDirect, masquees: readonly VueEcran[] = []): PageEcran[] {
  const pages: PageEcran[] = [];
  const voir = (type: VueEcran) => !masquees.includes(type);
  const epreuveId = vue.epreuveId;
  const appel = () => {
    if (!voir('appel')) return;
    for (const pistes of parTranches(pistesDeLAppel(vue), PISTES_PAR_PAGE))
      pages.push({ type: 'appel', epreuveId, pistes });
  };
  const classement = (final: boolean) => {
    if (!voir('classement')) return;
    const lignes = final
      ? (vue.classementFinal ?? [])
          .filter(({ etat }) => etat !== 'enLice')
          .map(({ tireurId, place }) => {
            const poules = vue.classement?.lignes.find((l) => l.tireurId === tireurId);
            return {
              rang: place,
              tireurId,
              victoires: poules?.victoires ?? 0,
              matchs: poules?.matchs ?? 0,
              indice: poules?.indice ?? 0,
              touches: poules?.touchesDonnees ?? 0,
            };
          })
      : (vue.classement?.lignes ?? []).map(({ rang, tireurId, victoires, matchs, indice, touchesDonnees }) => ({
          rang,
          tireurId,
          victoires,
          matchs,
          indice,
          touches: touchesDonnees,
        }));
    const definitif = final || (vue.classement?.definitif ?? false);
    for (const tranche of parTranches(lignes, LIGNES_PAR_PAGE)) {
      pages.push({ type: 'classement', epreuveId, final, definitif, lignes: tranche });
    }
  };
  switch (vue.etape) {
    case 'poules':
      appel();
      if (voir('poules'))
        for (const poules of parTranches(vue.poules, POULES_PAR_PAGE))
          pages.push({ type: 'poules', epreuveId, poules });
      // Demande de l'utilisateur (2026-11-21) : le classement provisoire suit les poules.
      classement(false);
      break;
    case 'classement':
      classement(false);
      break;
    case 'tableau': {
      appel();
      if (voir('tableau') && vue.tableau)
        pages.push(...pagesDuTableau(epreuveId, vue.tableau.taille, vue.tableau.matchs));
      // Demande de l'utilisateur (2026-11-21) : le classement après les poules ferme le cycle du tableau.
      classement(false);
      break;
    }
    case 'terminee':
      if (voir('podium')) pages.push({ type: 'podium', epreuveId });
      classement(true);
      break;
    default:
      // US-160 CA-1 : avant le lancement des poules, le mode Accueil (vue publiée par un pilote à jour).
      if (vue.accueil) pages.push({ type: 'accueil', epreuveId });
      break;
  }
  return pages;
}

/**
 * CA-2 et US-135 : toutes les pages de l'écran. Sans vue imposée, les épreuves cochées se suivent dans l'ordre de leurs
 * cases ; avec une vue imposée encore valable, seules les pages de cette vue (et de cette poule) restent.
 */
export function pagesDeLEcran(
  ecran: Pick<EcranPublic, 'epreuves' | 'vuesMasquees' | 'vueImposee'>,
  vues: ReadonlyMap<string, VueDirect>,
  maintenant: number,
): PageEcran[] {
  const imposee =
    ecran.vueImposee && (ecran.vueImposee.jusqua === null || ecran.vueImposee.jusqua > maintenant)
      ? ecran.vueImposee
      : null;
  if (imposee) {
    const vue = vues.get(imposee.epreuveId);
    const pages = vue ? pagesImposees(vue, imposee.vue, imposee.poule) : [];
    if (pages.length > 0) return pages;
  }
  const pages = ecran.epreuves.flatMap((id) => {
    const vue = vues.get(id);
    return vue ? pagesDeLEpreuve(vue, ecran.vuesMasquees) : [];
  });
  return pages.length > 0 ? pages : [{ type: 'attente' }];
}

/** US-135 : les pages d'une vue imposée, quelle que soit l'étape de l'épreuve. */
function pagesImposees(vue: VueDirect, type: VueEcran, poule: number | null): PageEcran[] {
  const autres = (['appel', 'poules', 'classement', 'tableau', 'podium'] as const).filter((v) => v !== type);
  const etape =
    type === 'appel'
      ? vue.tableau
        ? 'tableau'
        : 'poules'
      : type === 'poules'
        ? 'poules'
        : type === 'tableau'
          ? 'tableau'
          : type === 'podium'
            ? 'terminee'
            : vue.etape === 'terminee'
              ? 'terminee'
              : 'classement';
  const pages = pagesDeLEpreuve({ ...vue, etape }, autres);
  if (type === 'poules' && poule !== null) {
    const choisie = vue.poules.find(({ numero }) => numero === poule);
    return choisie ? [{ type: 'poules', epreuveId: vue.epreuveId, poules: [choisie] }] : pages;
  }
  return pages;
}

/** US-141 : un groupe du bandeau des derniers scores : l'épreuve (partie fixe) et ses scores récents. */
export interface GroupeBandeau {
  epreuveId: string;
  nom: string;
  scores: { score: ScoreRecent; tireurA: string; tireurB: string }[];
}

/**
 * US-141 CA-2 et CA-4 : les scores des `minutes` dernières minutes, regroupés par épreuve dans l'ordre des cases, le
 * plus récent d'abord ; une épreuve sans score récent n'a pas de groupe.
 */
export function groupesDuBandeau(
  epreuves: readonly string[],
  vues: ReadonlyMap<string, VueDirect>,
  minutes: number,
  maintenant: number,
): GroupeBandeau[] {
  const depuis = maintenant - minutes * 60_000;
  return epreuves.flatMap((epreuveId) => {
    const vue = vues.get(epreuveId);
    if (!vue) return [];
    const nom = new Map(vue.tireurs.map((tireur) => [tireur.id, tireur.nom]));
    const scores = (vue.scoresRecents ?? [])
      .filter(({ date }) => date >= depuis)
      .sort((a, b) => b.date - a.date)
      .map((score) => ({ score, tireurA: nom.get(score.tireurA) ?? '—', tireurB: nom.get(score.tireurB) ?? '—' }));
    return scores.length > 0 ? [{ epreuveId, nom: vue.nom, scores }] : [];
  });
}

/** US-160 : les plans du mode Accueil, dans l'ordre ; l'affiche et les horaires sont sautés quand ils manquent. */
export type PlanAccueil = 'affiche' | 'nom' | 'horaires' | 'chiffres';
export function plansAccueil(accueil: AccueilDirect): PlanAccueil[] {
  const horaires = Object.values(accueil.horaires).some((h) => h !== null);
  return [
    ...(accueil.affiche ? (['affiche'] as const) : []),
    'nom' as const,
    ...(horaires ? (['horaires'] as const) : []),
    'chiffres' as const,
  ];
}

export const ETAPES_ACCUEIL = ['appel', 'scratch', 'debutPoules'] as const;
export type EtapeAccueil = (typeof ETAPES_ACCUEIL)[number];

/** Instant (ms) d'un horaire `HH:MM` le jour de l'épreuve (aujourd'hui si la date manque), à l'heure locale. */
export function instantHoraire(date: string | null, horaire: string, maintenant: number): number {
  const jour = date ?? new Date(maintenant).toLocaleDateString('sv-SE');
  return new Date(`${jour}T${horaire}:00`).getTime();
}

/**
 * US-160 CA-4 : la prochaine étape (appel, puis scratch, puis début des poules) et le temps qui reste ; `imminent` quand
 * toutes les heures sont passées ; null sans aucun horaire.
 */
export function prochaineEtape(
  accueil: Pick<AccueilDirect, 'horaires'>,
  date: string | null,
  maintenant: number,
): { etape: EtapeAccueil; reste: number } | { etape: null; imminent: true } | null {
  const etapes = ETAPES_ACCUEIL.flatMap((etape) => {
    const horaire = accueil.horaires[etape];
    return horaire ? [{ etape, instant: instantHoraire(date, horaire, maintenant) }] : [];
  });
  if (etapes.length === 0) return null;
  const suivante = etapes.find(({ instant }) => instant > maintenant);
  return suivante ? { etape: suivante.etape, reste: suivante.instant - maintenant } : { etape: null, imminent: true };
}

/** « 42:12 », « 02:05:09 », ou « 3 j 04:00:00 » au-delà d'un jour. */
export function formaterReste(reste: number): string {
  const secondes = Math.max(0, Math.ceil(reste / 1000));
  const jours = Math.floor(secondes / 86_400);
  const h = Math.floor(secondes / 3600) % 24;
  const m = Math.floor(secondes / 60) % 60;
  const s = secondes % 60;
  const deux = (n: number) => String(n).padStart(2, '0');
  const horloge = h > 0 || jours > 0 ? `${deux(h)}:${deux(m)}:${deux(s)}` : `${deux(m)}:${deux(s)}`;
  return jours > 0 ? `${jours} j ${horloge}` : horloge;
}

/** US-160 : durée d'un plan du mode Accueil. */
export const DUREE_PLAN_ACCUEIL = 8_000;

/**
 * US-160 : durée d'une page à l'écran. Une page Accueil dure le temps de tous ses plans, pour que la séquence d'une
 * épreuve se termine avant celle de la suivante ; les autres pages, la durée réglée pour l'écran.
 */
export function dureeDeLaPage(page: PageEcran | null, vues: ReadonlyMap<string, VueDirect>, dureePage: number): number {
  const accueil = page?.type === 'accueil' ? vues.get(page.epreuveId)?.accueil : undefined;
  return accueil ? plansAccueil(accueil).length * DUREE_PLAN_ACCUEIL : dureePage * 1000;
}
