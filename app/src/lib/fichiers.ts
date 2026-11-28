// Fichiers joints (US-030, ADR-0022, docs/protocole.md §15) : une affiche et une feuille de route par manifestation,
// compétition ou épreuve. L'envoi, le remplacement et le retrait demandent le réseau et une session en ligne ; la
// description des fichiers et le contenu de ceux qu'on a besoin d'afficher sont gardés dans IndexedDB pour rester
// affichables et imprimables hors ligne (CA-6).
import {
  controlerFichier,
  fichierHerite,
  type ProprietaireFichier,
  type RaisonRefus,
  type SorteFichier,
} from '@poule-position/domaine';
import {
  analyserReponseFichier,
  analyserReponseFichiers,
  cheminFichier,
  type ErreurReponse,
  type FichierJoint,
  type FichierSauvegarde,
} from '@poule-position/protocole';
import { reduireAffiche } from './reduction';
import { Base, LIGNE_UNIQUE, type CopieFichiers } from './stockage';

/** Erreurs affichées à côté d'un fichier. */
export type ErreurFichiers =
  | 'HORS_LIGNE'
  /** Le réseau a coupé pendant l'envoi : l'ancien fichier reste en place (cas limite d'US-030). */
  | 'INTERROMPU'
  | 'SESSION_INVALIDE'
  | 'ACCES_REFUSE'
  | 'PROPRIETAIRE_INCONNU'
  | 'FICHIER_INCONNU'
  | 'ERREUR_INATTENDUE';

export type ResultatFichier =
  | { ok: true; fichier: FichierJoint }
  /** CA-3 : refusé avant tout envoi (ou par le serveur), avec la raison. */
  | { ok: false; erreur: 'REFUSE'; raison: RaisonRefus }
  | { ok: false; erreur: ErreurFichiers };

export interface OptionsFichiers {
  /** Adresse HTTP du serveur (voir urlHttp) ; null s'il n'est pas configuré. */
  urlServeur: string | null;
  nomBase?: string;
  /** Jeton de la session en ligne ; null pour une session locale (US-005). */
  jeton: () => Promise<string | null>;
  envoyer?: typeof fetch;
  enLigne?: () => boolean;
  maintenant?: () => number;
  /** Réduction de l'affiche (WebP, 1 600 px) ; remplaçable pour les tests. */
  reduire?: (image: Blob) => Promise<Blob | null>;
  /** Un envoi de 5 Mo sur un réseau mobile est plus long qu'une requête ordinaire. */
  delai?: number;
}

const DELAI_ENVOI = 60_000;
const DELAI_LECTURE = 10_000;
const SESSION_REFUSEE: readonly ErreurReponse[] = ['SESSION_INVALIDE', 'COMPTE_MODIFIE', 'COMPTE_RETIRE'];

function erreurDe(erreur: ErreurReponse): ErreurFichiers {
  if (SESSION_REFUSEE.includes(erreur)) return 'SESSION_INVALIDE';
  const connues = ['ACCES_REFUSE', 'PROPRIETAIRE_INCONNU', 'FICHIER_INCONNU'] as const;
  return connues.find((connue) => connue === erreur) ?? 'ERREUR_INATTENDUE';
}

/** Les fichiers à montrer pour une épreuve (CA-4) : le sien, à défaut celui de sa compétition, de sa manifestation. */
export function fichiersEffectifs<F extends Pick<FichierJoint, 'proprietaire' | 'proprietaireId' | 'sorte'>>(
  fichiers: readonly F[],
  chaine: readonly { proprietaire: ProprietaireFichier; id: string | null | undefined }[],
): Record<SorteFichier, F | null> {
  const de = (sorte: SorteFichier) =>
    fichierHerite(
      chaine.map(({ proprietaire, id }) =>
        id
          ? (fichiers.find((f) => f.proprietaire === proprietaire && f.proprietaireId === id && f.sorte === sorte) ??
            null)
          : null,
      ),
    );
  return { affiche: de('affiche'), feuilleDeRoute: de('feuilleDeRoute') };
}

/** US-073 : les fichiers que porte un élément lui-même (sans héritage) : seule sa ligne montre le repère (CA-4). */
export function fichiersPropres<F extends Pick<FichierJoint, 'proprietaire' | 'proprietaireId' | 'sorte'>>(
  fichiers: readonly F[],
  proprietaire: ProprietaireFichier,
  id: string,
): Record<SorteFichier, F | null> {
  const de = (sorte: SorteFichier) =>
    fichiers.find((f) => f.proprietaire === proprietaire && f.proprietaireId === id && f.sorte === sorte) ?? null;
  return { affiche: de('affiche'), feuilleDeRoute: de('feuilleDeRoute') };
}

export function creerClientFichiers({
  urlServeur,
  nomBase = 'poulePosition',
  jeton,
  envoyer = (...args) => fetch(...args),
  enLigne = () => navigator.onLine,
  maintenant = () => Date.now(),
  reduire = (image) => reduireAffiche(image),
  delai = DELAI_ENVOI,
}: OptionsFichiers) {
  const base = new Base(nomBase);

  class Injoignable extends Error {}
  class Interrompu extends Error {}

  /** Requête avec la session ; lève Injoignable sans réseau ni session en ligne, Interrompu si l'échange coupe. */
  async function requete(methode: string, chemin: string, corps?: Blob, attente = DELAI_LECTURE): Promise<unknown> {
    const jetonSession = urlServeur && enLigne() ? await jeton() : null;
    if (!jetonSession) throw new Injoignable();
    let reponse: Response;
    try {
      reponse = await envoyer(`${urlServeur}${chemin}`, {
        method: methode,
        signal: AbortSignal.timeout(attente),
        headers: {
          Authorization: `Bearer ${jetonSession}`,
          ...(corps && { 'Content-Type': 'application/octet-stream' }),
        },
        ...(corps && { body: corps }),
      });
    } catch {
      throw new Interrompu();
    }
    return reponse.json().catch(() => undefined);
  }

  async function copie(): Promise<CopieFichiers | null> {
    const ligne = await base.copieFichiers.get(LIGNE_UNIQUE);
    return ligne ? { fichiers: ligne.fichiers, copieLe: ligne.copieLe } : null;
  }

  /** Remplace ou ajoute la description d'un fichier dans la copie locale (après un envoi réussi). */
  async function noterDansLaCopie(fichier: FichierJoint | null, retire?: Omit<FichierJoint, 'nom'>) {
    const courante = await copie();
    if (!courante) return;
    const autres = courante.fichiers.filter((f) => {
      const cible = fichier ?? retire;
      return !(
        cible &&
        f.proprietaire === cible.proprietaire &&
        f.proprietaireId === cible.proprietaireId &&
        f.sorte === cible.sorte
      );
    });
    await base.copieFichiers.put({
      cle: LIGNE_UNIQUE,
      fichiers: fichier ? [...autres, fichier] : autres,
      copieLe: maintenant(),
    });
  }

  return {
    copie,

    /** Adresse publique du contenu d'un fichier (§15) : lisible sans session. */
    adresse: (nom: string): string | null => (urlServeur ? `${urlServeur}/fichiers/${nom}` : null),

    /**
     * Description de tous les fichiers du club, gardée sur l'appareil ; en cas d'échec, la dernière copie est jointe. Les
     * contenus gardés dont le fichier n'existe plus (remplacé, retiré, supprimé avec son élément) sont effacés.
     */
    async lister(): Promise<
      { ok: true; fichiers: FichierJoint[] } | { ok: false; erreur: ErreurFichiers; copie: CopieFichiers | null }
    > {
      let reponse;
      try {
        reponse = analyserReponseFichiers(await requete('GET', '/fichiers'));
      } catch {
        return { ok: false, erreur: 'HORS_LIGNE', copie: await copie() };
      }
      if (!reponse.ok) return { ok: false, erreur: erreurDe(reponse.erreur), copie: await copie() };
      const { fichiers } = reponse;
      await base.copieFichiers.put({ cle: LIGNE_UNIQUE, fichiers, copieLe: maintenant() });
      const noms = new Set(fichiers.map(({ nom }) => nom));
      const gardes = await base.contenusFichiers.toCollection().primaryKeys();
      await base.contenusFichiers.bulkDelete(gardes.filter((nom) => !noms.has(nom)));
      return { ok: true, fichiers };
    },

    /**
     * CA-1 à CA-3 : contrôle le fichier choisi (taille, type réel, sorte), réduit une affiche en WebP, l'envoie et garde
     * son contenu pour le hors ligne. Rien n'est envoyé si le contrôle refuse ; si l'envoi coupe, l'ancien reste.
     */
    async joindre(
      proprietaire: ProprietaireFichier,
      id: string,
      sorte: SorteFichier,
      choisi: Blob,
    ): Promise<ResultatFichier> {
      const controle = controlerFichier(sorte, new Uint8Array(await choisi.arrayBuffer()));
      if (!controle.ok) return { ok: false, erreur: 'REFUSE', raison: controle.raison };
      let contenu: Blob = choisi;
      if (sorte === 'affiche') {
        contenu = (await reduire(choisi)) ?? choisi;
        const reduit = controlerFichier(sorte, new Uint8Array(await contenu.arrayBuffer()));
        if (!reduit.ok) return { ok: false, erreur: 'REFUSE', raison: reduit.raison };
      }
      let reponse;
      try {
        reponse = analyserReponseFichier(await requete('PUT', cheminFichier(proprietaire, id, sorte), contenu, delai));
      } catch (erreur) {
        return { ok: false, erreur: erreur instanceof Interrompu ? 'INTERROMPU' : 'HORS_LIGNE' };
      }
      if (reponse.ok) {
        await base.contenusFichiers.put({ nom: reponse.fichier.nom, contenu });
        await noterDansLaCopie(reponse.fichier);
        return reponse;
      }
      if (reponse.erreur === 'FICHIER_REFUSE' && reponse.raison) {
        return { ok: false, erreur: 'REFUSE', raison: reponse.raison };
      }
      return { ok: false, erreur: erreurDe(reponse.erreur) };
    },

    /** CA-5 : retire le fichier ; l'ancien contenu n'est plus servi. */
    async retirer(
      proprietaire: ProprietaireFichier,
      id: string,
      sorte: SorteFichier,
    ): Promise<{ ok: true } | { ok: false; erreur: ErreurFichiers }> {
      let brut;
      try {
        brut = await requete('DELETE', cheminFichier(proprietaire, id, sorte));
      } catch (erreur) {
        return { ok: false, erreur: erreur instanceof Interrompu ? 'INTERROMPU' : 'HORS_LIGNE' };
      }
      const reponse = analyserReponseFichier(brut);
      const reussi = typeof brut === 'object' && brut !== null && (brut as { ok?: unknown }).ok === true;
      if (reussi) {
        await noterDansLaCopie(null, { proprietaire, proprietaireId: id, sorte } as Omit<FichierJoint, 'nom'>);
        return { ok: true };
      }
      return { ok: false, erreur: reponse.ok ? 'ERREUR_INATTENDUE' : erreurDe(reponse.erreur) };
    },

    /**
     * CA-6 : garde sur l'appareil le contenu des fichiers donnés (ceux d'une épreuve, héritage compris), pour qu'ils
     * restent affichables et imprimables sans réseau. Un contenu déjà gardé n'est pas retéléchargé (le nom en est
     * l'empreinte). Sans réseau, ou si une lecture échoue, ce qui est déjà gardé reste.
     */
    async garderHorsLigne(fichiers: readonly FichierJoint[]): Promise<void> {
      if (!urlServeur || !enLigne()) return;
      for (const { nom } of fichiers) {
        if (await base.contenusFichiers.get(nom)) continue;
        try {
          const reponse = await envoyer(`${urlServeur}/fichiers/${nom}`, { signal: AbortSignal.timeout(delai) });
          if (reponse.ok) await base.contenusFichiers.put({ nom, contenu: await reponse.blob() });
        } catch {
          // Réseau perdu en route : on réessaiera au prochain affichage.
        }
      }
    },

    /**
     * US-035 CA-2 : garde sur l'appareil les fichiers d'une sauvegarde importée (contenu et description), pour qu'ils
     * restent affichables et imprimables hors ligne. Le serveur n'en est pas informé : un fichier qu'il ne connaît pas
     * disparaît de la copie à la prochaine lecture en ligne (hypothèse d'US-035).
     */
    async garderImportes(importes: readonly FichierSauvegarde[], par: string): Promise<void> {
      const decrits: FichierJoint[] = [];
      for (const { contenu, ...description } of importes) {
        const octets = Uint8Array.from(atob(contenu), (c) => c.charCodeAt(0));
        await base.contenusFichiers.put({ nom: description.nom, contenu: new Blob([octets]) });
        decrits.push({ ...description, ajouteLe: maintenant(), ajoutePar: par });
      }
      if (decrits.length === 0) return;
      const courante = await copie();
      const autres = (courante?.fichiers ?? []).filter(
        (f) =>
          !decrits.some(
            (d) => d.proprietaire === f.proprietaire && d.proprietaireId === f.proprietaireId && d.sorte === f.sorte,
          ),
      );
      await base.copieFichiers.put({
        cle: LIGNE_UNIQUE,
        fichiers: [...autres, ...decrits],
        copieLe: courante?.copieLe ?? maintenant(),
      });
    },

    /** US-160 : la dernière description des fichiers gardée sur l'appareil, sans réseau (vide sans copie). */
    async copieLocale(): Promise<readonly FichierJoint[]> {
      return (await copie())?.fichiers ?? [];
    },

    /**
     * US-034 : description de tous les fichiers du club pour un export : à jour si le serveur répond, sinon la dernière
     * copie de l'appareil (vide si l'appareil n'en a jamais eu).
     */
    async decrire(): Promise<readonly FichierJoint[]> {
      const reponse = await this.lister();
      return reponse.ok ? reponse.fichiers : (reponse.copie?.fichiers ?? []);
    },

    /**
     * US-034 : contenu d'un fichier pour un export : celui gardé sur l'appareil ou, à défaut et en ligne, téléchargé (et
     * gardé). Null s'il n'est disponible nulle part.
     */
    async contenu(nom: string): Promise<Blob | null> {
      const garde = (await base.contenusFichiers.get(nom))?.contenu;
      if (garde) return garde;
      if (!urlServeur || !enLigne()) return null;
      try {
        const reponse = await envoyer(`${urlServeur}/fichiers/${nom}`, { signal: AbortSignal.timeout(delai) });
        if (!reponse.ok) return null;
        const contenu = await reponse.blob();
        await base.contenusFichiers.put({ nom, contenu });
        return contenu;
      } catch {
        return null;
      }
    },

    /** Contenu gardé sur l'appareil, ou null. */
    async contenuLocal(nom: string): Promise<Blob | null> {
      return (await base.contenusFichiers.get(nom))?.contenu ?? null;
    },
  };
}

export type ClientFichiers = ReturnType<typeof creerClientFichiers>;
