// Liste du club pour l'accueil (US-026) : réunit l'index des compétitions, les manifestations et les épreuves du club
// (à jour en ligne, sinon leurs dernières copies gardées sur l'appareil) et les compétitions de cet appareil. La
// construction de l'arborescence, elle, est faite par le domaine (`construireListe`).
import type { CompetitionListee, EpreuveListee, ManifestationListee, Competition } from '@poule-position/domaine';
import type { CompetitionIndexee } from '@poule-position/protocole';
import type { ClientEpreuves } from './epreuves';
import type { Journal } from './journal';
import type { ClientManifestations } from './manifestations';
import { Base, LIGNE_UNIQUE } from './stockage';
import type { Synchronisation } from './synchronisation';

/** Données de la liste, avant leur mise en arborescence. */
export interface DonneesAccueil {
  manifestations: ManifestationListee[];
  epreuves: EpreuveListee[];
  competitions: CompetitionListee[];
  /** Vrai si l'index du club n'a pas pu être lu : la liste vient des copies gardées sur l'appareil. */
  horsLigne: boolean;
  /** Date de la copie de l'index affichée hors ligne ; null si elle est à jour, ou si l'appareil n'en a aucune. */
  copieLe: number | null;
}

export interface OptionsAccueil {
  journal: Journal;
  synchronisation: Synchronisation;
  manifestations: ClientManifestations;
  epreuves: ClientEpreuves;
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
}: CompetitionIndexee): CompetitionListee {
  return { id, nom, arme, categorie, sexe, date, statut, publiee, rattachement, pilote: false, nonEnvoyee: false };
}

/** Entrée de la liste pour une compétition gardée sur cet appareil. */
function depuisLocale(
  { id, nom, arme, categorie, sexe, date, statut, publiee, rattachement }: Competition,
  pilote: boolean,
  confirme: number,
): CompetitionListee {
  // Cas limite : rien n'est encore parvenu au serveur pour une compétition pilotée ici.
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

export function creerAccueil({
  journal,
  synchronisation,
  manifestations,
  epreuves,
  nomBase = 'poulePosition',
  maintenant = () => Date.now(),
}: OptionsAccueil) {
  const base = new Base(nomBase);

  /** Index du club : à jour (et gardé sur l'appareil) si le serveur répond, sinon sa dernière copie. */
  async function index(): Promise<{ competitions: CompetitionIndexee[]; copieLe: number | null; horsLigne: boolean }> {
    const reponse = await synchronisation.listerCompetitionsDuClub();
    if (reponse.ok) {
      await base.copieIndex.put({ cle: LIGNE_UNIQUE, competitions: reponse.competitions, copieLe: maintenant() });
      return { competitions: reponse.competitions, copieLe: null, horsLigne: false };
    }
    const copie = await base.copieIndex.get(LIGNE_UNIQUE);
    return { competitions: copie?.competitions ?? [], copieLe: copie?.copieLe ?? null, horsLigne: true };
  }

  /** Compétitions de cet appareil : pilotées ici, ou copies téléchargées d'un autre PC. */
  async function locales(): Promise<CompetitionListee[]> {
    const entrees: CompetitionListee[] = [];
    for (const { competitionId, pilote, confirme } of await journal.competitionsLocales()) {
      const { competition } = await journal.lire(competitionId);
      if (competition) entrees.push(depuisLocale(competition, pilote, confirme));
    }
    return entrees;
  }

  return {
    /** CA-1 et hors ligne : les données de la liste ; une copie ou une compétition locale remplace une ligne de l'index. */
    /** US-040 : supprime définitivement une compétition (US-039) ; la liste se recharge à la fin de la série. */
    supprimer: (competitionId: string) => synchronisation.supprimerCompetition(competitionId),

    async charger(): Promise<DonneesAccueil> {
      const [clubs, lesManifestations, lesEpreuves] = await Promise.all([
        index(),
        manifestations.lister(),
        epreuves.lister(),
      ]);
      const competitions = new Map<string, CompetitionListee>();
      for (const ligne of clubs.competitions) competitions.set(ligne.id, depuisIndex(ligne));
      for (const locale of await locales()) {
        // Une copie d'un autre PC ne remplace pas la ligne de l'index, plus récente quand le serveur répond.
        if (locale.pilote || !competitions.has(locale.id)) competitions.set(locale.id, locale);
      }
      return {
        manifestations: (lesManifestations.ok
          ? lesManifestations.manifestations
          : (lesManifestations.copie?.manifestations ?? [])
        ).map(({ id, nom, debut, fin, lieu }) => ({ id, nom, debut, fin, lieu })),
        epreuves: (lesEpreuves.ok ? lesEpreuves.epreuves : (lesEpreuves.copie?.epreuves ?? [])).map(
          ({ id, manifestationId, nom, arme }) => ({ id, manifestationId, nom, arme }),
        ),
        competitions: [...competitions.values()],
        horsLigne: clubs.horsLigne,
        copieLe: clubs.copieLe,
      };
    },
  };
}

export type Accueil = ReturnType<typeof creerAccueil>;
