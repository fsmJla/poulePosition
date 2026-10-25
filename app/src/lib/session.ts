// Connexion, session et déconnexion (US-003, docs/protocole.md §7), changement de mot de passe (US-010, §8). Le mot
// de passe ne quitte jamais l'appareil : seule la clé dérivée est envoyée. La session est gardée dans IndexedDB et
// reste utilisable hors ligne (ADR-0001). Gestion des comptes par les administrateurs (US-007, §9).
import { normaliserEmail, sessionExpiree, type Role } from '@poule-position/domaine';
import {
  analyserReponseCompte,
  analyserReponseComptes,
  analyserReponseSel,
  analyserReponseSession,
  deriverCle,
  preparerChangementMotDePasse,
  preparerCreationCompte,
  verificateurLocal,
  type CompteResume,
  type DemandeModificationCompte,
  type ErreurReponse,
  type Session,
} from '@poule-position/protocole';
import type { Stockage } from './stockage';

/** Délai maximal d'attente du serveur avant d'afficher le message « hors ligne », en millisecondes. */
export const DELAI_REPONSE = 10_000;

export type ErreurConnexion =
  'IDENTIFIANTS_INVALIDES' | 'COMPTE_DESACTIVE' | 'HORS_LIGNE' | 'SERVEUR_NON_CONFIGURE' | 'ERREUR_INATTENDUE';

export type ResultatConnexion = { ok: true; session: Session } | { ok: false; erreur: ErreurConnexion };

export type ErreurChangementMotDePasse =
  | 'MOT_DE_PASSE_INCORRECT'
  /** Pas de mot de passe actuel saisi, ni de clé gardée depuis la connexion (page rechargée). */
  | 'MOT_DE_PASSE_ACTUEL_REQUIS'
  /** Session refusée par le serveur : elle est effacée, retour à la connexion. */
  | 'SESSION_INVALIDE'
  | 'HORS_LIGNE'
  | 'SERVEUR_NON_CONFIGURE'
  | 'ERREUR_INATTENDUE';

export type ResultatChangementMotDePasse =
  { ok: true; session: Session } | { ok: false; erreur: ErreurChangementMotDePasse };

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

/** Erreurs de la gestion des comptes (US-007), affichées par l'écran « Comptes ». */
export type ErreurComptes =
  | 'ACCES_REFUSE'
  | 'EMAIL_DEJA_UTILISE'
  | 'DERNIER_ADMINISTRATEUR'
  | 'COMPTE_INCONNU'
  | 'SESSION_INVALIDE'
  | 'HORS_LIGNE'
  | 'SERVEUR_NON_CONFIGURE'
  | 'ERREUR_INATTENDUE';

const ERREURS_COMPTES: readonly ErreurReponse[] = [
  'ACCES_REFUSE',
  'EMAIL_DEJA_UTILISE',
  'DERNIER_ADMINISTRATEUR',
  'COMPTE_INCONNU',
  'SERVEUR_NON_CONFIGURE',
];

function erreurComptes(erreur: ErreurReponse): ErreurComptes {
  return ERREURS_COMPTES.includes(erreur) ? (erreur as ErreurComptes) : 'ERREUR_INATTENDUE';
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
    init: { methode: 'GET' | 'POST' | 'PATCH'; corps?: unknown; jeton?: string },
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

  /**
   * Clé dérivée du mot de passe saisi à la connexion, gardée en mémoire seulement (jamais stockée) : elle évite de
   * redemander un mot de passe temporaire qu'on vient de saisir (US-010 CA-4).
   */
  let cleEnMemoire: { email: string; cle: string } | null = null;

  /** Session refusée (401) : effacée ; si le mot de passe a changé ailleurs, le vérificateur local aussi (US-010 CA-5). */
  async function oublierSession(session: Session, corps: unknown): Promise<void> {
    await stockage.effacerSession();
    cleEnMemoire = null;
    const refus = analyserReponseSession(corps);
    if (!refus.ok && refus.erreur === 'COMPTE_MODIFIE') await stockage.oublierAppareilConnu(session.compte.email);
  }

  /**
   * Appel d'une route réservée (US-007) avec la session gardée : réseau exigé, 401 → session oubliée. Renvoie le
   * corps de la réponse, ou l'erreur à afficher.
   */
  async function appelReserve(
    chemin: string,
    methode: 'GET' | 'POST' | 'PATCH',
    corps?: unknown,
  ): Promise<{ ok: true; corps: unknown } | { ok: false; erreur: ErreurComptes }> {
    if (!urlServeur) return { ok: false, erreur: 'SERVEUR_NON_CONFIGURE' };
    const session = await stockage.lireSession();
    if (!session) return { ok: false, erreur: 'SESSION_INVALIDE' };
    if (!enLigne()) return { ok: false, erreur: 'HORS_LIGNE' };
    try {
      const reponse = await avecDelai((signal) => requete(chemin, signal, { methode, corps, jeton: session.jeton }));
      if (reponse.statut === 401) {
        await oublierSession(session, reponse.corps);
        return { ok: false, erreur: 'SESSION_INVALIDE' };
      }
      return { ok: true, corps: reponse.corps };
    } catch (erreur) {
      if (erreur instanceof Injoignable) return { ok: false, erreur: 'HORS_LIGNE' };
      throw erreur;
    }
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
          cleEnMemoire = { email, cle };
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
        await oublierSession(session, reponse.corps);
        return null;
      }
      const prolongee = analyserReponseSession(reponse.corps);
      if (!prolongee.ok) return session;
      await stockage.ecrireSession(prolongee.session);
      return prolongee.session;
    },

    /** CA-5 : efface la session de l'appareil ; l'appareil reste connu pour la reconnexion hors ligne (US-005). */
    async seDeconnecter(): Promise<void> {
      cleEnMemoire = null;
      await stockage.effacerSession();
    },

    /** US-007 CA-1 : comptes du club (administrateurs seulement). */
    async listerComptes(): Promise<{ ok: true; comptes: CompteResume[] } | { ok: false; erreur: ErreurComptes }> {
      const appel = await appelReserve('/comptes', 'GET');
      if (!appel.ok) return appel;
      const reponse = analyserReponseComptes(appel.corps);
      return reponse.ok ? reponse : { ok: false, erreur: erreurComptes(reponse.erreur) };
    },

    /** US-007 CA-2 : crée un compte ; le mot de passe temporaire, tiré ici, n'est rendu qu'à l'appelant. */
    async creerCompte(saisie: {
      email: string;
      nom: string;
      role: Role;
    }): Promise<
      { ok: true; compte: CompteResume; motDePasseTemporaire: string } | { ok: false; erreur: ErreurComptes }
    > {
      const { demande, motDePasseTemporaire } = await preparerCreationCompte(saisie);
      const appel = await appelReserve('/comptes', 'POST', demande);
      if (!appel.ok) return appel;
      const reponse = analyserReponseCompte(appel.corps);
      return reponse.ok
        ? { ok: true, compte: reponse.compte, motDePasseTemporaire }
        : { ok: false, erreur: erreurComptes(reponse.erreur) };
    },

    /** US-007 CA-4 : modifie le nom ou le rôle d'un compte. */
    async modifierCompte(
      id: string,
      modification: DemandeModificationCompte,
    ): Promise<{ ok: true; compte: CompteResume } | { ok: false; erreur: ErreurComptes }> {
      const appel = await appelReserve(`/comptes/${encodeURIComponent(id)}`, 'PATCH', modification);
      if (!appel.ok) return appel;
      const reponse = analyserReponseCompte(appel.corps);
      return reponse.ok ? reponse : { ok: false, erreur: erreurComptes(reponse.erreur) };
    },

    /** US-010 CA-4 : vrai si le mot de passe actuel n'a pas à être ressaisi (saisi à la connexion, page non rechargée). */
    connaitMotDePasseActuel(): boolean {
      return cleEnMemoire !== null;
    },

    /**
     * US-010 : change le mot de passe. `actuel` vaut null pour reprendre la clé saisie à la connexion (CA-4). Le
     * vérificateur local n'est mis à jour qu'après la confirmation du serveur ; une coupure ne touche à rien.
     */
    async changerMotDePasse(actuel: string | null, nouveau: string): Promise<ResultatChangementMotDePasse> {
      if (!urlServeur) return { ok: false, erreur: 'SERVEUR_NON_CONFIGURE' };
      const session = await stockage.lireSession();
      if (!session) return { ok: false, erreur: 'SESSION_INVALIDE' };
      const { email } = session.compte;
      const memorisee = cleEnMemoire?.email === email ? cleEnMemoire.cle : null;
      if (actuel === null && !memorisee) return { ok: false, erreur: 'MOT_DE_PASSE_ACTUEL_REQUIS' };
      if (!enLigne()) return { ok: false, erreur: 'HORS_LIGNE' };
      try {
        return await avecDelai(async (signal): Promise<ResultatChangementMotDePasse> => {
          let cleActuelle = memorisee;
          if (actuel !== null) {
            // Sel actuel du compte, relu au serveur : il a pu changer depuis un autre appareil.
            const reponseSel = analyserReponseSel(
              (await requete('/session/sel', signal, { methode: 'POST', corps: { email } })).corps,
            );
            if (!reponseSel.ok) return { ok: false, erreur: 'ERREUR_INATTENDUE' };
            cleActuelle = await deriverCle(actuel, reponseSel.sel);
          }
          const demande = await preparerChangementMotDePasse(cleActuelle as string, nouveau);
          const { statut, corps } = await requete('/compte/mot-de-passe', signal, {
            methode: 'POST',
            corps: demande,
            jeton: session.jeton,
          });
          if (statut === 401) {
            await oublierSession(session, corps);
            return { ok: false, erreur: 'SESSION_INVALIDE' };
          }
          const reponse = analyserReponseSession(corps);
          if (!reponse.ok) {
            const erreur = reponse.erreur === 'MOT_DE_PASSE_INCORRECT' ? reponse.erreur : 'ERREUR_INATTENDUE';
            return { ok: false, erreur };
          }
          await stockage.ecrireSession(reponse.session);
          const connu = await stockage.lireAppareilConnu(email);
          await stockage.enregistrerAppareilConnu({
            email,
            nom: reponse.session.compte.nom,
            role: reponse.session.compte.role,
            sel: demande.sel,
            verificateurLocal: await verificateurLocal(demande.cle),
            connuDepuis: connu?.connuDepuis ?? maintenant(),
          });
          cleEnMemoire = { email, cle: demande.cle };
          return { ok: true, session: reponse.session };
        });
      } catch (erreur) {
        if (erreur instanceof Injoignable) return { ok: false, erreur: 'HORS_LIGNE' };
        throw erreur;
      }
    },
  };
}

export type ClientSession = ReturnType<typeof creerClientSession>;
