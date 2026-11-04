// Réplication du journal des compétitions (US-022, ADR-0016, docs/protocole.md §11) : le PC pilote envoie au serveur, par
// lots, les événements qui suivent le dernier seq confirmé ; les autres PC du club listent les compétitions et en
// téléchargent une copie en lecture seule. Sans réseau, rien n'est perdu : les événements attendent dans IndexedDB et
// partent au retour de la connexion.
import type { CompetitionRattachee, Projection } from '@poule-position/domaine';
import {
  analyserReponseCompetitions,
  analyserReponseEnvoi,
  analyserReponseJournal,
  analyserReponsePilote,
  analyserReponsePresence,
  analyserReponsePriseDeMain,
  preparerLots,
  resumeDe,
  type CompetitionIndexee,
  type ErreurReponse,
} from '@poule-position/protocole';
import { DELAI_REPONSE } from './session';
import type { Contexte, Journal } from './journal';

/** Résultat d'un envoi : tout est confirmé, il reste des événements à envoyer, ou l'envoi est bloqué. */
export type EtatEnvoi = 'a-jour' | 'en-attente' | 'session-expiree' | 'pas-pilote';

/** US-029 : ce PC n'est plus le pilote ; `ecartes` modifications faites hors ligne n'ont pas été reprises. */
export interface PerteDeMain {
  competitionId: string;
  piloteAppareil: string;
  piloteNom: string;
  ecartes: number;
}

/** Intervalle entre deux battements du pilote (US-029, ADR-0016 : présence provisoire en attendant la WebSocket). */
export const INTERVALLE_BATTEMENT = 30_000;

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
      const lots = preparerLots(await journal.appareil(), evenements, resumeDe(competition));
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
        if (reponse.erreur === 'PAS_PILOTE') {
          await perdre(competitionId, reponse);
          return 'pas-pilote';
        }
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

  const ecouteursPerte = new Set<(perte: PerteDeMain) => void>();

  /** US-029 : un autre PC a pris la main ; les événements en attente sont écartés et la copie du nouveau pilote la remplace. */
  async function perdre(
    competitionId: string,
    pilote: { piloteAppareil?: string; piloteNom?: string },
  ): Promise<PerteDeMain> {
    const ecartes = await journal.ecarter(competitionId, pilote, maintenant());
    await telechargerCopie(competitionId);
    const perte = {
      competitionId,
      piloteAppareil: pilote.piloteAppareil ?? '',
      piloteNom: pilote.piloteNom ?? '',
      ecartes,
    };
    ecouteursPerte.forEach((ecouteur) => ecouteur(perte));
    return perte;
  }

  function erreurDe(erreur: ErreurReponse): ErreurSynchronisation {
    if (SESSION_REFUSEE.includes(erreur)) return 'SESSION_INVALIDE';
    return erreur === 'COMPETITION_INCONNUE' ? erreur : 'ERREUR_INATTENDUE';
  }

  async function copieLocale(competitionId: string): Promise<Copie | null> {
    const etat = await journal.etat(competitionId);
    return etat ? { projection: await journal.lire(competitionId), copieLe: etat.copieLe } : null;
  }

  /**
   * US-022 CA-4 : copie à jour d'une compétition pilotée par un autre PC, téléchargée puis projetée localement ; sur
   * le PC pilote, son propre journal. En cas d'échec, la dernière copie gardée (avec sa date) est jointe. Si le serveur
   * désigne déjà ce PC comme pilote (prise de main interrompue, US-029), la copie devient le journal du pilote.
   */
  async function telechargerCopie(
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
    if (reponse.piloteAppareil === (await journal.appareil())) {
      await journal.devenirPilote(competitionId, reponse.evenements);
      return { ok: true, projection: await journal.lire(competitionId), copieLe: null };
    }
    const copieLe = maintenant();
    await journal.remplacerCopie(competitionId, reponse.evenements, copieLe);
    return { ok: true, projection: await journal.lire(competitionId), copieLe };
  }

  type Refus = { ok: false; erreur: ErreurSynchronisation };
  const sansReseau = (): Refus => ({ ok: false, erreur: enLigne() && urlServeur ? 'SESSION_INVALIDE' : 'HORS_LIGNE' });

  /** US-029 CA-2 : battement du pilote ; s'il n'est plus le pilote, la perte de main est traitée et renvoyée. */
  async function battre(competitionId: string): Promise<{ ok: true } | Refus | { ok: false; perte: PerteDeMain }> {
    const jetonSession = await jetonEnLigne();
    if (!jetonSession) return sansReseau();
    let reponse;
    try {
      const corps = { appareilId: await journal.appareil() };
      reponse = analyserReponsePresence(await requete(`/competitions/${competitionId}/presence`, jetonSession, corps));
    } catch {
      return { ok: false, erreur: 'HORS_LIGNE' };
    }
    if (reponse.ok) return { ok: true };
    if (reponse.erreur === 'PAS_PILOTE') return { ok: false, perte: await perdre(competitionId, reponse) };
    return { ok: false, erreur: erreurDe(reponse.erreur) };
  }

  /** US-029 : une compétition pas encore terminée, pilotée ici, doit battre. */
  async function battreTout(): Promise<void> {
    const locales = await journal.competitionsLocales();
    await Promise.all(
      locales
        .filter(({ pilote }) => pilote)
        .map(async ({ competitionId }) => {
          const { competition } = await journal.lire(competitionId);
          if (competition && competition.statut !== 'terminee' && competition.statut !== 'archivee') {
            await battre(competitionId);
          }
        }),
    );
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
     * US-023 CA-4 : compétitions du club connues de cet appareil, pour les confronter aux dates d'une manifestation :
     * l'index du club (s'il est joignable) et les compétitions gardées ici, y compris celles pas encore envoyées, dont
     * la version locale l'emporte.
     */
    async competitionsConnues(): Promise<CompetitionRattachee[]> {
      const connues = new Map<string, CompetitionRattachee>();
      const index = await this.listerCompetitionsDuClub();
      if (index.ok) {
        for (const { id, nom, date, rattachement } of index.competitions)
          connues.set(id, { id, nom, date, rattachement });
      }
      for (const { competitionId } of await journal.competitionsLocales()) {
        const { competition } = await journal.lire(competitionId);
        if (competition) {
          const { id, nom, date, rattachement } = competition;
          connues.set(id, { id, nom, date, rattachement });
        }
      }
      return [...connues.values()];
    },

    telechargerCopie,

    /** US-029 CA-4 : qui pilote la compétition, et s'il est connecté. */
    async pilote(
      competitionId: string,
    ): Promise<{ ok: true; piloteAppareil: string; piloteNom: string; connecte: boolean } | Refus> {
      const jetonSession = await jetonEnLigne();
      if (!jetonSession) return sansReseau();
      try {
        const reponse = analyserReponsePilote(await requete(`/competitions/${competitionId}/pilote`, jetonSession));
        return reponse.ok ? reponse : { ok: false, erreur: erreurDe(reponse.erreur) };
      } catch {
        return { ok: false, erreur: 'HORS_LIGNE' };
      }
    },

    /**
     * US-029 CA-1 : prend la main sur la compétition. Le serveur désigne ce PC (il exige que `piloteAttendu` soit encore
     * le pilote en place), le journal complet remplace la copie locale, puis `PiloteChange` est écrit et envoyé.
     */
    async prendreLaMain(
      competitionId: string,
      piloteAttendu: string,
      contexte: Contexte,
    ): Promise<
      { ok: true } | Refus | { ok: false; erreur: 'MAIN_DEJA_PRISE'; piloteAppareil: string; piloteNom: string }
    > {
      const jetonSession = await jetonEnLigne();
      if (!jetonSession) return sansReseau();
      const appareilId = await journal.appareil();
      let reponse;
      try {
        const corps = { appareilId, piloteAttendu };
        reponse = analyserReponsePriseDeMain(
          await requete(`/competitions/${competitionId}/pilote`, jetonSession, corps),
        );
      } catch {
        return { ok: false, erreur: 'HORS_LIGNE' };
      }
      if (!reponse.ok) {
        if (reponse.erreur !== 'MAIN_DEJA_PRISE') return { ok: false, erreur: erreurDe(reponse.erreur) };
        return {
          ok: false,
          erreur: 'MAIN_DEJA_PRISE',
          piloteAppareil: reponse.piloteAppareil ?? '',
          piloteNom: reponse.piloteNom ?? '',
        };
      }
      await journal.devenirPilote(competitionId, reponse.evenements);
      if (reponse.ancienAppareil !== appareilId) {
        const ecrit = await journal.enregistrer(
          competitionId,
          { type: 'PiloteChange', donnees: { ancienAppareil: reponse.ancienAppareil, nouvelAppareil: appareilId } },
          contexte,
        );
        if ('erreur' in ecrit) return { ok: false, erreur: 'ERREUR_INATTENDUE' };
      }
      await envoyerCompetition(competitionId);
      return { ok: true };
    },

    battre,

    battreTout,

    /** US-029 CA-2 : avertit quand un autre PC prend la main ; renvoie de quoi arrêter d'écouter. */
    surPerte(ecouteur: (perte: PerteDeMain) => void): () => void {
      ecouteursPerte.add(ecouteur);
      return () => ecouteursPerte.delete(ecouteur);
    },

    /** US-022 CA-2 : envoie ce qui attend maintenant, puis à chaque retour du réseau ; renvoie de quoi arrêter. */
    surveiller(cible: EventTarget = window, intervalle = INTERVALLE_BATTEMENT): () => void {
      const auRetour = () => void envoyerTout();
      cible.addEventListener('online', auRetour);
      auRetour();
      // US-029 : le pilote en ligne signale sa présence ; un ancien pilote apprend ainsi qu'il a perdu la main.
      const minuteur = setInterval(() => void battreTout(), intervalle);
      return () => {
        cible.removeEventListener('online', auRetour);
        clearInterval(minuteur);
      };
    },
  };
}

export type Synchronisation = ReturnType<typeof creerSynchronisation>;
