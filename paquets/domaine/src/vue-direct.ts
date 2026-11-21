// Vue en direct (US-132, ADR-0029) : ce que le pilote publie pour les écrans géants et les spectateurs. Elle est
// calculée ici à partir de la projection du journal ; le serveur la garde et la diffuse sans la lire. Elle est publique :
// des tireurs, seuls le nom affiché (« Prénom N. » si le réglage l'exige, US-032) et le club (ADR-0014). Ni émargement,
// ni licence, ni classement fédéral, ni droits, ni identifiant d'appareil.
import type { Arme, Sexe, Statut } from './epreuve';
import { poulesDe, tableauDe, tireursDe, type Epreuve } from './journal';
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

export interface PouleDirect {
  numero: number;
  piste: number;
  /** Dans l'ordre de la poule. */
  tireurIds: string[];
  matchs: MatchVue[];
  regles: number;
  total: number;
  classement: ClassementVue[];
}

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
}

/** CA-2 : « MARTIN Léa », ou « Léa M. » quand le public ne voit que l'initiale du nom. */
export function nomAffiche(nom: string, prenom: string, prenomInitiale: boolean): string {
  const nomPropre = nom.trim();
  const prenomPropre = prenom.trim();
  if (!prenomInitiale) return [nomPropre, prenomPropre].filter(Boolean).join(' ');
  const initiale = nomPropre ? `${nomPropre.charAt(0).toLocaleUpperCase('fr')}.` : '';
  return [prenomPropre, initiale].filter(Boolean).join(' ');
}

/** CA-1 : la vue en direct d'une épreuve, telle que le pilote la publie. */
export function vueDirect(epreuve: Epreuve): VueDirect {
  const touches = epreuve.formule.touchesPoules;
  const etat = poulesDe(epreuve);
  const prenomInitiale = epreuve.parametres.prenomInitiale;
  const tireurs = tireursDe(epreuve).map(({ id, nom, prenom, club }) => ({
    id,
    nom: nomAffiche(nom, prenom, prenomInitiale),
    club,
  }));

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
            .map(({ tireurId, rang, victoires, matchs, indice, retrait }) => ({
              tireurId,
              rang,
              victoires,
              matchs,
              indice,
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
        touches: epreuve.formule.touchesTableau,
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
      ? classementFinal(etat, tableauDe(epreuve), touches, epreuve.formule.matchTroisieme).map(
          ({ tireurId, place, exaequo, etat: etatFinal }) => ({ tireurId, place, exaequo, etat: etatFinal }),
        )
      : null,
  };
}
