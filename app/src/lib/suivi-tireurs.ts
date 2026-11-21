// Spectateur (US-137, US-138, planches 38 et 39) : ce qu'un spectateur voit d'un tireur dans la vue en direct, et les
// tireurs qu'il suit, gardés sur son smartphone (stockage local, sans compte).
import type { MotifRetrait, VueDirect } from '@poule-position/domaine';

/** US-138 CA-2 : ce que « Mes tireurs » montre d'un tireur suivi. */
export interface SituationTireur {
  tireurId: string;
  nom: string;
  club: string;
  poule: { numero: number; piste: number } | null;
  victoires: number;
  matchs: number;
  /** Rang provisoire (ou définitif) après les poules, et le nombre de tireurs classés. */
  rang: { rang: number; sur: number } | null;
  /** Le prochain match : en piste maintenant, ou après `avant` matchs de la poule ; au tableau, sa piste. */
  prochain:
    | { phase: 'poule'; adversaire: string; enPiste: boolean; avant: number; piste: number }
    | { phase: 'tableau'; adversaire: string; enPiste: boolean; piste: number | null; tour: number }
    | null;
  /** Place finale, une fois classé. */
  place: number | null;
  retrait: MotifRetrait | null;
  /** Exclu ou éliminé du tableau : plus de match à venir. */
  elimine: boolean;
}

export function situationTireur(vue: VueDirect, tireurId: string): SituationTireur | null {
  const tireur = vue.tireurs.find(({ id }) => id === tireurId);
  if (!tireur) return null;
  const nom = new Map(vue.tireurs.map(({ id, nom: n }) => [id, n]));
  const poule = vue.poules.find(({ tireurIds }) => tireurIds.includes(tireurId)) ?? null;
  const resultat = poule?.classement.find((c) => c.tireurId === tireurId) ?? null;
  const ligne = vue.classement?.lignes.find((l) => l.tireurId === tireurId) ?? null;
  const classes = vue.classement?.lignes.filter((l) => l.rang !== null).length ?? 0;
  const finale = vue.classementFinal?.find((l) => l.tireurId === tireurId) ?? null;

  let prochain: SituationTireur['prochain'] = null;
  if (vue.etape === 'tableau' && vue.tableau) {
    const match = vue.tableau.matchs.find(
      (m) => m.etat === 'aTirer' && (m.haut.tireurId === tireurId || m.bas.tireurId === tireurId),
    );
    if (match) {
      const adversaire = match.haut.tireurId === tireurId ? match.bas.tireurId : match.haut.tireurId;
      prochain = {
        phase: 'tableau',
        adversaire: nom.get(adversaire ?? '') ?? '',
        enPiste: match.enPiste,
        piste: match.piste,
        tour: match.tour,
      };
    }
  } else if (vue.etape === 'poules' && poule && !resultat?.retrait) {
    const restants = poule.matchs.filter(({ touches, forfait }) => touches === null && !forfait);
    const indice = restants.findIndex(({ tireurA, tireurB }) => tireurA === tireurId || tireurB === tireurId);
    const match = restants[indice];
    if (match) {
      prochain = {
        phase: 'poule',
        adversaire: nom.get(match.tireurA === tireurId ? match.tireurB : match.tireurA) ?? '',
        enPiste: indice === 0,
        avant: indice,
        piste: poule.piste,
      };
    }
  }

  return {
    tireurId,
    nom: tireur.nom,
    club: tireur.club,
    poule: poule ? { numero: poule.numero, piste: poule.piste } : null,
    victoires: resultat?.victoires ?? ligne?.victoires ?? 0,
    matchs: resultat?.matchs ?? ligne?.matchs ?? 0,
    rang: ligne?.rang ? { rang: ligne.rang, sur: classes } : null,
    prochain,
    place: finale?.place ?? null,
    retrait: resultat?.retrait ?? ligne?.retrait ?? null,
    elimine: finale !== null && (finale.etat === 'elimine' || finale.etat === 'exclusion' || finale.etat === 'classe'),
  };
}

/** US-138 CA-1 : tireurs dont le nom ou le club contient le texte cherché (sans accents ni majuscules). */
export function chercherDansLaVue(vue: VueDirect, texte: string): { id: string; nom: string; club: string }[] {
  const simple = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const cherche = simple(texte);
  if (!cherche) return [];
  return vue.tireurs.filter(({ nom, club }) => simple(nom).includes(cherche) || simple(club).includes(cherche));
}

type Stockage = Pick<Storage, 'getItem' | 'setItem'>;
const cle = (epreuveId: string) => `poule-position:suivis:${epreuveId}`;

/** US-138 CA-1 : les tireurs suivis de l'épreuve, gardés sur ce smartphone. */
export function lireSuivis(stockage: Stockage | null, epreuveId: string): string[] {
  try {
    const brut = JSON.parse(stockage?.getItem(cle(epreuveId)) ?? '[]') as unknown;
    return Array.isArray(brut) ? brut.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/** US-138 CA-1 et CA-4 : suit ou ne suit plus un tireur ; renvoie la nouvelle liste. */
export function basculerSuivi(stockage: Stockage | null, epreuveId: string, tireurId: string): string[] {
  const suivis = lireSuivis(stockage, epreuveId);
  const nouveaux = suivis.includes(tireurId) ? suivis.filter((id) => id !== tireurId) : [...suivis, tireurId];
  try {
    stockage?.setItem(cle(epreuveId), JSON.stringify(nouveaux));
  } catch {
    // Stockage refusé (navigation privée) : le suivi tient jusqu'à la fermeture de la page.
  }
  return nouveaux;
}
