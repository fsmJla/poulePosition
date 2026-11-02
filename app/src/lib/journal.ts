// Journal local des compétitions (ADR-0001, ADR-0003, US-021) : chaque événement est écrit dans IndexedDB avant d'être
// affiché, et l'état est recalculé à partir du journal. Rien ici ne passe par le réseau : l'envoi au serveur est fait
// par `synchronisation.ts` (US-022), qui s'appuie sur le curseur d'envoi et les copies tenus ici (ADR-0016).
import { Dexie } from 'dexie';
import {
  appliquer,
  projeter,
  verifierEvenement,
  type ErreurEvenement,
  type Evenement,
  type Projection,
  type Proposition,
} from '@poule-position/domaine';
import { lireEvenement, VERSION_JOURNAL } from '@poule-position/protocole';
import { Base, LIGNE_UNIQUE, type CompetitionLocale } from './stockage';

/** Qui écrit, et à quelle heure (injectable pour les tests). */
export interface Contexte {
  clubId: string;
  /** E-mail du compte connecté. */
  auteur: string;
  maintenant?: () => number;
}

/**
 * Erreurs d'écriture : règle métier refusée (CA-4), journal déjà incohérent (on n'écrit pas à sa suite), copie d'une
 * compétition pilotée par un autre PC (US-022), ou IndexedDB en échec (quota, navigation privée…).
 */
export type ErreurJournal = ErreurEvenement | 'JOURNAL_INCOHERENT' | 'PAS_PILOTE' | 'ECRITURE_IMPOSSIBLE';

export type ResultatEcriture = { projection: Projection } | { erreur: ErreurJournal };

export interface Journal {
  lire(competitionId: string): Promise<Projection>;
  enregistrer(competitionId: string, proposition: Proposition, contexte: Contexte): Promise<ResultatEcriture>;
  /** Ce que cet appareil sait de la compétition (pilote, curseur d'envoi, copie), ou null s'il ne la connaît pas. */
  etat(competitionId: string): Promise<CompetitionLocale | null>;
  competitionsLocales(): Promise<CompetitionLocale[]>;
  /** Événements à envoyer au serveur : ceux qui suivent le dernier seq confirmé, d'une compétition pilotée ici. */
  aEnvoyer(competitionId: string): Promise<Evenement[]>;
  /** Dernier seq que le serveur dit avoir (accusé d'un lot, ou décalage) : le prochain envoi reprend de là. */
  confirmer(competitionId: string, seq: number): Promise<void>;
  /**
   * Remplace la copie d'une compétition pilotée par un autre PC par le journal téléchargé ; false si cet appareil en
   * est le pilote (son journal fait foi et n'est jamais remplacé).
   */
  remplacerCopie(competitionId: string, evenements: readonly Evenement[], copieLe: number): Promise<boolean>;
  /** Identifiant de cet appareil, tiré au premier appel puis gardé (ADR-0016). */
  appareil(): Promise<string>;
}

/** Demande au navigateur de ne pas purger les données du site sous pression d'espace (ADR-0003). */
const demanderPersistance = async () => (await navigator.storage?.persist?.()) ?? false;

export function ouvrirJournal(nom = 'poulePosition', persister: () => Promise<boolean> = demanderPersistance): Journal {
  const base = new Base(nom);
  let persistanceDemandee = false;

  /** Journal d'une compétition, dans l'ordre des `seq`. */
  const evenementsBruts = (competitionId: string) =>
    base.evenements
      .where('[competitionId+seq]')
      .between([competitionId, Dexie.minKey], [competitionId, Dexie.maxKey])
      .toArray();

  return {
    async lire(competitionId) {
      return projeterBruts(await evenementsBruts(competitionId));
    },

    async enregistrer(competitionId, proposition, { clubId, auteur, maintenant = Date.now }) {
      let resultat: ResultatEcriture;
      try {
        // Lecture, contrôle et écriture dans une même transaction : deux écritures ne peuvent pas prendre le même seq.
        resultat = await base.transaction('rw', base.evenements, base.competitionsLocales, async () => {
          const locale = await base.competitionsLocales.get(competitionId);
          if (locale && !locale.pilote) return { erreur: 'PAS_PILOTE' as const };
          const projection = projeterBruts(await evenementsBruts(competitionId));
          if (projection.anomalie) return { erreur: 'JOURNAL_INCOHERENT' as const };
          const erreur = verifierEvenement(projection, proposition);
          if (erreur) return { erreur };
          const evenement: Evenement = {
            competitionId,
            clubId,
            seq: projection.dernierSeq + 1,
            version: VERSION_JOURNAL,
            date: maintenant(),
            auteur,
            source: 'clavier',
            ...proposition,
          };
          await base.evenements.add({ ...evenement });
          // US-022 : le PC qui crée la compétition en est le pilote ; rien n'est encore confirmé par le serveur.
          if (!locale) await base.competitionsLocales.add({ competitionId, pilote: true, confirme: 0, copieLe: null });
          return { projection: appliquer(projection, evenement) };
        });
      } catch {
        return { erreur: 'ECRITURE_IMPOSSIBLE' };
      }
      if ('projection' in resultat && !persistanceDemandee) {
        persistanceDemandee = true;
        await persister().catch(() => false);
      }
      return resultat;
    },

    async etat(competitionId) {
      return (await base.competitionsLocales.get(competitionId)) ?? null;
    },

    async competitionsLocales() {
      return base.competitionsLocales.toArray();
    },

    async aEnvoyer(competitionId) {
      const locale = await base.competitionsLocales.get(competitionId);
      if (!locale?.pilote) return [];
      const evenements: Evenement[] = [];
      for (const brut of await evenementsBruts(competitionId)) {
        const evenement = lireEvenement(brut);
        if (!evenement) break;
        if (evenement.seq > locale.confirme) evenements.push(evenement);
      }
      return evenements;
    },

    async confirmer(competitionId, seq) {
      await base.competitionsLocales.update(competitionId, { confirme: seq });
    },

    async remplacerCopie(competitionId, evenements, copieLe) {
      return base.transaction('rw', base.evenements, base.competitionsLocales, async () => {
        if ((await base.competitionsLocales.get(competitionId))?.pilote) return false;
        await base.evenements
          .where('[competitionId+seq]')
          .between([competitionId, Dexie.minKey], [competitionId, Dexie.maxKey])
          .delete();
        await base.evenements.bulkAdd(evenements.map((evenement) => ({ ...evenement })));
        const confirme = evenements.at(-1)?.seq ?? 0;
        await base.competitionsLocales.put({ competitionId, pilote: false, confirme, copieLe });
        return true;
      });
    },

    async appareil() {
      return base.transaction('rw', base.appareil, async () => {
        const ligne = await base.appareil.get(LIGNE_UNIQUE);
        if (ligne) return ligne.id;
        const id = crypto.randomUUID();
        await base.appareil.add({ cle: LIGNE_UNIQUE, id });
        return id;
      });
    },
  };
}

/** Projection d'un journal tel que stocké : chaque événement est migré à la lecture ; un illisible arrête la projection. */
function projeterBruts(bruts: readonly unknown[]): Projection {
  const evenements: Evenement[] = [];
  for (const brut of bruts) {
    const evenement = lireEvenement(brut);
    if (!evenement) {
      const projection = projeter(evenements);
      if (projection.anomalie) return projection;
      return { ...projection, anomalie: { seq: projection.dernierSeq + 1, nature: 'ILLISIBLE' } };
    }
    evenements.push(evenement);
  }
  return projeter(evenements);
}

/**
 * Réserve l'écriture d'une compétition à cet onglet (API Web Locks) : renvoie de quoi la libérer, ou null si un autre
 * onglet la détient déjà (il reste alors en lecture seule). Sans l'API, l'écriture est accordée.
 */
export function prendreEcriture(
  competitionId: string,
  verrous: LockManager | null = navigator.locks ?? null,
): Promise<(() => void) | null> {
  if (!verrous) return Promise.resolve(() => {});
  return new Promise((resoudre) => {
    void verrous.request(`competition:${competitionId}`, { ifAvailable: true }, (verrou) => {
      if (!verrou) {
        resoudre(null);
        return;
      }
      // Le verrou est gardé tant que cette promesse n'est pas résolue.
      return new Promise<void>((liberer) => resoudre(liberer));
    });
  });
}
