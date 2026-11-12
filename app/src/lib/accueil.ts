// Liste du club pour l'accueil (US-026) : réunit l'index des épreuves, les manifestations et les compétitions du club
// (à jour en ligne, sinon leurs dernières copies gardées sur l'appareil) et les épreuves de cet appareil. La
// construction de l'arborescence, elle, est faite par le domaine (`construireListe`).
import {
  planifierArchivageManifestation,
  planifierDesarchivageManifestation,
  type EpreuveListee,
  type CompetitionListee,
  type ManifestationListee,
  type Epreuve,
} from '@poule-position/domaine';
import type { EpreuveIndexee } from '@poule-position/protocole';
import type { ClientCompetitions } from './competitions';
import type { HierarchieClub } from './fil-ariane';
import type { Contexte, Journal } from './journal';
import { rattacherEpreuves } from './rattachement-lot';
import { changerArchivage, type ErreurArchivage } from './epreuves';
import type { ClientManifestations, ErreurManifestations } from './manifestations';
import { Base, LIGNE_UNIQUE } from './stockage';
import type { ActionsLot } from './suppression';
import type { ActionsSuppressionUnique } from './suppression-unique';
import type { Synchronisation } from './synchronisation';

/** Données de la liste, avant leur mise en arborescence. */
export interface DonneesAccueil {
  manifestations: ManifestationListee[];
  competitions: CompetitionListee[];
  epreuves: EpreuveListee[];
  /** Vrai si l'index du club n'a pas pu être lu : la liste vient des copies gardées sur l'appareil. */
  horsLigne: boolean;
  /** Date de la copie de l'index affichée hors ligne ; null si elle est à jour, ou si l'appareil n'en a aucune. */
  copieLe: number | null;
}

export interface OptionsAccueil {
  journal: Journal;
  synchronisation: Synchronisation;
  manifestations: ClientManifestations;
  competitions: ClientCompetitions;
  nomBase?: string;
  maintenant?: () => number;
}

/** Entrée de la liste pour une ligne de l'index du club ; ce PC n'en est pas le pilote (sa version locale prime). */
function depuisIndex({
  id,
  nom,
  arme,
  categorie,
  sexe,
  date,
  statut,
  publiee,
  rattachement,
}: EpreuveIndexee): EpreuveListee {
  return { id, nom, arme, categorie, sexe, date, statut, publiee, rattachement, pilote: false, nonEnvoyee: false };
}

/** Entrée de la liste pour une épreuve gardée sur cet appareil. */
function depuisLocale(
  { id, nom, arme, categorie, sexe, date, statut, publiee, rattachement }: Epreuve,
  pilote: boolean,
  confirme: number,
): EpreuveListee {
  // Cas limite : rien n'est encore parvenu au serveur pour une épreuve pilotée ici.
  return {
    id,
    nom,
    arme,
    categorie,
    sexe,
    date,
    statut,
    publiee,
    rattachement,
    pilote,
    nonEnvoyee: pilote && confirme === 0,
  };
}

/** US-033 : résultat de l'archivage ou du désarchivage d'une manifestation. */
export type ResultatArchivageManifestation =
  | { ok: true; epreuves: number; pilotesAilleurs: string[] }
  /** CA-4 : une épreuve est « En cours ». CA-5 : une épreuve non archivée est pilotée par un autre PC. */
  | { ok: false; erreur: 'EPREUVE_EN_COURS' | 'PILOTEE_AILLEURS'; epreuves: string[] }
  | { ok: false; erreur: ErreurManifestations | ErreurArchivage; epreuves?: undefined };

export function creerAccueil({
  journal,
  synchronisation,
  manifestations,
  competitions,
  nomBase = 'poulePosition',
  maintenant = () => Date.now(),
}: OptionsAccueil) {
  const base = new Base(nomBase);

  /** Index du club : à jour (et gardé sur l'appareil) si le serveur répond, sinon sa dernière copie. */
  async function index(): Promise<{ epreuves: EpreuveIndexee[]; copieLe: number | null; horsLigne: boolean }> {
    const reponse = await synchronisation.listerEpreuvesDuClub();
    if (reponse.ok) {
      await base.copieIndex.put({ cle: LIGNE_UNIQUE, epreuves: reponse.epreuves, copieLe: maintenant() });
      return { epreuves: reponse.epreuves, copieLe: null, horsLigne: false };
    }
    const copie = await base.copieIndex.get(LIGNE_UNIQUE);
    return { epreuves: copie?.epreuves ?? [], copieLe: copie?.copieLe ?? null, horsLigne: true };
  }

  /** Épreuves de cet appareil : pilotées ici, ou copies téléchargées d'un autre PC. */
  async function locales(): Promise<EpreuveListee[]> {
    const entrees: EpreuveListee[] = [];
    for (const { epreuveId, pilote, confirme } of await journal.epreuvesLocales()) {
      const { epreuve } = await journal.lire(epreuveId);
      if (epreuve) entrees.push(depuisLocale(epreuve, pilote, confirme));
    }
    return entrees;
  }

  return {
    /** CA-1 et hors ligne : les données de la liste ; une copie ou une épreuve locale remplace une ligne de l'index. */
    /** US-040 : supprime définitivement une épreuve (US-039) ; la liste se recharge à la fin de la série. */
    supprimer: (epreuveId: string) => synchronisation.supprimerEpreuve(epreuveId),

    /**
     * US-043 : les trois suppressions d'une série mixte, chacune par la route de son type (US-039, US-041, US-042). Une
     * compétition ou une manifestation part avec son contenu, par morceaux, et le serveur garde ce qui reste si la suite est
     * interrompue.
     */
    actionsLot: {
      manifestation: async (id) => {
        const resultat = await manifestations.supprimerAvecContenu(id);
        return resultat.ok ? { ok: true } : { ok: false, erreur: resultat.erreur };
      },
      competition: async (id) => {
        const resultat = await competitions.supprimerAvecContenu(id);
        return resultat.ok ? { ok: true } : { ok: false, erreur: resultat.erreur };
      },
      epreuve: (id) => synchronisation.supprimerEpreuve(id),
    } satisfies ActionsLot,

    /**
     * US-060 : rattache des épreuves à une compétition (journal local, sans réseau), puis envoie ce qui peut l'être ;
     * sans réseau, l'envoi attend son retour.
     */
    async rattacher(
      epreuveIds: readonly string[],
      competitionId: string,
      donnees: Pick<DonneesAccueil, 'manifestations' | 'competitions'>,
      contexte: Omit<Contexte, 'clubId'> & { clubId?: string | undefined },
    ) {
      const compte = await rattacherEpreuves(
        journal,
        epreuveIds,
        competitionId,
        contexte,
        donnees.manifestations,
        donnees.competitions,
      );
      await Promise.allSettled(compte.rattachees.map((id) => synchronisation.envoyer(id)));
      return compte;
    },

    /**
     * US-033 CA-4 et CA-5 : archive ou désarchive une manifestation. Les épreuves s'écrivent d'abord dans leur journal
     * (ce PC doit être le pilote de toutes celles qui ne sont pas archivées), puis le serveur archive la manifestation et
     * ses compétitions. Si le serveur est injoignable, relancer reprend sans dégât : rien n'est écrit deux fois.
     */
    async archiverManifestation(
      id: string,
      archiver: boolean,
      donnees: Pick<DonneesAccueil, 'competitions' | 'epreuves'>,
      contexte: Omit<Contexte, 'clubId'> & { clubId?: string | undefined },
    ): Promise<ResultatArchivageManifestation> {
      let aEcrire: string[];
      let pilotesAilleurs: string[] = [];
      if (archiver) {
        const plan = planifierArchivageManifestation(id, donnees.competitions, donnees.epreuves);
        if (!plan.ok) return { ok: false, erreur: plan.erreur, epreuves: plan.epreuves };
        aEcrire = plan.aArchiver;
      } else {
        const plan = planifierDesarchivageManifestation(id, donnees.competitions, donnees.epreuves);
        aEcrire = plan.aDesarchiver;
        pilotesAilleurs = plan.pilotesAilleurs;
      }
      for (const epreuveId of aEcrire) {
        const resultat = await changerArchivage(journal, epreuveId, archiver, contexte);
        if (!resultat.ok) return { ok: false, erreur: resultat.erreur };
      }
      await Promise.allSettled(aEcrire.map((epreuveId) => synchronisation.envoyer(epreuveId)));
      const serveur = await manifestations.archiver(id, archiver);
      if (!serveur.ok) return { ok: false, erreur: serveur.erreur };
      return { ok: true, epreuves: aEcrire.length, pilotesAilleurs };
    },

    /** US-057 : les routes de « Supprimer… » d'une manifestation ou d'une compétition (vide, ou avec son contenu). */
    actionsSuppression: { manifestation: manifestations, competition: competitions } satisfies ActionsSuppressionUnique,

    /**
     * US-054 CA-3 : manifestations et compétitions du club pour le fil d'Ariane d'une page (sans l'index des épreuves) ;
     * hors ligne, leurs dernières copies gardées sur l'appareil.
     */
    async hierarchie(): Promise<HierarchieClub> {
      const [lesManifestations, lesCompetitions] = await Promise.all([manifestations.lister(), competitions.lister()]);
      return {
        manifestations: (lesManifestations.ok
          ? lesManifestations.manifestations
          : (lesManifestations.copie?.manifestations ?? [])
        ).map(({ id, nom }) => ({ id, nom })),
        competitions: (lesCompetitions.ok
          ? lesCompetitions.competitions
          : (lesCompetitions.copie?.competitions ?? [])
        ).map(({ id, nom, manifestationId, arme }) => ({ id, nom, manifestationId, arme })),
      };
    },

    async charger(): Promise<DonneesAccueil> {
      const [clubs, lesManifestations, lesCompetitions] = await Promise.all([
        index(),
        manifestations.lister(),
        competitions.lister(),
      ]);
      const epreuves = new Map<string, EpreuveListee>();
      for (const ligne of clubs.epreuves) epreuves.set(ligne.id, depuisIndex(ligne));
      for (const locale of await locales()) {
        // Une copie d'un autre PC ne remplace pas la ligne de l'index, plus récente quand le serveur répond.
        if (locale.pilote || !epreuves.has(locale.id)) epreuves.set(locale.id, locale);
      }
      return {
        manifestations: (lesManifestations.ok
          ? lesManifestations.manifestations
          : (lesManifestations.copie?.manifestations ?? [])
        ).map(({ id, nom, debut, fin, lieu, archivee }) => ({
          id,
          nom,
          debut,
          fin,
          lieu,
          archivee: archivee === true,
        })),
        competitions: (lesCompetitions.ok
          ? lesCompetitions.competitions
          : (lesCompetitions.copie?.competitions ?? [])
        ).map(({ id, manifestationId, nom, arme, archivee }) => ({
          id,
          manifestationId,
          nom,
          arme,
          archivee: archivee === true,
        })),
        epreuves: [...epreuves.values()],
        horsLigne: clubs.horsLigne,
        copieLe: clubs.copieLe,
      };
    },
  };
}

export type Accueil = ReturnType<typeof creerAccueil>;
