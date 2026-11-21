// Écran géant (US-134, planches 31 à 35) : les pages à faire défiler, tirées des vues en direct des épreuves cochées
// (US-132). Logique pure : l'écran reçoit les vues et ses réglages, ce module dit quoi afficher et dans quel ordre.
import type { MatchTableauVue, PouleDirect, VueDirect } from '@poule-position/domaine';
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
  | { type: 'tableau'; epreuveId: string; tour: number; matchs: MatchTableauVue[]; suivant: MatchTableauVue[] }
  | { type: 'podium'; epreuveId: string }
  | { type: 'attente' };

/** Nombres d'éléments par page (planches 31 à 34). */
export const PISTES_PAR_PAGE = 6;
export const POULES_PAR_PAGE = 2;
export const LIGNES_PAR_PAGE = 12;
export const MATCHS_PAR_PAGE = 8;

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

/** Le tour en cours du tableau : le plus grand tour qui a encore un match à tirer (sinon la finale). */
function tourEnCours(matchs: readonly MatchTableauVue[]): number {
  const tours = [...new Set(matchs.filter((m) => m.tour > 0).map((m) => m.tour))].sort((a, b) => b - a);
  return tours.find((tour) => matchs.some((m) => m.tour === tour && m.etat !== 'regle' && m.etat !== 'exempt')) ?? 2;
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
      if (voir('tableau') && vue.tableau) {
        const tour = tourEnCours(vue.tableau.matchs);
        const matchs = vue.tableau.matchs.filter((m) => m.tour === tour && m.etat !== 'exempt');
        const suivant = vue.tableau.matchs.filter((m) => m.tour === tour / 2);
        for (const tranche of parTranches(matchs, MATCHS_PAR_PAGE))
          pages.push({ type: 'tableau', epreuveId, tour, matchs: tranche, suivant });
      }
      // Demande de l'utilisateur (2026-11-21) : le classement après les poules ferme le cycle du tableau.
      classement(false);
      break;
    }
    case 'terminee':
      if (voir('podium')) pages.push({ type: 'podium', epreuveId });
      classement(true);
      break;
    default:
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
