// Page d'accueil publique (US-031, docs/protocole.md §16) : lecture, sans session, des épreuves publiées. Un visiteur n'a
// pas de mode hors ligne : sans réseau, la page le dit et réessaie au retour du réseau.
import { regrouperPagePublique, type EpreuvePublique, type PagePublique } from '@poule-position/domaine';
import { analyserReponseEpreuvePublique, analyserReponsePublique, type FichierPublic } from '@poule-position/protocole';

export type ErreurPublic = 'NON_CONFIGURE' | 'HORS_LIGNE' | 'ERREUR_INATTENDUE';

export type ResultatPage =
  { ok: true; page: PagePublique; fichiers: FichierPublic[] } | { ok: false; erreur: ErreurPublic };

/** `NON_PUBLIEE` : l'épreuve n'est pas (ou plus) publiée, ou n'existe pas (CA-4). */
export type ResultatEpreuvePublique =
  { ok: true; epreuve: EpreuvePublique } | { ok: false; erreur: ErreurPublic | 'NON_PUBLIEE' };

interface OptionsClientPublic {
  /** Adresse HTTP du serveur (`urlHttp`) ; null s'il n'est pas configuré. */
  urlServeur: string | null;
  envoyer?: typeof fetch;
  /** Délai d'attente d'une lecture, en millisecondes. */
  delai?: number;
}

const DELAI_LECTURE = 10_000;

export type ClientPublic = ReturnType<typeof creerClientPublic>;

export function creerClientPublic({
  urlServeur,
  envoyer = (...args) => fetch(...args),
  delai = DELAI_LECTURE,
}: OptionsClientPublic) {
  /** Corps JSON de la réponse (même d'un refus) ; lève si le serveur est injoignable. */
  async function lire(chemin: string): Promise<unknown> {
    const reponse = await envoyer(`${urlServeur}${chemin}`, { signal: AbortSignal.timeout(delai) });
    return reponse.json().catch(() => undefined);
  }

  return {
    /** CA-3 : les épreuves publiées, regroupées par manifestation puis par compétition, avec leurs fichiers. */
    async page(): Promise<ResultatPage> {
      if (!urlServeur) return { ok: false, erreur: 'NON_CONFIGURE' };
      let brut;
      try {
        brut = await lire('/public');
      } catch {
        return { ok: false, erreur: 'HORS_LIGNE' };
      }
      const reponse = analyserReponsePublique(brut);
      if (!reponse.ok) return { ok: false, erreur: 'ERREUR_INATTENDUE' };
      const { fichiers, ...donnees } = reponse;
      return { ok: true, page: regrouperPagePublique(donnees), fichiers };
    },

    /** CA-4 : l'épreuve si elle est publiée ; `NON_PUBLIEE` sinon. */
    async epreuve(epreuveId: string): Promise<ResultatEpreuvePublique> {
      if (!urlServeur) return { ok: false, erreur: 'NON_CONFIGURE' };
      let brut;
      try {
        brut = await lire(`/public/epreuves/${encodeURIComponent(epreuveId)}`);
      } catch {
        return { ok: false, erreur: 'HORS_LIGNE' };
      }
      const reponse = analyserReponseEpreuvePublique(brut);
      if (reponse.ok) return reponse;
      return { ok: false, erreur: reponse.erreur === 'EPREUVE_NON_PUBLIEE' ? 'NON_PUBLIEE' : 'ERREUR_INATTENDUE' };
    },

    /** Adresse d'un fichier joint (lecture publique, `GET /fichiers/<nom>`) ; null sans serveur. */
    adresseFichier(nom: string): string | null {
      return urlServeur ? `${urlServeur}/fichiers/${nom}` : null;
    },
  };
}
