// Manifestations du club (US-023, docs/protocole.md §12) : données du club stockées par le serveur, modifiables en ligne
// seulement. La dernière liste reçue est gardée dans IndexedDB : hors ligne, elle reste consultable avec sa date.
import {
  epreuvesHorsDates,
  validerManifestation,
  type EpreuveRattachee,
  type DonneesManifestation,
  type ErreursManifestation,
} from '@poule-position/domaine';
import {
  analyserReponseArchivageManifestation,
  analyserReponseCompetitions,
  analyserReponseManifestation,
  analyserReponseManifestations,
  analyserReponseSuppression,
  analyserReponseSuppressionContenu,
  type ErreurReponse,
  type Competition,
  type Manifestation,
} from '@poule-position/protocole';
import { DELAI_REPONSE } from './session';
import { Base, LIGNE_UNIQUE, type CopieManifestations } from './stockage';
import { enchainerSuppressionContenu, type ResultatSuppressionContenu } from './suppression';

/** Champs du formulaire, tels que saisis : un texte vide est un champ non renseigné. */
export type SaisieManifestation = Record<keyof DonneesManifestation, string>;

/** Erreurs affichées par la page « Manifestations ». */
export type ErreurManifestations =
  | 'HORS_LIGNE'
  | 'SESSION_INVALIDE'
  | 'MANIFESTATION_INCONNUE'
  | 'MANIFESTATION_NON_VIDE'
  | 'ACCES_REFUSE'
  | 'EPREUVE_EN_COURS'
  | 'ERREUR_INATTENDUE';

export type ResultatEnregistrement =
  | { ok: true; manifestation: Manifestation }
  | { ok: false; erreurs: ErreursManifestation }
  /** CA-4 : épreuves rattachées que les nouvelles dates n'incluraient plus. */
  | { ok: false; erreur: 'EPREUVES_HORS_DATES'; epreuves: EpreuveRattachee[] }
  /** Cas limite : modifiée par quelqu'un d'autre depuis le chargement ; la version courante est jointe. */
  | { ok: false; erreur: 'MODIFIEE_ENTRE_TEMPS'; manifestation: Manifestation }
  | { ok: false; erreur: ErreurManifestations };

export interface OptionsManifestations {
  /** Adresse HTTP du serveur (voir urlHttp) ; null s'il n'est pas configuré. */
  urlServeur: string | null;
  nomBase?: string;
  /** Jeton de la session en ligne ; null pour une session locale (US-005). */
  jeton: () => Promise<string | null>;
  /** CA-4 : épreuves connues (index du club et épreuves de cet appareil). */
  epreuves: () => Promise<EpreuveRattachee[]>;
  envoyer?: typeof fetch;
  enLigne?: () => boolean;
  maintenant?: () => number;
  delai?: number;
}

/** CA-1 : formulaire vide. */
export function saisieVide(): SaisieManifestation {
  return { nom: '', debut: '', fin: '', lieu: '', commentaire: '' };
}

/** CA-2 : formulaire prérempli avec une manifestation existante. */
export function saisieDe({ nom, debut, fin, lieu, commentaire }: Manifestation): SaisieManifestation {
  return { nom, debut, fin, lieu: lieu ?? '', commentaire: commentaire ?? '' };
}

function versDonnees({ nom, debut, fin, lieu, commentaire }: SaisieManifestation): DonneesManifestation {
  return { nom, debut, fin, lieu: lieu === '' ? null : lieu, commentaire: commentaire === '' ? null : commentaire };
}

const SESSION_REFUSEE: readonly ErreurReponse[] = ['SESSION_INVALIDE', 'COMPTE_MODIFIE', 'COMPTE_RETIRE'];

function erreurDe(erreur: ErreurReponse): ErreurManifestations {
  if (SESSION_REFUSEE.includes(erreur)) return 'SESSION_INVALIDE';
  const connues = ['MANIFESTATION_INCONNUE', 'MANIFESTATION_NON_VIDE', 'ACCES_REFUSE', 'EPREUVE_EN_COURS'] as const;
  return connues.find((connue) => connue === erreur) ?? 'ERREUR_INATTENDUE';
}

class Injoignable extends Error {}

export function creerClientManifestations({
  urlServeur,
  nomBase = 'poulePosition',
  jeton,
  epreuves,
  envoyer = (...args) => fetch(...args),
  enLigne = () => navigator.onLine,
  maintenant = () => Date.now(),
  delai = DELAI_REPONSE,
}: OptionsManifestations) {
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

  async function copie(): Promise<CopieManifestations | null> {
    const ligne = await base.copieManifestations.get(LIGNE_UNIQUE);
    return ligne ? { manifestations: ligne.manifestations, copieLe: ligne.copieLe } : null;
  }

  /** Compétitions du club à jour ; à défaut de réponse, leur dernière copie gardée sur l'appareil. */
  async function competitionsDuClub(): Promise<{ id: string; manifestationId: string | null }[]> {
    try {
      const reponse = analyserReponseCompetitions(await requete('GET', '/competitions'));
      if (reponse.ok) return reponse.competitions;
    } catch {
      // Réseau perdu : la copie suffit.
    }
    return (await base.copieCompetitions.get(LIGNE_UNIQUE))?.competitions ?? [];
  }

  async function enregistrer(
    methode: 'POST' | 'PATCH',
    chemin: string,
    corps: unknown,
  ): Promise<ResultatEnregistrement> {
    let reponse;
    try {
      reponse = analyserReponseManifestation(await requete(methode, chemin, corps));
    } catch {
      return { ok: false, erreur: 'HORS_LIGNE' };
    }
    if (reponse.ok) return reponse;
    if (reponse.erreur === 'MODIFIEE_ENTRE_TEMPS' && reponse.manifestation) {
      return { ok: false, erreur: 'MODIFIEE_ENTRE_TEMPS', manifestation: reponse.manifestation };
    }
    return { ok: false, erreur: erreurDe(reponse.erreur) };
  }

  return {
    copie,

    /** CA-1 : liste du club, gardée sur l'appareil ; en cas d'échec, la dernière copie est jointe. */
    async lister(): Promise<
      | { ok: true; manifestations: Manifestation[] }
      | { ok: false; erreur: ErreurManifestations; copie: CopieManifestations | null }
    > {
      let reponse;
      try {
        reponse = analyserReponseManifestations(await requete('GET', '/manifestations'));
      } catch {
        return { ok: false, erreur: 'HORS_LIGNE', copie: await copie() };
      }
      if (!reponse.ok) return { ok: false, erreur: erreurDe(reponse.erreur), copie: await copie() };
      const { manifestations } = reponse;
      await base.copieManifestations.put({ cle: LIGNE_UNIQUE, manifestations, copieLe: maintenant() });
      return { ok: true, manifestations };
    },

    /** CA-1 et CA-3 : crée une manifestation, après les règles du domaine. */
    async creer(saisie: SaisieManifestation): Promise<ResultatEnregistrement> {
      const donnees = versDonnees(saisie);
      const erreurs = validerManifestation(donnees);
      if (Object.keys(erreurs).length > 0) return { ok: false, erreurs };
      return enregistrer('POST', '/manifestations', donnees);
    },

    /** CA-2 à CA-4 : modifie une manifestation, à partir de la version chargée. */
    async modifier(depart: Manifestation, saisie: SaisieManifestation): Promise<ResultatEnregistrement> {
      const donnees = versDonnees(saisie);
      const erreurs = validerManifestation(donnees);
      if (Object.keys(erreurs).length > 0) return { ok: false, erreurs };
      // Les épreuves sont dans les compétitions : la liste à jour des compétitions du club dit lesquelles sont dans cette
      // manifestation (à défaut, sa dernière copie).
      const competitions = await competitionsDuClub();
      const horsDates = epreuvesHorsDates(depart.id, donnees.debut, donnees.fin, await epreuves(), competitions);
      if (horsDates.length > 0) return { ok: false, erreur: 'EPREUVES_HORS_DATES', epreuves: horsDates };
      return enregistrer('PATCH', `/manifestations/${depart.id}`, { ...donnees, version: depart.version });
    },

    /**
     * US-033 CA-4 : archive ou désarchive la manifestation et ses compétitions, en une seule requête. Les épreuves
     * s'archivent ailleurs, dans le journal de leur pilote. Exige le réseau.
     */
    async archiver(
      id: string,
      archivee: boolean,
    ): Promise<
      | { ok: true; manifestation: Manifestation; competitions: Competition[] }
      | { ok: false; erreur: ErreurManifestations }
    > {
      let reponse;
      try {
        reponse = analyserReponseArchivageManifestation(
          await requete('POST', `/manifestations/${id}/archivage`, { archivee }),
        );
      } catch {
        return { ok: false, erreur: 'HORS_LIGNE' };
      }
      return reponse.ok ? reponse : { ok: false, erreur: erreurDe(reponse.erreur) };
    },

    /** CA-5 : supprime une manifestation vide ; le serveur refuse une manifestation non vide. */
    async supprimer(id: string): Promise<{ ok: true } | { ok: false; erreur: ErreurManifestations }> {
      let reponse;
      try {
        reponse = analyserReponseSuppression(await requete('DELETE', `/manifestations/${id}`));
      } catch {
        return { ok: false, erreur: 'HORS_LIGNE' };
      }
      return reponse.ok ? reponse : { ok: false, erreur: erreurDe(reponse.erreur) };
    },

    /**
     * US-042 : supprime la manifestation avec ses compétitions et ses épreuves. Le serveur en traite un morceau par
     * requête (CA-5) : on enchaîne jusqu'à la fin, avec la progression. Si la suite est interrompue, le serveur garde la
     * manifestation et ce qui reste, et relancer la reprend (CA-6).
     */
    async supprimerAvecContenu(
      id: string,
      surProgression?: (faites: number, total: number) => void,
    ): Promise<ResultatSuppressionContenu<ErreurManifestations>> {
      return enchainerSuppressionContenu(
        async () => analyserReponseSuppressionContenu(await requete('DELETE', `/manifestations/${id}?contenu=1`)),
        erreurDe,
        'HORS_LIGNE',
        'ERREUR_INATTENDUE',
        surProgression,
      );
    },
  };
}

export type ClientManifestations = ReturnType<typeof creerClientManifestations>;
