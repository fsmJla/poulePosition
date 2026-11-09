// Compétitions du club (US-024, docs/protocole.md §13) : données du club stockées par le serveur, modifiables en ligne
// seulement. La dernière liste reçue est gardée dans IndexedDB : hors ligne, elle reste consultable avec sa date.
import {
  validerCompetition,
  type Arme,
  type DonneesCompetition,
  type ErreursCompetition,
} from '@poule-position/domaine';
import {
  analyserReponseCompetition,
  analyserReponseCompetitions,
  analyserReponseSuppression,
  analyserReponseSuppressionContenu,
  type Competition,
  type ErreurReponse,
} from '@poule-position/protocole';
import { DELAI_REPONSE } from './session';
import { Base, LIGNE_UNIQUE, type CopieCompetitions } from './stockage';
import { enchainerSuppressionContenu, type ResultatSuppressionContenu } from './suppression';

/** Champs du formulaire, tels que saisis : un texte vide est un champ non renseigné. */
export interface SaisieCompetition {
  nom: string;
  arme: Arme | '';
  commentaire: string;
}

/** Erreurs affichées avec la liste des compétitions. */
export type ErreurCompetitions =
  | 'HORS_LIGNE'
  | 'SESSION_INVALIDE'
  | 'MANIFESTATION_INCONNUE'
  | 'COMPETITION_INCONNUE'
  | 'COMPETITION_NON_VIDE'
  | 'ACCES_REFUSE'
  | 'EPREUVE_EN_COURS'
  | 'ERREUR_INATTENDUE';

export type ResultatEnregistrementCompetition =
  | { ok: true; competition: Competition }
  | { ok: false; erreurs: ErreursCompetition }
  /** Cas limite : modifiée par quelqu'un d'autre depuis le chargement ; la version courante est jointe. */
  | { ok: false; erreur: 'MODIFIEE_ENTRE_TEMPS'; competition: Competition }
  | { ok: false; erreur: ErreurCompetitions };

export interface OptionsCompetitions {
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
export function saisieVide(): SaisieCompetition {
  return { nom: '', arme: '', commentaire: '' };
}

/** CA-3 : formulaire prérempli avec une compétition existante. */
export function saisieDe({ nom, arme, commentaire }: Competition): SaisieCompetition {
  return { nom, arme: arme ?? '', commentaire: commentaire ?? '' };
}

function versDonnees(manifestationId: string, { nom, arme, commentaire }: SaisieCompetition): DonneesCompetition {
  return {
    manifestationId,
    nom,
    arme: arme === '' ? null : arme,
    commentaire: commentaire === '' ? null : commentaire,
  };
}

const SESSION_REFUSEE: readonly ErreurReponse[] = ['SESSION_INVALIDE', 'COMPTE_MODIFIE', 'COMPTE_RETIRE'];

function erreurDe(erreur: ErreurReponse): ErreurCompetitions {
  if (SESSION_REFUSEE.includes(erreur)) return 'SESSION_INVALIDE';
  const connues = [
    'MANIFESTATION_INCONNUE',
    'COMPETITION_INCONNUE',
    'COMPETITION_NON_VIDE',
    'ACCES_REFUSE',
    'EPREUVE_EN_COURS',
  ] as const;
  return connues.find((connue) => connue === erreur) ?? 'ERREUR_INATTENDUE';
}

class Injoignable extends Error {}

export function creerClientCompetitions({
  urlServeur,
  nomBase = 'poulePosition',
  jeton,
  envoyer = (...args) => fetch(...args),
  enLigne = () => navigator.onLine,
  maintenant = () => Date.now(),
  delai = DELAI_REPONSE,
}: OptionsCompetitions) {
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

  async function copie(): Promise<CopieCompetitions | null> {
    const ligne = await base.copieCompetitions.get(LIGNE_UNIQUE);
    return ligne ? { competitions: ligne.competitions, copieLe: ligne.copieLe } : null;
  }

  async function enregistrer(
    methode: 'POST' | 'PATCH',
    chemin: string,
    corps: unknown,
  ): Promise<ResultatEnregistrementCompetition> {
    let reponse;
    try {
      reponse = analyserReponseCompetition(await requete(methode, chemin, corps));
    } catch {
      return { ok: false, erreur: 'HORS_LIGNE' };
    }
    if (reponse.ok) return reponse;
    if (reponse.erreur === 'MODIFIEE_ENTRE_TEMPS' && reponse.competition) {
      return { ok: false, erreur: 'MODIFIEE_ENTRE_TEMPS', competition: reponse.competition };
    }
    return { ok: false, erreur: erreurDe(reponse.erreur) };
  }

  return {
    copie,

    /** CA-1 : liste du club, gardée sur l'appareil ; en cas d'échec, la dernière copie est jointe. */
    async lister(): Promise<
      | { ok: true; competitions: Competition[] }
      | { ok: false; erreur: ErreurCompetitions; copie: CopieCompetitions | null }
    > {
      let reponse;
      try {
        reponse = analyserReponseCompetitions(await requete('GET', '/competitions'));
      } catch {
        return { ok: false, erreur: 'HORS_LIGNE', copie: await copie() };
      }
      if (!reponse.ok) return { ok: false, erreur: erreurDe(reponse.erreur), copie: await copie() };
      const { competitions } = reponse;
      await base.copieCompetitions.put({ cle: LIGNE_UNIQUE, competitions, copieLe: maintenant() });
      return { ok: true, competitions };
    },

    /** CA-1 et CA-2 : crée une compétition dans une manifestation, après les règles du domaine. */
    async creer(manifestationId: string, saisie: SaisieCompetition): Promise<ResultatEnregistrementCompetition> {
      const donnees = versDonnees(manifestationId, saisie);
      const erreurs = validerCompetition(donnees);
      if (Object.keys(erreurs).length > 0) return { ok: false, erreurs };
      return enregistrer('POST', '/competitions', donnees);
    },

    /** CA-3 : modifie nom, arme et commentaire, à partir de la version chargée ; la manifestation ne change pas. */
    async modifier(depart: Competition, saisie: SaisieCompetition): Promise<ResultatEnregistrementCompetition> {
      const { manifestationId, ...donnees } = versDonnees(depart.manifestationId, saisie);
      const erreurs = validerCompetition({ manifestationId, ...donnees });
      if (Object.keys(erreurs).length > 0) return { ok: false, erreurs };
      return enregistrer('PATCH', `/competitions/${depart.id}`, { ...donnees, version: depart.version });
    },

    /** CA-5 : supprime une compétition vide ; le serveur refuse une compétition non vide. */
    async supprimer(id: string): Promise<{ ok: true } | { ok: false; erreur: ErreurCompetitions }> {
      let reponse;
      try {
        reponse = analyserReponseSuppression(await requete('DELETE', `/competitions/${id}`));
      } catch {
        return { ok: false, erreur: 'HORS_LIGNE' };
      }
      return reponse.ok ? reponse : { ok: false, erreur: erreurDe(reponse.erreur) };
    },

    /**
     * US-041 : supprime la compétition avec ses épreuves. Le serveur en traite un morceau par requête (CA-5) : on enchaîne
     * jusqu'à la fin, avec la progression. Si la suite est interrompue, le serveur garde la compétition et ce qui reste, et
     * relancer la reprend (CA-6).
     */
    async supprimerAvecContenu(
      id: string,
      surProgression?: (faites: number, total: number) => void,
    ): Promise<ResultatSuppressionContenu<ErreurCompetitions>> {
      return enchainerSuppressionContenu(
        async () => analyserReponseSuppressionContenu(await requete('DELETE', `/competitions/${id}?contenu=1`)),
        erreurDe,
        'HORS_LIGNE',
        'ERREUR_INATTENDUE',
        surProgression,
      );
    },
  };
}

export type ClientCompetitions = ReturnType<typeof creerClientCompetitions>;
