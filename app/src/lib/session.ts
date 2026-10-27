// Connexion, session et déconnexion (US-003, docs/protocole.md §7), changement de mot de passe (US-010, §8). Le mot
// de passe ne quitte jamais l'appareil : seule la clé dérivée est envoyée. La session est gardée dans IndexedDB et
// reste utilisable hors ligne (ADR-0001). Reconnexion hors ligne sur un appareil connu, puis revalidation au retour en
// ligne (US-005, ADR-0006). Gestion des comptes par les administrateurs (US-007 à US-009, §9).
import {
  essaisVides,
  expirationSession,
  noterEchec,
  normaliserEmail,
  saisieBloquee,
  sessionExpiree,
  REGLE_LOCALE,
  type Role,
} from '@poule-position/domaine';
import {
  analyserReponseCompte,
  analyserReponseComptes,
  analyserReponseSel,
  analyserReponseSession,
  analyserReponseSuppression,
  deriverCle,
  preparerChangementMotDePasse,
  preparerCreationCompte,
  preparerReinitialisation,
  verificateurLocal,
  type CompteResume,
  type DemandeModificationCompte,
  type ErreurReponse,
  type Session,
} from '@poule-position/protocole';
import { estLocale, type SessionAppareil, type SessionLocale, type Stockage } from './stockage';

/** Délai maximal d'attente du serveur avant de passer à la connexion locale, en millisecondes. */
export const DELAI_REPONSE = 10_000;

export type ErreurConnexion =
  | 'IDENTIFIANTS_INVALIDES'
  | 'COMPTE_DESACTIVE'
  /** US-005 CA-3 : hors ligne, compte jamais connecté en ligne sur cet appareil. */
  | 'PREMIERE_CONNEXION_HORS_LIGNE'
  /** US-005 CA-4 : frein local, trop de mots de passe faux sur l'appareil. */
  | 'TROP_D_ESSAIS'
  | 'SERVEUR_NON_CONFIGURE'
  | 'ERREUR_INATTENDUE';

export type ResultatConnexion = { ok: true; session: SessionAppareil } | { ok: false; erreur: ErreurConnexion };

/**
 * Pourquoi la session a été fermée par l'application, à expliquer sur l'écran de connexion : compte modifié ou
 * retiré ailleurs (US-005 CA-6), ou session locale qu'on ne peut plus revalider seule (US-005 CA-5).
 */
export type MotifFinSession = 'COMPTE_MODIFIE' | 'RECONNEXION_REQUISE';

/** `sessionStorage` de l'onglet : la clé d'une session locale y survit à un rechargement, pas à la fermeture. */
export type MemoireOnglet = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Entrée de la mémoire de l'onglet qui garde la clé de la session locale (US-005 CA-5). */
const CLE_ONGLET = 'poulePosition.cleSessionLocale';

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
  /** null : pas de mémoire d'onglet (la session locale ne survit pas à un rechargement). */
  memoireOnglet?: MemoireOnglet | null;
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
  memoireOnglet = typeof sessionStorage === 'undefined' ? null : sessionStorage,
}: OptionsClientSession) {
  /** Envoie une requête et lit sa réponse JSON ; lève Injoignable si le serveur ne répond pas à temps. */
  async function requete(
    chemin: string,
    signal: AbortSignal,
    init: { methode: 'GET' | 'POST' | 'PATCH' | 'DELETE'; corps?: unknown; jeton?: string },
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

  /** Motif de la dernière fermeture de session par l'application, lu une fois par l'écran de connexion. */
  let motifFin: MotifFinSession | null = null;

  /**
   * US-005 CA-5 : clé de la session locale, gardée en mémoire et dans la mémoire de l'onglet (jamais dans IndexedDB :
   * elle vaut un mot de passe pour le serveur), pour la revalider au retour en ligne.
   */
  function garderCleLocale(email: string, cle: string): void {
    cleEnMemoire = { email, cle };
    try {
      memoireOnglet?.setItem(CLE_ONGLET, JSON.stringify({ email, cle }));
    } catch {
      // Mémoire d'onglet indisponible : la revalidation demandera de se reconnecter.
    }
  }

  function cleLocale(email: string): string | null {
    if (cleEnMemoire?.email === email) return cleEnMemoire.cle;
    try {
      const gardee = JSON.parse(memoireOnglet?.getItem(CLE_ONGLET) ?? 'null') as { email?: unknown; cle?: unknown };
      return gardee?.email === email && typeof gardee.cle === 'string' ? gardee.cle : null;
    } catch {
      return null;
    }
  }

  function oublierCles(): void {
    cleEnMemoire = null;
    oublierCleOnglet();
  }

  function oublierCleOnglet(): void {
    try {
      memoireOnglet?.removeItem(CLE_ONGLET);
    } catch {
      // Rien à effacer.
    }
  }

  /**
   * Compte modifié ou retiré ailleurs (US-010 CA-5, US-008 CA-5, US-005 CA-6) : session et vérificateur local
   * effacés, et l'écran de connexion dira pourquoi.
   */
  async function oublierCompte(email: string): Promise<void> {
    await stockage.effacerSession();
    oublierCles();
    await stockage.oublierAppareilConnu(email);
    motifFin = 'COMPTE_MODIFIE';
  }

  /** Session refusée (401) : effacée ; si le compte a été modifié ou retiré ailleurs, le vérificateur local aussi. */
  async function oublierSession(session: SessionAppareil, corps: unknown): Promise<void> {
    const refus = analyserReponseSession(corps);
    if (!refus.ok && (refus.erreur === 'COMPTE_MODIFIE' || refus.erreur === 'COMPTE_RETIRE')) {
      return oublierCompte(session.compte.email);
    }
    await stockage.effacerSession();
    oublierCles();
  }

  /**
   * US-005 CA-1 à CA-4 : connexion hors ligne avec le vérificateur local d'un compte déjà connecté en ligne sur cet
   * appareil, sous le frein local (5 mots de passe faux en 15 minutes bloquent la saisie 15 minutes).
   */
  async function connexionLocale(email: string, motDePasse: string): Promise<ResultatConnexion> {
    const essais = await stockage.lireEssaisLocaux();
    if (saisieBloquee(essais, maintenant())) return { ok: false, erreur: 'TROP_D_ESSAIS' };
    const connu = await stockage.lireAppareilConnu(email);
    if (!connu) return { ok: false, erreur: 'PREMIERE_CONNEXION_HORS_LIGNE' };
    const cle = await deriverCle(motDePasse, connu.sel);
    if ((await verificateurLocal(cle)) !== connu.verificateurLocal) {
      const apres = noterEchec(essais, maintenant(), REGLE_LOCALE);
      await stockage.ecrireEssaisLocaux(apres);
      return { ok: false, erreur: saisieBloquee(apres, maintenant()) ? 'TROP_D_ESSAIS' : 'IDENTIFIANTS_INVALIDES' };
    }
    await stockage.ecrireEssaisLocaux(essaisVides());
    const { nom, role, temporaire } = connu;
    const session: SessionLocale = {
      locale: true,
      expireLe: expirationSession(maintenant()),
      compte: { email, nom, role, temporaire },
    };
    await stockage.ecrireSession(session);
    garderCleLocale(email, cle);
    return { ok: true, session };
  }

  /**
   * US-005 CA-5 / CA-6 : de retour en ligne, la session locale devient une session en ligne par une connexion
   * normale avec la clé gardée. Identifiants refusés ou compte désactivé : le compte a changé entre-temps.
   */
  async function revaliderLocale(session: SessionLocale): Promise<SessionAppareil | null> {
    const { email } = session.compte;
    const cle = cleLocale(email);
    if (!cle) {
      await stockage.effacerSession();
      motifFin = 'RECONNEXION_REQUISE';
      return null;
    }
    let corps: unknown;
    try {
      corps = (await avecDelai((signal) => requete('/session', signal, { methode: 'POST', corps: { email, cle } })))
        .corps;
    } catch {
      return session;
    }
    const reponse = analyserReponseSession(corps);
    if (!reponse.ok) {
      if (reponse.erreur === 'IDENTIFIANTS_INVALIDES' || reponse.erreur === 'COMPTE_DESACTIVE') {
        await oublierCompte(email);
        return null;
      }
      return session;
    }
    await stockage.ecrireSession(reponse.session);
    const connu = await stockage.lireAppareilConnu(email);
    if (connu) {
      const { nom, role, temporaire } = reponse.session.compte;
      await stockage.enregistrerAppareilConnu({ ...connu, nom, role, temporaire });
    }
    oublierCleOnglet();
    return reponse.session;
  }

  /**
   * US-008 : après la désactivation ou la suppression de son propre compte, la session et le vérificateur local sont
   * effacés aussitôt (le serveur les refuserait au prochain appel). Vrai si c'était le compte de la session.
   */
  async function retirerSiSoiMeme(email: string): Promise<boolean> {
    const session = await stockage.lireSession();
    if (session?.compte.email !== email) return false;
    await stockage.effacerSession();
    oublierCles();
    await stockage.oublierAppareilConnu(email);
    return true;
  }

  /**
   * Appel d'une route réservée (US-007) avec la session gardée : réseau exigé, 401 → session oubliée. Renvoie le
   * corps de la réponse, ou l'erreur à afficher.
   */
  async function appelReserve(
    chemin: string,
    methode: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    corps?: unknown,
  ): Promise<{ ok: true; corps: unknown } | { ok: false; erreur: ErreurComptes }> {
    if (!urlServeur) return { ok: false, erreur: 'SERVEUR_NON_CONFIGURE' };
    const session = await stockage.lireSession();
    if (!session) return { ok: false, erreur: 'SESSION_INVALIDE' };
    // Une session locale n'a pas de jeton : elle doit d'abord être revalidée (US-005 CA-5).
    if (!enLigne() || estLocale(session)) return { ok: false, erreur: 'HORS_LIGNE' };
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
    /**
     * CA-1 à CA-3 : connexion en ligne ; garde la session et l'appareil connu (ADR-0006). Hors ligne, ou si le
     * serveur ne répond pas, connexion locale sur un appareil connu (US-005).
     */
    async seConnecter(emailSaisi: string, motDePasse: string): Promise<ResultatConnexion> {
      if (!urlServeur) return { ok: false, erreur: 'SERVEUR_NON_CONFIGURE' };
      const email = normaliserEmail(emailSaisi);
      if (!enLigne()) return connexionLocale(email, motDePasse);
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
            temporaire: session.compte.temporaire,
            connuDepuis: connu?.connuDepuis ?? maintenant(),
          });
          cleEnMemoire = { email, cle };
          return { ok: true, session };
        });
      } catch (erreur) {
        if (erreur instanceof Injoignable) return connexionLocale(email, motDePasse);
        throw erreur;
      }
    },

    /**
     * CA-4 : session gardée sur l'appareil, prolongée par le serveur si l'appareil est en ligne. Hors ligne, ou si le
     * serveur ne répond pas, elle reste utilisable telle quelle. CA-7 : un refus du serveur (401) l'efface. Une
     * session locale est revalidée (US-005 CA-5). Appelée au démarrage et à chaque retour en ligne.
     */
    async restaurer(): Promise<SessionAppareil | null> {
      const session = await stockage.lireSession();
      if (!session) return null;
      if (sessionExpiree(session.expireLe, maintenant())) {
        await stockage.effacerSession();
        oublierCles();
        return null;
      }
      if (!urlServeur || !enLigne()) return session;
      if (estLocale(session)) return revaliderLocale(session);
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
      oublierCles();
      await stockage.effacerSession();
    },

    /** US-005 CA-6 : pourquoi l'application a fermé la session, une seule fois (null s'il n'y a rien à dire). */
    lireMotifFin(): MotifFinSession | null {
      const motif = motifFin;
      motifFin = null;
      return motif;
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

    /**
     * US-008 CA-1 / CA-2 : désactive ou réactive un compte. `deconnecte` : c'était le compte de la session, qui est
     * fermée aussitôt.
     */
    async changerEtatCompte(
      id: string,
      actif: boolean,
    ): Promise<{ ok: true; compte: CompteResume; deconnecte: boolean } | { ok: false; erreur: ErreurComptes }> {
      const appel = await appelReserve(`/comptes/${encodeURIComponent(id)}`, 'PATCH', { actif });
      if (!appel.ok) return appel;
      const reponse = analyserReponseCompte(appel.corps);
      if (!reponse.ok) return { ok: false, erreur: erreurComptes(reponse.erreur) };
      const deconnecte = !actif && (await retirerSiSoiMeme(reponse.compte.email));
      return { ok: true, compte: reponse.compte, deconnecte };
    },

    /** US-008 CA-3 : supprime définitivement un compte ; s'il s'agit du sien, la session est fermée aussitôt. */
    async supprimerCompte(
      compte: Pick<CompteResume, 'id' | 'email'>,
    ): Promise<{ ok: true; deconnecte: boolean } | { ok: false; erreur: ErreurComptes }> {
      const appel = await appelReserve(`/comptes/${encodeURIComponent(compte.id)}`, 'DELETE');
      if (!appel.ok) return appel;
      const reponse = analyserReponseSuppression(appel.corps);
      if (!reponse.ok) return { ok: false, erreur: erreurComptes(reponse.erreur) };
      return { ok: true, deconnecte: await retirerSiSoiMeme(compte.email) };
    },

    /** US-009 CA-1 : nouveau mot de passe temporaire d'un compte, tiré ici et rendu une seule fois à l'appelant. */
    async reinitialiserMotDePasse(
      id: string,
    ): Promise<
      { ok: true; compte: CompteResume; motDePasseTemporaire: string } | { ok: false; erreur: ErreurComptes }
    > {
      const { demande, motDePasseTemporaire } = await preparerReinitialisation();
      const appel = await appelReserve(`/comptes/${encodeURIComponent(id)}/mot-de-passe`, 'POST', demande);
      if (!appel.ok) return appel;
      const reponse = analyserReponseCompte(appel.corps);
      return reponse.ok
        ? { ok: true, compte: reponse.compte, motDePasseTemporaire }
        : { ok: false, erreur: erreurComptes(reponse.erreur) };
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
      if (!enLigne() || estLocale(session)) return { ok: false, erreur: 'HORS_LIGNE' };
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
            temporaire: false,
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
