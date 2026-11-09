// Journal local des épreuves (ADR-0001, ADR-0003, US-021) : chaque événement est écrit dans IndexedDB avant d'être
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
import { Base, LIGNE_UNIQUE, type EpreuveLocale, type Ecart } from './stockage';

/** Qui écrit, et à quelle heure (injectable pour les tests). */
export interface Contexte {
  clubId: string;
  /** E-mail du compte connecté. */
  auteur: string;
  maintenant?: () => number;
}

/**
 * Erreurs d'écriture : règle métier refusée (CA-4), journal déjà incohérent (on n'écrit pas à sa suite), copie d'une
 * épreuve pilotée par un autre PC (US-022), ou IndexedDB en échec (quota, navigation privée…).
 */
export type ErreurJournal = ErreurEvenement | 'JOURNAL_INCOHERENT' | 'PAS_PILOTE' | 'ECRITURE_IMPOSSIBLE';

export type ResultatEcriture = { projection: Projection } | { erreur: ErreurJournal };

export interface Journal {
  lire(epreuveId: string): Promise<Projection>;
  /** Événements lisibles de l’épreuve, dans l'ordre des `seq` (jusqu'au premier illisible). */
  evenements(epreuveId: string): Promise<Evenement[]>;
  enregistrer(epreuveId: string, proposition: Proposition, contexte: Contexte): Promise<ResultatEcriture>;
  /** Ce que cet appareil sait de l’épreuve (pilote, curseur d'envoi, copie), ou null s'il ne la connaît pas. */
  etat(epreuveId: string): Promise<EpreuveLocale | null>;
  epreuvesLocales(): Promise<EpreuveLocale[]>;
  /** Événements à envoyer au serveur : ceux qui suivent le dernier seq confirmé, d'une épreuve pilotée ici. */
  aEnvoyer(epreuveId: string): Promise<Evenement[]>;
  /** Dernier seq que le serveur dit avoir (accusé d'un lot, ou décalage) : le prochain envoi reprend de là. */
  confirmer(epreuveId: string, seq: number): Promise<void>;
  /**
   * Remplace la copie d'une épreuve pilotée par un autre PC par le journal téléchargé ; false si cet appareil en
   * est le pilote (son journal fait foi et n'est jamais remplacé).
   */
  remplacerCopie(epreuveId: string, evenements: readonly Evenement[], copieLe: number): Promise<boolean>;
  /**
   * US-029 CA-1 : ce PC devient le pilote de l’épreuve : le journal du serveur remplace la copie locale et tout
   * ce qu'il contient est considéré comme confirmé.
   */
  devenirPilote(epreuveId: string, evenements: readonly Evenement[]): Promise<void>;
  /**
   * US-029 CA-2 et CA-3 : un autre PC a pris la main. Les événements pas encore envoyés sont mis de côté (jamais
   * perdus), ce PC cesse d'être le pilote et garde une copie à remplacer. Renvoie le nombre d'événements écartés.
   */
  ecarter(
    epreuveId: string,
    pilote: { piloteAppareil?: string; piloteNom?: string },
    copieLe: number,
  ): Promise<number>;
  /**
   * US-039 CA-5 et CA-6 : l’épreuve a été supprimée sur le serveur. Efface la copie locale (journal, ligne locale,
   * modifications écartées) et renvoie le nombre d'événements pas encore envoyés, abandonnés avec elle.
   */
  supprimerCopie(epreuveId: string): Promise<number>;
  lireEcartes(epreuveId: string): Promise<Ecart[]>;
  effacerEcartes(epreuveId: string): Promise<void>;
  /** Identifiant de cet appareil, tiré au premier appel puis gardé (ADR-0016). */
  appareil(): Promise<string>;
}

/** Demande au navigateur de ne pas purger les données du site sous pression d'espace (ADR-0003). */
const demanderPersistance = async () => (await navigator.storage?.persist?.()) ?? false;

export function ouvrirJournal(nom = 'poulePosition', persister: () => Promise<boolean> = demanderPersistance): Journal {
  const base = new Base(nom);
  let persistanceDemandee = false;

  /** Journal d'une épreuve, dans l'ordre des `seq`. */
  const evenementsBruts = (epreuveId: string) =>
    base.evenements
      .where('[epreuveId+seq]')
      .between([epreuveId, Dexie.minKey], [epreuveId, Dexie.maxKey])
      .toArray();

  return {
    async lire(epreuveId) {
      return projeterBruts(await evenementsBruts(epreuveId));
    },

    async evenements(epreuveId) {
      const evenements: Evenement[] = [];
      for (const brut of await evenementsBruts(epreuveId)) {
        const evenement = lireEvenement(brut);
        if (!evenement) break;
        evenements.push(evenement);
      }
      return evenements;
    },

    async enregistrer(epreuveId, proposition, { clubId, auteur, maintenant = Date.now }) {
      let resultat: ResultatEcriture;
      try {
        // Lecture, contrôle et écriture dans une même transaction : deux écritures ne peuvent pas prendre le même seq.
        resultat = await base.transaction('rw', base.evenements, base.epreuvesLocales, async () => {
          const locale = await base.epreuvesLocales.get(epreuveId);
          if (locale && !locale.pilote) return { erreur: 'PAS_PILOTE' as const };
          const projection = projeterBruts(await evenementsBruts(epreuveId));
          if (projection.anomalie) return { erreur: 'JOURNAL_INCOHERENT' as const };
          const erreur = verifierEvenement(projection, proposition);
          if (erreur) return { erreur };
          const evenement: Evenement = {
            epreuveId,
            clubId,
            seq: projection.dernierSeq + 1,
            version: VERSION_JOURNAL,
            date: maintenant(),
            auteur,
            source: 'clavier',
            ...proposition,
          };
          await base.evenements.add({ ...evenement });
          // US-022 : le PC qui crée l’épreuve en est le pilote ; rien n'est encore confirmé par le serveur.
          if (!locale) await base.epreuvesLocales.add({ epreuveId, pilote: true, confirme: 0, copieLe: null });
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

    async etat(epreuveId) {
      return (await base.epreuvesLocales.get(epreuveId)) ?? null;
    },

    async epreuvesLocales() {
      return base.epreuvesLocales.toArray();
    },

    async aEnvoyer(epreuveId) {
      const locale = await base.epreuvesLocales.get(epreuveId);
      if (!locale?.pilote) return [];
      const evenements: Evenement[] = [];
      for (const brut of await evenementsBruts(epreuveId)) {
        const evenement = lireEvenement(brut);
        if (!evenement) break;
        if (evenement.seq > locale.confirme) evenements.push(evenement);
      }
      return evenements;
    },

    async confirmer(epreuveId, seq) {
      await base.epreuvesLocales.update(epreuveId, { confirme: seq });
    },

    async remplacerCopie(epreuveId, evenements, copieLe) {
      return base.transaction('rw', base.evenements, base.epreuvesLocales, async () => {
        if ((await base.epreuvesLocales.get(epreuveId))?.pilote) return false;
        await base.evenements
          .where('[epreuveId+seq]')
          .between([epreuveId, Dexie.minKey], [epreuveId, Dexie.maxKey])
          .delete();
        await base.evenements.bulkAdd(evenements.map((evenement) => ({ ...evenement })));
        const confirme = evenements.at(-1)?.seq ?? 0;
        await base.epreuvesLocales.put({ epreuveId, pilote: false, confirme, copieLe });
        return true;
      });
    },

    async devenirPilote(epreuveId, evenements) {
      await base.transaction('rw', base.evenements, base.epreuvesLocales, async () => {
        await base.evenements
          .where('[epreuveId+seq]')
          .between([epreuveId, Dexie.minKey], [epreuveId, Dexie.maxKey])
          .delete();
        await base.evenements.bulkAdd(evenements.map((evenement) => ({ ...evenement })));
        const confirme = evenements.at(-1)?.seq ?? 0;
        await base.epreuvesLocales.put({ epreuveId, pilote: true, confirme, copieLe: null });
      });
    },

    async ecarter(epreuveId, pilote, copieLe) {
      return base.transaction('rw', base.evenements, base.epreuvesLocales, base.ecartes, async () => {
        const locale = await base.epreuvesLocales.get(epreuveId);
        if (!locale?.pilote) return 0;
        const aEcarter: Evenement[] = [];
        for (const brut of await evenementsBruts(epreuveId)) {
          const evenement = lireEvenement(brut);
          if (!evenement) break;
          if (evenement.seq > locale.confirme) aEcarter.push(evenement);
        }
        if (aEcarter.length > 0) {
          await base.ecartes.add({ epreuveId, evenements: aEcarter, ...pilote, ecartesLe: copieLe });
        }
        await base.epreuvesLocales.update(epreuveId, { pilote: false, copieLe });
        return aEcarter.length;
      });
    },

    async supprimerCopie(epreuveId) {
      return base.transaction('rw', base.evenements, base.epreuvesLocales, base.ecartes, async () => {
        const locale = await base.epreuvesLocales.get(epreuveId);
        let abandonnes = 0;
        if (locale?.pilote) {
          for (const brut of await evenementsBruts(epreuveId)) {
            const evenement = lireEvenement(brut);
            if (!evenement) break;
            if (evenement.seq > locale.confirme) abandonnes++;
          }
        }
        await base.evenements
          .where('[epreuveId+seq]')
          .between([epreuveId, Dexie.minKey], [epreuveId, Dexie.maxKey])
          .delete();
        await base.epreuvesLocales.delete(epreuveId);
        await base.ecartes.where('epreuveId').equals(epreuveId).delete();
        return abandonnes;
      });
    },

    async lireEcartes(epreuveId) {
      return base.ecartes.where('epreuveId').equals(epreuveId).toArray();
    },

    async effacerEcartes(epreuveId) {
      await base.ecartes.where('epreuveId').equals(epreuveId).delete();
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
 * Réserve l'écriture d'une épreuve à cet onglet (API Web Locks) : renvoie de quoi la libérer, ou null si un autre
 * onglet la détient déjà (il reste alors en lecture seule). Sans l'API, l'écriture est accordée.
 */
export function prendreEcriture(
  epreuveId: string,
  verrous: LockManager | null = navigator.locks ?? null,
): Promise<(() => void) | null> {
  if (!verrous) return Promise.resolve(() => {});
  return new Promise((resoudre) => {
    void verrous.request(`epreuve:${epreuveId}`, { ifAvailable: true }, (verrou) => {
      if (!verrou) {
        resoudre(null);
        return;
      }
      // Le verrou est gardé tant que cette promesse n'est pas résolue.
      return new Promise<void>((liberer) => resoudre(liberer));
    });
  });
}
