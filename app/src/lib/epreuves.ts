// Épreuves du club (US-024, docs/protocole.md §13) : données du club stockées par le serveur, modifiables en ligne
// seulement. La dernière liste reçue est gardée dans IndexedDB : hors ligne, elle reste consultable avec sa date.
import { validerEpreuve, type Arme, type DonneesEpreuve, type ErreursEpreuve } from '@poule-position/domaine';
import {
  analyserReponseEpreuve,
  analyserReponseEpreuves,
  analyserReponseSuppression,
  type Epreuve,
  type ErreurReponse,
} from '@poule-position/protocole';
import { DELAI_REPONSE } from './session';
import { Base, LIGNE_UNIQUE, type CopieEpreuves } from './stockage';

/** Champs du formulaire, tels que saisis : un texte vide est un champ non renseigné. */
export interface SaisieEpreuve {
  nom: string;
  arme: Arme | '';
  commentaire: string;
}

/** Erreurs affichées avec la liste des épreuves. */
export type ErreurEpreuves =
  | 'HORS_LIGNE'
  | 'SESSION_INVALIDE'
  | 'MANIFESTATION_INCONNUE'
  | 'EPREUVE_INCONNUE'
  | 'EPREUVE_NON_VIDE'
  | 'ERREUR_INATTENDUE';

export type ResultatEnregistrementEpreuve =
  | { ok: true; epreuve: Epreuve }
  | { ok: false; erreurs: ErreursEpreuve }
  /** Cas limite : modifiée par quelqu'un d'autre depuis le chargement ; la version courante est jointe. */
  | { ok: false; erreur: 'MODIFIEE_ENTRE_TEMPS'; epreuve: Epreuve }
  | { ok: false; erreur: ErreurEpreuves };

export interface OptionsEpreuves {
  /** Adresse HTTP du serveur (voir urlHttp) ; null s'il n'est pas configuré. */
  urlServeur: string | null;
  nomBase?: string;
  /** Jeton de la session en ligne ; null pour une session locale (US-005). */
  jeton: () => Promise<string | null>;
  envoyer?: typeof fetch;
  enLigne?: () => boolean;
  maintenant?: () => number;
  delai?: number;
}

/** CA-1 : formulaire vide. */
export function saisieVide(): SaisieEpreuve {
  return { nom: '', arme: '', commentaire: '' };
}

/** CA-3 : formulaire prérempli avec une épreuve existante. */
export function saisieDe({ nom, arme, commentaire }: Epreuve): SaisieEpreuve {
  return { nom, arme: arme ?? '', commentaire: commentaire ?? '' };
}

function versDonnees(manifestationId: string, { nom, arme, commentaire }: SaisieEpreuve): DonneesEpreuve {
  return {
    manifestationId,
    nom,
    arme: arme === '' ? null : arme,
    commentaire: commentaire === '' ? null : commentaire,
  };
}

const SESSION_REFUSEE: readonly ErreurReponse[] = ['SESSION_INVALIDE', 'COMPTE_MODIFIE', 'COMPTE_RETIRE'];

function erreurDe(erreur: ErreurReponse): ErreurEpreuves {
  if (SESSION_REFUSEE.includes(erreur)) return 'SESSION_INVALIDE';
  if (erreur === 'MANIFESTATION_INCONNUE' || erreur === 'EPREUVE_INCONNUE' || erreur === 'EPREUVE_NON_VIDE') {
    return erreur;
  }
  return 'ERREUR_INATTENDUE';
}

class Injoignable extends Error {}

export function creerClientEpreuves({
  urlServeur,
  nomBase = 'poulePosition',
  jeton,
  envoyer = (...args) => fetch(...args),
  enLigne = () => navigator.onLine,
  maintenant = () => Date.now(),
  delai = DELAI_REPONSE,
}: OptionsEpreuves) {
  const base = new Base(nomBase);

  /** Envoie une requête avec la session et lit sa réponse JSON ; lève Injoignable sans réseau ni session en ligne. */
  async function requete(methode: string, chemin: string, corps?: unknown): Promise<unknown> {
    const jetonSession = urlServeur && enLigne() ? await jeton() : null;
    if (!jetonSession) throw new Injoignable();
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

  async function copie(): Promise<CopieEpreuves | null> {
    const ligne = await base.copieEpreuves.get(LIGNE_UNIQUE);
    return ligne ? { epreuves: ligne.epreuves, copieLe: ligne.copieLe } : null;
  }

  async function enregistrer(
    methode: 'POST' | 'PATCH',
    chemin: string,
    corps: unknown,
  ): Promise<ResultatEnregistrementEpreuve> {
    let reponse;
    try {
      reponse = analyserReponseEpreuve(await requete(methode, chemin, corps));
    } catch {
      return { ok: false, erreur: 'HORS_LIGNE' };
    }
    if (reponse.ok) return reponse;
    if (reponse.erreur === 'MODIFIEE_ENTRE_TEMPS' && reponse.epreuve) {
      return { ok: false, erreur: 'MODIFIEE_ENTRE_TEMPS', epreuve: reponse.epreuve };
    }
    return { ok: false, erreur: erreurDe(reponse.erreur) };
  }

  return {
    copie,

    /** CA-1 : liste du club, gardée sur l'appareil ; en cas d'échec, la dernière copie est jointe. */
    async lister(): Promise<
      { ok: true; epreuves: Epreuve[] } | { ok: false; erreur: ErreurEpreuves; copie: CopieEpreuves | null }
    > {
      let reponse;
      try {
        reponse = analyserReponseEpreuves(await requete('GET', '/epreuves'));
      } catch {
        return { ok: false, erreur: 'HORS_LIGNE', copie: await copie() };
      }
      if (!reponse.ok) return { ok: false, erreur: erreurDe(reponse.erreur), copie: await copie() };
      const { epreuves } = reponse;
      await base.copieEpreuves.put({ cle: LIGNE_UNIQUE, epreuves, copieLe: maintenant() });
      return { ok: true, epreuves };
    },

    /** CA-1 et CA-2 : crée une épreuve dans une manifestation, après les règles du domaine. */
    async creer(manifestationId: string, saisie: SaisieEpreuve): Promise<ResultatEnregistrementEpreuve> {
      const donnees = versDonnees(manifestationId, saisie);
      const erreurs = validerEpreuve(donnees);
      if (Object.keys(erreurs).length > 0) return { ok: false, erreurs };
      return enregistrer('POST', '/epreuves', donnees);
    },

    /** CA-3 : modifie nom, arme et commentaire, à partir de la version chargée ; la manifestation ne change pas. */
    async modifier(depart: Epreuve, saisie: SaisieEpreuve): Promise<ResultatEnregistrementEpreuve> {
      const { manifestationId, ...donnees } = versDonnees(depart.manifestationId, saisie);
      const erreurs = validerEpreuve({ manifestationId, ...donnees });
      if (Object.keys(erreurs).length > 0) return { ok: false, erreurs };
      return enregistrer('PATCH', `/epreuves/${depart.id}`, { ...donnees, version: depart.version });
    },

    /** CA-5 : supprime une épreuve vide ; le serveur refuse une épreuve non vide. */
    async supprimer(id: string): Promise<{ ok: true } | { ok: false; erreur: ErreurEpreuves }> {
      let reponse;
      try {
        reponse = analyserReponseSuppression(await requete('DELETE', `/epreuves/${id}`));
      } catch {
        return { ok: false, erreur: 'HORS_LIGNE' };
      }
      return reponse.ok ? reponse : { ok: false, erreur: erreurDe(reponse.erreur) };
    },
  };
}

export type ClientEpreuves = ReturnType<typeof creerClientEpreuves>;
