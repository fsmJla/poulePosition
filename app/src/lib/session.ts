// Connexion, session et déconnexion (US-003, docs/protocole.md §7). Le mot de passe ne quitte jamais l'appareil :
// seule la clé dérivée est envoyée. La session est gardée dans IndexedDB et reste utilisable hors ligne (ADR-0001).
import { normaliserEmail, sessionExpiree } from '@poule-position/domaine';
import {
  analyserReponseSel,
  analyserReponseSession,
  deriverCle,
  verificateurLocal,
  type ErreurReponse,
  type Session,
} from '@poule-position/protocole';
import type { Stockage } from './stockage';

/** Délai maximal d'attente du serveur avant d'afficher le message « hors ligne », en millisecondes. */
export const DELAI_REPONSE = 10_000;

export type ErreurConnexion =
  'IDENTIFIANTS_INVALIDES' | 'COMPTE_DESACTIVE' | 'HORS_LIGNE' | 'SERVEUR_NON_CONFIGURE' | 'ERREUR_INATTENDUE';

export type ResultatConnexion = { ok: true; session: Session } | { ok: false; erreur: ErreurConnexion };

export interface OptionsClientSession {
  /** Adresse HTTP du serveur (voir urlHttp) ; null s'il n'est pas configuré. */
  urlServeur: string | null;
  stockage: Stockage;
  envoyer?: typeof fetch;
  enLigne?: () => boolean;
  maintenant?: () => number;
  delai?: number;
}

/** Adresse HTTP du serveur, déduite de son adresse WebSocket (`VITE_URL_SERVEUR`), ou null. */
export function urlHttp(urlServeur: string | undefined): string | null {
  const base = urlServeur?.trim().replace(/\/+$/, '');
  if (!base || !/^wss?:\/\//.test(base)) return null;
  return base.replace(/^ws/, 'http');
}

/** Le serveur n'a pas répondu (réseau coupé, serveur injoignable ou délai dépassé). */
class Injoignable extends Error {}

const ERREURS_TRANSMISES: readonly ErreurReponse[] = [
  'IDENTIFIANTS_INVALIDES',
  'COMPTE_DESACTIVE',
  'SERVEUR_NON_CONFIGURE',
];

function erreurConnexion(erreur: ErreurReponse): ErreurConnexion {
  return ERREURS_TRANSMISES.includes(erreur) ? (erreur as ErreurConnexion) : 'ERREUR_INATTENDUE';
}

export function creerClientSession({
  urlServeur,
  stockage,
  envoyer = (...args) => fetch(...args),
  enLigne = () => navigator.onLine,
  maintenant = () => Date.now(),
  delai = DELAI_REPONSE,
}: OptionsClientSession) {
  /** Envoie une requête et lit sa réponse JSON ; lève Injoignable si le serveur ne répond pas à temps. */
  async function requete(
    chemin: string,
    signal: AbortSignal,
    init: { methode: 'GET' | 'POST'; corps?: unknown; jeton?: string },
  ): Promise<{ statut: number; corps: unknown }> {
    let reponse: Response;
    try {
      reponse = await envoyer(`${urlServeur}${chemin}`, {
        method: init.methode,
        signal,
        headers: {
          ...(init.corps !== undefined && { 'Content-Type': 'application/json' }),
          ...(init.jeton && { Authorization: `Bearer ${init.jeton}` }),
        },
        ...(init.corps !== undefined && { body: JSON.stringify(init.corps) }),
      });
    } catch {
      throw new Injoignable();
    }
    return { statut: reponse.status, corps: await reponse.json().catch(() => undefined) };
  }

  /** Signal annulé après le délai : l'ensemble des requêtes d'une opération tient dans ce délai. */
  function avecDelai<T>(operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
    const controleur = new AbortController();
    const minuterie = setTimeout(() => controleur.abort(), delai);
    return operation(controleur.signal).finally(() => clearTimeout(minuterie));
  }

  return {
    /** CA-1 à CA-3 : connexion en ligne ; garde la session et l'appareil connu (ADR-0006). */
    async seConnecter(emailSaisi: string, motDePasse: string): Promise<ResultatConnexion> {
      if (!urlServeur) return { ok: false, erreur: 'SERVEUR_NON_CONFIGURE' };
      if (!enLigne()) return { ok: false, erreur: 'HORS_LIGNE' };
      const email = normaliserEmail(emailSaisi);
      try {
        return await avecDelai(async (signal) => {
          const reponseSel = analyserReponseSel(
            (await requete('/session/sel', signal, { methode: 'POST', corps: { email } })).corps,
          );
          if (!reponseSel.ok) return { ok: false, erreur: erreurConnexion(reponseSel.erreur) };
          const cle = await deriverCle(motDePasse, reponseSel.sel);
          const reponse = analyserReponseSession(
            (await requete('/session', signal, { methode: 'POST', corps: { email, cle } })).corps,
          );
          if (!reponse.ok) return { ok: false, erreur: erreurConnexion(reponse.erreur) };
          const { session } = reponse;
          await stockage.ecrireSession(session);
          const connu = await stockage.lireAppareilConnu(email);
          await stockage.enregistrerAppareilConnu({
            email,
            nom: session.compte.nom,
            role: session.compte.role,
            sel: reponseSel.sel,
            verificateurLocal: await verificateurLocal(cle),
            connuDepuis: connu?.connuDepuis ?? maintenant(),
          });
          return { ok: true, session };
        });
      } catch (erreur) {
        if (erreur instanceof Injoignable) return { ok: false, erreur: 'HORS_LIGNE' };
        throw erreur;
      }
    },

    /**
     * CA-4 : session gardée sur l'appareil, prolongée par le serveur si l'appareil est en ligne. Hors ligne, ou si le
     * serveur ne répond pas, elle reste utilisable telle quelle. CA-7 : un refus du serveur (401) l'efface.
     */
    async restaurer(): Promise<Session | null> {
      const session = await stockage.lireSession();
      if (!session) return null;
      if (sessionExpiree(session.expireLe, maintenant())) {
        await stockage.effacerSession();
        return null;
      }
      if (!urlServeur || !enLigne()) return session;
      let reponse: { statut: number; corps: unknown };
      try {
        reponse = await avecDelai((signal) => requete('/session', signal, { methode: 'GET', jeton: session.jeton }));
      } catch {
        return session;
      }
      if (reponse.statut === 401) {
        await stockage.effacerSession();
        return null;
      }
      const prolongee = analyserReponseSession(reponse.corps);
      if (!prolongee.ok) return session;
      await stockage.ecrireSession(prolongee.session);
      return prolongee.session;
    },

    /** CA-5 : efface la session de l'appareil ; l'appareil reste connu pour la reconnexion hors ligne (US-005). */
    async seDeconnecter(): Promise<void> {
      await stockage.effacerSession();
    },
  };
}

export type ClientSession = ReturnType<typeof creerClientSession>;
