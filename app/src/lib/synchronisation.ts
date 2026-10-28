// Réplication du journal des compétitions (US-022, ADR-0016, docs/protocole.md §11) : le PC pilote envoie au serveur, par
// lots, les événements qui suivent le dernier seq confirmé ; les autres PC du club listent les compétitions et en
// téléchargent une copie en lecture seule. Sans réseau, rien n'est perdu : les événements attendent dans IndexedDB et
// partent au retour de la connexion.
import type { Projection } from '@poule-position/domaine';
import {
  analyserReponseCompetitions,
  analyserReponseEnvoi,
  analyserReponseJournal,
  preparerLots,
  type CompetitionIndexee,
  type ErreurReponse,
} from '@poule-position/protocole';
import { DELAI_REPONSE } from './session';
import type { Journal } from './journal';

/** Résultat d'un envoi : tout est confirmé, il reste des événements à envoyer, ou l'envoi est bloqué. */
export type EtatEnvoi = 'a-jour' | 'en-attente' | 'session-expiree' | 'pas-pilote';

export type ErreurSynchronisation = 'HORS_LIGNE' | 'SESSION_INVALIDE' | 'COMPETITION_INCONNUE' | 'ERREUR_INATTENDUE';

/** Copie d'une compétition : la projection de son journal, et la date du téléchargement (null si pilotée ici). */
export interface Copie {
  projection: Projection;
  copieLe: number | null;
}

export interface OptionsSynchronisation {
  /** Adresse HTTP du serveur (voir urlHttp) ; null s'il n'est pas configuré. */
  urlServeur: string | null;
  journal: Journal;
  /** Jeton de la session en ligne ; null pour une session locale (US-005), qui n'envoie rien. */
  jeton: () => Promise<string | null>;
  envoyer?: typeof fetch;
  enLigne?: () => boolean;
  maintenant?: () => number;
  delai?: number;
}

/** Garde-fou : nombre maximal d'allers-retours d'un envoi (décalages de seq successifs). */
const TOURS_MAX = 20;

const SESSION_REFUSEE: readonly ErreurReponse[] = ['SESSION_INVALIDE', 'COMPTE_MODIFIE', 'COMPTE_RETIRE'];

class Injoignable extends Error {}

export function creerSynchronisation({
  urlServeur,
  journal,
  jeton,
  envoyer = (...args) => fetch(...args),
  enLigne = () => navigator.onLine,
  maintenant = () => Date.now(),
  delai = DELAI_REPONSE,
}: OptionsSynchronisation) {
  /** Envoie une requête et lit sa réponse JSON ; lève Injoignable si le serveur ne répond pas à temps. */
  async function requete(chemin: string, jetonSession: string, corps?: unknown): Promise<unknown> {
    let reponse: Response;
    try {
      reponse = await envoyer(`${urlServeur}${chemin}`, {
        method: corps === undefined ? 'GET' : 'POST',
        signal: AbortSignal.timeout(delai),
        headers: {
          Authorization: `Bearer ${jetonSession}`,
          ...(corps !== undefined && { 'Content-Type': 'application/json' }),
        },
        ...(corps !== undefined && { body: JSON.stringify(corps) }),
      });
    } catch {
      throw new Injoignable();
    }
    return reponse.json().catch(() => undefined);
  }

  /** Jeton utilisable maintenant, ou null si le serveur est absent, le réseau coupé ou la session locale. */
  async function jetonEnLigne(): Promise<string | null> {
    if (!urlServeur || !enLigne()) return null;
    return jeton();
  }

  async function envoyerMaintenant(competitionId: string): Promise<EtatEnvoi> {
    for (let tour = 0; tour < TOURS_MAX; tour++) {
      const evenements = await journal.aEnvoyer(competitionId);
      if (evenements.length === 0) return 'a-jour';
      const jetonSession = await jetonEnLigne();
      if (!jetonSession) return 'en-attente';
      const { competition } = await journal.lire(competitionId);
      if (!competition) return 'en-attente';
      const lots = preparerLots(await journal.appareil(), evenements, { nom: competition.nom });
      for (const lot of lots) {
        let reponse;
        try {
          reponse = analyserReponseEnvoi(await requete(`/competitions/${competitionId}/evenements`, jetonSession, lot));
        } catch {
          return 'en-attente';
        }
        if (reponse.ok) {
          await journal.confirmer(competitionId, reponse.dernierSeq);
          continue;
        }
        if (reponse.erreur === 'PAS_PILOTE') return 'pas-pilote';
        if (SESSION_REFUSEE.includes(reponse.erreur)) return 'session-expiree';
        if (reponse.erreur !== 'SEQ_INATTENDU' || reponse.dernierSeq === undefined) return 'en-attente';
        // Le serveur a un autre dernier seq (accusé perdu, lot renvoyé) : on reprend de là.
        await journal.confirmer(competitionId, reponse.dernierSeq);
        break;
      }
    }
    return 'en-attente';
  }

  /** Un seul envoi à la fois par compétition : un appel pendant un envoi en cours en partage le résultat. */
  const envoisEnCours = new Map<string, Promise<EtatEnvoi>>();

  function envoyerCompetition(competitionId: string): Promise<EtatEnvoi> {
    const enCours = envoisEnCours.get(competitionId);
    if (enCours) return enCours;
    const envoi = envoyerMaintenant(competitionId).finally(() => envoisEnCours.delete(competitionId));
    envoisEnCours.set(competitionId, envoi);
    return envoi;
  }

  /** Envoie tout ce qui attend, pour chaque compétition pilotée ici (démarrage, retour du réseau). */
  async function envoyerTout(): Promise<void> {
    const locales = await journal.competitionsLocales();
    await Promise.all(
      locales.filter(({ pilote }) => pilote).map(({ competitionId }) => envoyerCompetition(competitionId)),
    );
  }

  function erreurDe(erreur: ErreurReponse): ErreurSynchronisation {
    if (SESSION_REFUSEE.includes(erreur)) return 'SESSION_INVALIDE';
    return erreur === 'COMPETITION_INCONNUE' ? erreur : 'ERREUR_INATTENDUE';
  }

  async function copieLocale(competitionId: string): Promise<Copie | null> {
    const etat = await journal.etat(competitionId);
    return etat ? { projection: await journal.lire(competitionId), copieLe: etat.copieLe } : null;
  }

  return {
    /** US-022 CA-1 / CA-2 : envoie les événements non confirmés de la compétition. */
    envoyer: envoyerCompetition,

    envoyerTout,

    /** Nombre de modifications en attente d'envoi (indicateur, hors ligne). */
    async enAttente(competitionId: string): Promise<number> {
      return (await journal.aEnvoyer(competitionId)).length;
    },

    /** Vrai pour une compétition pilotée ici dont rien n'est encore parvenu au serveur (« Pas encore envoyée »). */
    async jamaisEnvoyee(competitionId: string): Promise<boolean> {
      const etat = await journal.etat(competitionId);
      return Boolean(etat?.pilote && etat.confirme === 0);
    },

    /** US-022 CA-4 : index des compétitions du club. */
    async listerCompetitionsDuClub(): Promise<
      { ok: true; competitions: CompetitionIndexee[] } | { ok: false; erreur: ErreurSynchronisation }
    > {
      const jetonSession = await jetonEnLigne();
      if (!jetonSession) return { ok: false, erreur: enLigne() && urlServeur ? 'SESSION_INVALIDE' : 'HORS_LIGNE' };
      try {
        const reponse = analyserReponseCompetitions(await requete('/competitions', jetonSession));
        return reponse.ok ? reponse : { ok: false, erreur: erreurDe(reponse.erreur) };
      } catch {
        return { ok: false, erreur: 'HORS_LIGNE' };
      }
    },

    /**
     * US-022 CA-4 : copie à jour d'une compétition pilotée par un autre PC, téléchargée puis projetée localement ; sur
     * le PC pilote, son propre journal. En cas d'échec, la dernière copie gardée (avec sa date) est jointe.
     */
    async telechargerCopie(
      competitionId: string,
    ): Promise<({ ok: true } & Copie) | { ok: false; erreur: ErreurSynchronisation; copie?: Copie }> {
      const locale = await copieLocale(competitionId);
      if (locale && locale.copieLe === null) return { ok: true, ...locale };
      const echec = (erreur: ErreurSynchronisation) => ({
        ok: false as const,
        erreur,
        ...(locale && { copie: locale }),
      });
      const jetonSession = await jetonEnLigne();
      if (!jetonSession) return echec(enLigne() && urlServeur ? 'SESSION_INVALIDE' : 'HORS_LIGNE');
      let reponse;
      try {
        reponse = analyserReponseJournal(await requete(`/competitions/${competitionId}/evenements`, jetonSession));
      } catch {
        return echec('HORS_LIGNE');
      }
      if (!reponse.ok) return echec(erreurDe(reponse.erreur));
      const copieLe = maintenant();
      await journal.remplacerCopie(competitionId, reponse.evenements, copieLe);
      return { ok: true, projection: await journal.lire(competitionId), copieLe };
    },

    /** US-022 CA-2 : envoie ce qui attend maintenant, puis à chaque retour du réseau ; renvoie de quoi arrêter. */
    surveiller(cible: EventTarget = window): () => void {
      const auRetour = () => void envoyerTout();
      cible.addEventListener('online', auRetour);
      auRetour();
      return () => cible.removeEventListener('online', auRetour);
    },
  };
}
