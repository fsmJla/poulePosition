// Réplication du journal des épreuves (US-022, ADR-0016, docs/protocole.md §11) : le PC pilote envoie au serveur, par
// lots, les événements qui suivent le dernier seq confirmé ; les autres PC du club listent les épreuves et en
// téléchargent une copie en lecture seule. Sans réseau, rien n'est perdu : les événements attendent dans IndexedDB et
// partent au retour de la connexion.
import type { EpreuveRattachee, Projection } from '@poule-position/domaine';
import {
  analyserReponseEpreuves,
  analyserReponseEnvoi,
  analyserReponseJournal,
  analyserReponsePilote,
  analyserReponseTicket,
  analyserReponsePriseDeMain,
  analyserReponseSuppressionEpreuve,
  preparerLots,
  resumeDe,
  type EpreuveIndexee,
  type ErreurReponse,
} from '@poule-position/protocole';
import { DELAI_REPONSE } from './session';
import type { Contexte, Journal } from './journal';

/** Résultat d'un envoi : tout est confirmé, il reste des événements à envoyer, ou l'envoi est bloqué. */
/** `reprise-requise` : épreuve reprise d'un fichier, rien ne part tant que ce PC n'a pas pris la main (US-035 CA-5). */
export type EtatEnvoi = 'a-jour' | 'en-attente' | 'session-expiree' | 'pas-pilote' | 'supprimee' | 'reprise-requise';

/** US-029 : ce PC n'est plus le pilote ; `ecartes` modifications faites hors ligne n'ont pas été reprises. */
export interface PerteDeMain {
  epreuveId: string;
  piloteAppareil: string;
  piloteNom: string;
  ecartes: number;
}

/** US-039 : la copie locale d'une épreuve supprimée sur le serveur vient d'être effacée. */
export interface SuppressionLocale {
  epreuveId: string;
  nom: string;
  /** Événements saisis ici mais pas encore envoyés, abandonnés avec la copie. */
  abandonnees: number;
}

/** Date du jour au format des épreuves (AAAA-MM-JJ), à l'heure locale. */
export function dateDuJour(instant: number): string {
  const jour = new Date(instant);
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${jour.getFullYear()}-${deux(jour.getMonth() + 1)}-${deux(jour.getDate())}`;
}

export type ErreurSynchronisation =
  | 'HORS_LIGNE'
  | 'SESSION_INVALIDE'
  | 'EPREUVE_INCONNUE'
  | 'ERREUR_INATTENDUE'
  | 'ACCES_REFUSE'
  | 'EPREUVE_EN_COURS'
  | 'EPREUVE_SUPPRIMEE';

/** Copie d'une épreuve : la projection de son journal, et la date du téléchargement (null si pilotée ici). */
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
  async function requete(
    chemin: string,
    jetonSession: string,
    corps?: unknown,
    methode: 'GET' | 'POST' | 'DELETE' = corps === undefined ? 'GET' : 'POST',
  ): Promise<unknown> {
    let reponse: Response;
    try {
      reponse = await envoyer(`${urlServeur}${chemin}`, {
        method: methode,
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

  async function envoyerMaintenant(epreuveId: string): Promise<EtatEnvoi> {
    if ((await journal.etat(epreuveId))?.reprise) return 'reprise-requise';
    for (let tour = 0; tour < TOURS_MAX; tour++) {
      const evenements = await journal.aEnvoyer(epreuveId);
      if (evenements.length === 0) return 'a-jour';
      const jetonSession = await jetonEnLigne();
      if (!jetonSession) return 'en-attente';
      const { epreuve } = await journal.lire(epreuveId);
      if (!epreuve) return 'en-attente';
      const lots = preparerLots(await journal.appareil(), evenements, resumeDe(epreuve));
      for (const lot of lots) {
        let reponse;
        try {
          reponse = analyserReponseEnvoi(await requete(`/epreuves/${epreuveId}/evenements`, jetonSession, lot));
        } catch {
          return 'en-attente';
        }
        if (reponse.ok) {
          await journal.confirmer(epreuveId, reponse.dernierSeq);
          ecouteursEnvoi.forEach((ecouteur) => ecouteur(epreuveId));
          continue;
        }
        if (reponse.erreur === 'PAS_PILOTE') {
          await perdre(epreuveId, reponse);
          return 'pas-pilote';
        }
        if (reponse.erreur === 'EPREUVE_SUPPRIMEE') {
          await effacerSupprimee(epreuveId);
          return 'supprimee';
        }
        if (SESSION_REFUSEE.includes(reponse.erreur)) return 'session-expiree';
        if (reponse.erreur !== 'SEQ_INATTENDU' || reponse.dernierSeq === undefined) return 'en-attente';
        // Le serveur a un autre dernier seq (accusé perdu, lot renvoyé) : on reprend de là.
        await journal.confirmer(epreuveId, reponse.dernierSeq);
        break;
      }
    }
    return 'en-attente';
  }

  /** Un seul envoi à la fois par épreuve : un appel pendant un envoi en cours en partage le résultat. */
  const envoisEnCours = new Map<string, Promise<EtatEnvoi>>();

  function envoyerEpreuve(epreuveId: string): Promise<EtatEnvoi> {
    const enCours = envoisEnCours.get(epreuveId);
    if (enCours) return enCours;
    const envoi = envoyerMaintenant(epreuveId).finally(() => envoisEnCours.delete(epreuveId));
    envoisEnCours.set(epreuveId, envoi);
    return envoi;
  }

  /** Envoie tout ce qui attend, pour chaque épreuve pilotée ici (démarrage, retour du réseau). */
  async function envoyerTout(): Promise<void> {
    const locales = await journal.epreuvesLocales();
    await Promise.all(locales.filter(({ pilote }) => pilote).map(({ epreuveId }) => envoyerEpreuve(epreuveId)));
  }

  const ecouteursPerte = new Set<(perte: PerteDeMain) => void>();
  /** US-094 : un lot vient d'être accepté par le serveur (l'épreuve y existe : sa WebSocket peut s'ouvrir). */
  const ecouteursEnvoi = new Set<(epreuveId: string) => void>();
  const ecouteursSuppression = new Set<(suppression: SuppressionLocale) => void>();

  /**
   * US-039 CA-5 et CA-6 : le serveur dit l’épreuve supprimée. La copie locale est effacée, avec les saisies pas
   * encore envoyées (la suppression prime), puis les écouteurs en sont avertis, une seule fois. Sans copie locale, il
   * n'y a rien à effacer ni à annoncer.
   */
  async function effacerSupprimee(epreuveId: string): Promise<void> {
    if (!(await journal.etat(epreuveId))) return;
    const { epreuve } = await journal.lire(epreuveId);
    const abandonnees = await journal.supprimerCopie(epreuveId);
    const suppression = { epreuveId, nom: epreuve?.nom ?? '', abandonnees };
    ecouteursSuppression.forEach((ecouteur) => ecouteur(suppression));
  }

  /** US-029 : un autre PC a pris la main ; les événements en attente sont écartés et la copie du nouveau pilote la remplace. */
  async function perdre(
    epreuveId: string,
    pilote: { piloteAppareil?: string; piloteNom?: string },
  ): Promise<PerteDeMain> {
    const ecartes = await journal.ecarter(epreuveId, pilote, maintenant());
    await telechargerCopie(epreuveId);
    const perte = {
      epreuveId,
      piloteAppareil: pilote.piloteAppareil ?? '',
      piloteNom: pilote.piloteNom ?? '',
      ecartes,
    };
    ecouteursPerte.forEach((ecouteur) => ecouteur(perte));
    return perte;
  }

  function erreurDe(erreur: ErreurReponse): ErreurSynchronisation {
    if (SESSION_REFUSEE.includes(erreur)) return 'SESSION_INVALIDE';
    const connues = ['EPREUVE_INCONNUE', 'ACCES_REFUSE', 'EPREUVE_EN_COURS', 'EPREUVE_SUPPRIMEE'] as const;
    return connues.find((connue) => connue === erreur) ?? 'ERREUR_INATTENDUE';
  }

  async function copieLocale(epreuveId: string): Promise<Copie | null> {
    const etat = await journal.etat(epreuveId);
    return etat ? { projection: await journal.lire(epreuveId), copieLe: etat.copieLe } : null;
  }

  /**
   * US-022 CA-4 : copie à jour d'une épreuve pilotée par un autre PC, téléchargée puis projetée localement ; sur
   * le PC pilote, son propre journal. En cas d'échec, la dernière copie gardée (avec sa date) est jointe. Si le serveur
   * désigne déjà ce PC comme pilote (prise de main interrompue, US-029), la copie devient le journal du pilote.
   */
  async function telechargerCopie(
    epreuveId: string,
  ): Promise<({ ok: true } & Copie) | { ok: false; erreur: ErreurSynchronisation; copie?: Copie }> {
    const locale = await copieLocale(epreuveId);
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
      reponse = analyserReponseJournal(await requete(`/epreuves/${epreuveId}/evenements`, jetonSession));
    } catch {
      return echec('HORS_LIGNE');
    }
    if (!reponse.ok) {
      if (reponse.erreur === 'EPREUVE_SUPPRIMEE') {
        await effacerSupprimee(epreuveId);
        return { ok: false, erreur: 'EPREUVE_SUPPRIMEE' };
      }
      return echec(erreurDe(reponse.erreur));
    }
    if (reponse.piloteAppareil === (await journal.appareil())) {
      await journal.devenirPilote(epreuveId, reponse.evenements);
      return { ok: true, projection: await journal.lire(epreuveId), copieLe: null };
    }
    const copieLe = maintenant();
    await journal.remplacerCopie(epreuveId, reponse.evenements, copieLe);
    return { ok: true, projection: await journal.lire(epreuveId), copieLe };
  }

  type Refus = { ok: false; erreur: ErreurSynchronisation };
  const sansReseau = (): Refus => ({ ok: false, erreur: enLigne() && urlServeur ? 'SESSION_INVALIDE' : 'HORS_LIGNE' });

  /**
   * US-094 CA-1 (ADR-0028) : ticket de 60 s pour ouvrir la WebSocket du pilote. Un ancien pilote apprend ainsi qu'il a
   * perdu la main : la perte est traitée et renvoyée.
   */
  async function demanderTicket(
    epreuveId: string,
  ): Promise<{ ok: true; ticket: string } | Refus | { ok: false; perte: PerteDeMain }> {
    const jetonSession = await jetonEnLigne();
    if (!jetonSession) return sansReseau();
    let reponse;
    try {
      const corps = { appareilId: await journal.appareil() };
      reponse = analyserReponseTicket(await requete(`/epreuves/${epreuveId}/ticket`, jetonSession, corps));
    } catch {
      return { ok: false, erreur: 'HORS_LIGNE' };
    }
    if (reponse.ok) return { ok: true, ticket: reponse.ticket };
    if (reponse.erreur === 'PAS_PILOTE') return { ok: false, perte: await perdre(epreuveId, reponse) };
    if (reponse.erreur === 'EPREUVE_SUPPRIMEE') await effacerSupprimee(epreuveId);
    return { ok: false, erreur: erreurDe(reponse.erreur) };
  }

  /**
   * US-094 (ADR-0028) : épreuves dont ce PC ouvre la WebSocket : pilotées ici, pas reprises d'un fichier (US-035 : elles
   * perdraient la main avant d'avoir pu la prendre), « En cours », ou « En préparation » datées du jour ou sans date.
   */
  async function epreuvesAPresence(): Promise<string[]> {
    const aujourdhui = dateDuJour(maintenant());
    const locales = await journal.epreuvesLocales();
    const retenues = await Promise.all(
      locales
        .filter(({ pilote, reprise }) => pilote && !reprise)
        .map(async ({ epreuveId }) => {
          const { epreuve } = await journal.lire(epreuveId);
          if (!epreuve) return null;
          const duJour = epreuve.date === null || epreuve.date === aujourdhui;
          return epreuve.statut === 'enCours' || (epreuve.statut === 'preparation' && duJour) ? epreuveId : null;
        }),
    );
    return retenues.filter((id): id is string => id !== null);
  }

  /**
   * US-094 CA-4 : le serveur a fermé la WebSocket parce qu'un autre PC a pris la main : la perte est traitée comme pour
   * un lot refusé, avec le pilote en place lu sur le serveur.
   */
  async function perteSignalee(epreuveId: string): Promise<PerteDeMain | null> {
    if ((await journal.etat(epreuveId))?.pilote !== true) return null;
    const jetonSession = await jetonEnLigne();
    let pilote: { piloteAppareil?: string; piloteNom?: string } = {};
    if (jetonSession) {
      try {
        const reponse = analyserReponsePilote(await requete(`/epreuves/${epreuveId}/pilote`, jetonSession));
        if (reponse.ok) pilote = reponse;
      } catch {
        // Le nom du nouveau pilote manquera ; la perte est traitée quand même.
      }
    }
    return perdre(epreuveId, pilote);
  }

  return {
    /** US-022 CA-1 / CA-2 : envoie les événements non confirmés de l’épreuve. */
    envoyer: envoyerEpreuve,

    envoyerTout,

    /** Nombre de modifications en attente d'envoi (indicateur, hors ligne). */
    async enAttente(epreuveId: string): Promise<number> {
      return (await journal.aEnvoyer(epreuveId)).length;
    },

    /** Vrai pour une épreuve pilotée ici dont rien n'est encore parvenu au serveur (« Pas encore envoyée »). */
    async jamaisEnvoyee(epreuveId: string): Promise<boolean> {
      const etat = await journal.etat(epreuveId);
      return Boolean(etat?.pilote && etat.confirme === 0);
    },

    /** US-022 CA-4 : index des épreuves du club. */
    async listerEpreuvesDuClub(): Promise<
      { ok: true; epreuves: EpreuveIndexee[] } | { ok: false; erreur: ErreurSynchronisation }
    > {
      const jetonSession = await jetonEnLigne();
      if (!jetonSession) return { ok: false, erreur: enLigne() && urlServeur ? 'SESSION_INVALIDE' : 'HORS_LIGNE' };
      try {
        const reponse = analyserReponseEpreuves(await requete('/epreuves', jetonSession));
        if (!reponse.ok) return { ok: false, erreur: erreurDe(reponse.erreur) };
        // US-039 CA-5 : les copies locales des épreuves supprimées sont effacées, et la liste ne les montre plus.
        for (const id of reponse.supprimees) await effacerSupprimee(id);
        return { ok: true, epreuves: reponse.epreuves.filter(({ id }) => !reponse.supprimees.includes(id)) };
      } catch {
        return { ok: false, erreur: 'HORS_LIGNE' };
      }
    },

    /**
     * US-039 CA-1 : supprime définitivement l’épreuve sur le serveur (administrateur, en ligne), puis efface la
     * copie de ce PC sans l'annoncer : c'est l'administrateur qui l'a demandé. Hors ligne, rien n'est tenté (CA-8).
     */
    async supprimerEpreuve(epreuveId: string): Promise<{ ok: true } | { ok: false; erreur: ErreurSynchronisation }> {
      const jetonSession = await jetonEnLigne();
      if (!jetonSession) return sansReseau();
      let reponse;
      try {
        reponse = analyserReponseSuppressionEpreuve(
          await requete(`/epreuves/${epreuveId}`, jetonSession, undefined, 'DELETE'),
        );
      } catch {
        return { ok: false, erreur: 'HORS_LIGNE' };
      }
      if (!reponse.ok) return { ok: false, erreur: erreurDe(reponse.erreur) };
      await journal.supprimerCopie(epreuveId);
      return { ok: true };
    },

    /** US-039 CA-5 : avertit quand une épreuve de cet appareil est effacée parce qu'elle a été supprimée. */
    surSuppression(ecouteur: (suppression: SuppressionLocale) => void): () => void {
      ecouteursSuppression.add(ecouteur);
      return () => ecouteursSuppression.delete(ecouteur);
    },

    /**
     * US-023 CA-4 : épreuves du club connues de cet appareil, pour les confronter aux dates d'une manifestation :
     * l'index du club (s'il est joignable) et les épreuves gardées ici, y compris celles pas encore envoyées, dont
     * la version locale l'emporte.
     */
    async epreuvesConnues(): Promise<EpreuveRattachee[]> {
      const connues = new Map<string, EpreuveRattachee>();
      const index = await this.listerEpreuvesDuClub();
      if (index.ok) {
        for (const { id, nom, date, rattachement } of index.epreuves) connues.set(id, { id, nom, date, rattachement });
      }
      for (const { epreuveId } of await journal.epreuvesLocales()) {
        const { epreuve } = await journal.lire(epreuveId);
        if (epreuve) {
          const { id, nom, date, rattachement } = epreuve;
          connues.set(id, { id, nom, date, rattachement });
        }
      }
      return [...connues.values()];
    },

    telechargerCopie,

    /** US-029 CA-4 : qui pilote l’épreuve, et s'il est connecté. */
    async pilote(
      epreuveId: string,
    ): Promise<{ ok: true; piloteAppareil: string; piloteNom: string; connecte: boolean } | Refus> {
      const jetonSession = await jetonEnLigne();
      if (!jetonSession) return sansReseau();
      try {
        const reponse = analyserReponsePilote(await requete(`/epreuves/${epreuveId}/pilote`, jetonSession));
        return reponse.ok ? reponse : { ok: false, erreur: erreurDe(reponse.erreur) };
      } catch {
        return { ok: false, erreur: 'HORS_LIGNE' };
      }
    },

    /**
     * US-029 CA-1 : prend la main sur l’épreuve. Le serveur désigne ce PC (il exige que `piloteAttendu` soit encore
     * le pilote en place), le journal complet remplace la copie locale, puis `PiloteChange` est écrit et envoyé.
     */
    async prendreLaMain(
      epreuveId: string,
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
        reponse = analyserReponsePriseDeMain(await requete(`/epreuves/${epreuveId}/pilote`, jetonSession, corps));
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
      await journal.devenirPilote(epreuveId, reponse.evenements);
      if (reponse.ancienAppareil !== appareilId) {
        const ecrit = await journal.enregistrer(
          epreuveId,
          { type: 'PiloteChange', donnees: { ancienAppareil: reponse.ancienAppareil, nouvelAppareil: appareilId } },
          contexte,
        );
        if ('erreur' in ecrit) return { ok: false, erreur: 'ERREUR_INATTENDUE' };
      }
      await envoyerEpreuve(epreuveId);
      return { ok: true };
    },

    /**
     * US-035 CA-5 et CA-6 : au retour en ligne, ce PC reprend la main sur une épreuve importée d'un fichier. Si le serveur ne
     * la connaît pas, les événements partent tels quels ; sinon il désigne ce PC (comme US-029) et son journal est comparé au
     * journal local : s'il n'a pas avancé, les événements locaux sont envoyés ; sinon le journal du serveur est repris et les
     * événements locaux qu'il n'a pas sont mis de côté, sans fusion (`ecartes` en donne le nombre).
     */
    async reprendreApresImport(
      epreuveId: string,
      contexte: Contexte,
    ): Promise<
      | { ok: true; ecartes: number }
      | Refus
      | { ok: false; erreur: 'MAIN_DEJA_PRISE'; piloteAppareil: string; piloteNom: string }
    > {
      const jetonSession = await jetonEnLigne();
      if (!jetonSession) return sansReseau();
      const appareilId = await journal.appareil();
      let lecture;
      try {
        lecture = analyserReponseJournal(await requete(`/epreuves/${epreuveId}/evenements`, jetonSession));
      } catch {
        return { ok: false, erreur: 'HORS_LIGNE' };
      }
      if (!lecture.ok) {
        if (lecture.erreur === 'EPREUVE_SUPPRIMEE') {
          await effacerSupprimee(epreuveId);
          return { ok: false, erreur: 'EPREUVE_SUPPRIMEE' };
        }
        if (lecture.erreur !== 'EPREUVE_INCONNUE') return { ok: false, erreur: erreurDe(lecture.erreur) };
        // Le serveur ne la connaît pas : le premier lot en fera ce PC le pilote.
        await journal.reprendre(epreuveId, [], maintenant());
        await envoyerEpreuve(epreuveId);
        return { ok: true, ecartes: 0 };
      }
      let serveur = lecture.evenements;
      let ancienAppareil = appareilId;
      if (lecture.piloteAppareil !== appareilId) {
        let prise;
        try {
          const corps = { appareilId, piloteAttendu: lecture.piloteAppareil };
          prise = analyserReponsePriseDeMain(await requete(`/epreuves/${epreuveId}/pilote`, jetonSession, corps));
        } catch {
          return { ok: false, erreur: 'HORS_LIGNE' };
        }
        if (!prise.ok) {
          if (prise.erreur !== 'MAIN_DEJA_PRISE') return { ok: false, erreur: erreurDe(prise.erreur) };
          return {
            ok: false,
            erreur: 'MAIN_DEJA_PRISE',
            piloteAppareil: prise.piloteAppareil ?? '',
            piloteNom: prise.piloteNom ?? '',
          };
        }
        serveur = prise.evenements;
        ancienAppareil = prise.ancienAppareil;
      }
      const ecartes = await journal.reprendre(epreuveId, serveur, maintenant());
      if (ancienAppareil !== appareilId) {
        const ecrit = await journal.enregistrer(
          epreuveId,
          { type: 'PiloteChange', donnees: { ancienAppareil, nouvelAppareil: appareilId } },
          contexte,
        );
        if ('erreur' in ecrit) return { ok: false, erreur: 'ERREUR_INATTENDUE' };
      }
      await envoyerEpreuve(epreuveId);
      return { ok: true, ecartes };
    },

    demanderTicket,

    epreuvesAPresence,

    perteSignalee,

    /** US-029 CA-2 : avertit quand un autre PC prend la main ; renvoie de quoi arrêter d'écouter. */
    /** US-094 : prévient à chaque lot accepté par le serveur ; renvoie de quoi arrêter d'écouter. */
    surEnvoi(ecouteur: (epreuveId: string) => void): () => void {
      ecouteursEnvoi.add(ecouteur);
      return () => ecouteursEnvoi.delete(ecouteur);
    },

    surPerte(ecouteur: (perte: PerteDeMain) => void): () => void {
      ecouteursPerte.add(ecouteur);
      return () => ecouteursPerte.delete(ecouteur);
    },

    /** US-022 CA-2 : envoie ce qui attend maintenant, puis à chaque retour du réseau ; renvoie de quoi arrêter. */
    surveiller(cible: EventTarget = window): () => void {
      // US-039 CA-5 : lire l'index du club suffit à effacer les copies des épreuves supprimées.
      const auRetour = () => {
        void envoyerTout();
        void this.listerEpreuvesDuClub();
      };
      cible.addEventListener('online', auRetour);
      auRetour();
      // US-094 : la présence du pilote passe par sa WebSocket (presence-pilote.ts) ; il n'y a plus de battement.
      return () => cible.removeEventListener('online', auRetour);
    },
  };
}

export type Synchronisation = ReturnType<typeof creerSynchronisation>;
