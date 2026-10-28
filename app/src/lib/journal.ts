// Journal local des compétitions (ADR-0001, ADR-0003, US-021) : chaque événement est écrit dans IndexedDB avant d'être
// affiché, et l'état est recalculé à partir du journal. Rien ici ne passe par le réseau : l'envoi au serveur relève
// d'US-022.
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
import { Base } from './stockage';

/** Qui écrit, et à quelle heure (injectable pour les tests). */
export interface Contexte {
  clubId: string;
  /** E-mail du compte connecté. */
  auteur: string;
  maintenant?: () => number;
}

/**
 * Erreurs d'écriture : règle métier refusée (CA-4), journal déjà incohérent (on n'écrit pas à sa suite), ou
 * IndexedDB en échec (quota, navigation privée…).
 */
export type ErreurJournal = ErreurEvenement | 'JOURNAL_INCOHERENT' | 'ECRITURE_IMPOSSIBLE';

export type ResultatEcriture = { projection: Projection } | { erreur: ErreurJournal };

export interface Journal {
  lire(competitionId: string): Promise<Projection>;
  enregistrer(competitionId: string, proposition: Proposition, contexte: Contexte): Promise<ResultatEcriture>;
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
        resultat = await base.transaction('rw', base.evenements, async () => {
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
