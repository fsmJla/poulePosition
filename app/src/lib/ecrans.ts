// Écrans géants du club (US-133 à US-135, ADR-0029, docs/protocole.md §23) : réglages d'affichage gardés par le serveur,
// modifiables en ligne seulement. La dernière liste reçue est gardée sur l'appareil : hors ligne, elle reste consultable
// et la fenêtre locale (US-136) peut s'ouvrir.
import {
  analyserEcran,
  type DemandeEcran,
  type Ecran,
  type ReglagesEcran,
  type VueImposee,
} from '@poule-position/protocole';
import { DELAI_REPONSE } from './session';

export type ErreurEcrans =
  | 'HORS_LIGNE'
  /** En ligne, mais le serveur ne répond pas (ou refuse sans en-têtes CORS : route inconnue d'un serveur trop ancien). */
  | 'SERVEUR_INJOIGNABLE'
  | 'SESSION_INVALIDE'
  | 'NOM_EN_DOUBLE'
  | 'ECRAN_INCONNU'
  | 'ECRAN_DECONNECTE'
  | 'PROPRIETAIRE_INCONNU'
  | 'ERREUR_INATTENDUE';

export interface ListeEcrans {
  ecrans: Ecran[];
  /** Écrans dont la socket de contrôle est ouverte (« Connecté »). */
  connectes: string[];
  /** Date de la copie lue hors ligne ; null pour une liste reçue du serveur. */
  copieLe: number | null;
}

export type Resultat<T> = ({ ok: true } & T) | { ok: false; erreur: ErreurEcrans };

/** Clé de la copie gardée sur l'appareil. */
export const CLE_COPIE_ECRANS = 'poule-position:ecrans';

export interface OptionsEcrans {
  urlServeur: string | null;
  jeton: () => Promise<string | null>;
  envoyer?: typeof fetch;
  enLigne?: () => boolean;
  maintenant?: () => number;
  stockage?: Pick<Storage, 'getItem' | 'setItem'> | null;
  delai?: number;
}

const ERREURS_CONNUES: readonly ErreurEcrans[] = [
  'SERVEUR_INJOIGNABLE',
  'NOM_EN_DOUBLE',
  'ECRAN_INCONNU',
  'ECRAN_DECONNECTE',
  'PROPRIETAIRE_INCONNU',
];
const SESSION_REFUSEE = ['SESSION_INVALIDE', 'COMPTE_MODIFIE', 'COMPTE_RETIRE'];

function erreurDe(corps: unknown): ErreurEcrans {
  const erreur = (corps as { erreur?: unknown } | undefined)?.erreur;
  if (typeof erreur !== 'string') return 'ERREUR_INATTENDUE';
  if (SESSION_REFUSEE.includes(erreur)) return 'SESSION_INVALIDE';
  return ERREURS_CONNUES.find((connue) => connue === erreur) ?? 'ERREUR_INATTENDUE';
}

function stockageParDefaut(): Pick<Storage, 'getItem' | 'setItem'> | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function creerClientEcrans({
  urlServeur,
  jeton,
  envoyer = (...args) => fetch(...args),
  enLigne = () => navigator.onLine,
  maintenant = () => Date.now(),
  stockage = stockageParDefaut(),
  delai = DELAI_REPONSE,
}: OptionsEcrans) {
  /** Requête avec la session ; null sans réseau, sans serveur ou sans session en ligne. */
  async function requete(
    methode: string,
    chemin: string,
    corps?: unknown,
  ): Promise<{ ok: boolean; corps: unknown } | null> {
    const jetonSession = urlServeur && enLigne() ? await jeton() : null;
    if (!jetonSession) return null;
    try {
      const reponse = await envoyer(`${urlServeur}${chemin}`, {
        method: methode,
        signal: AbortSignal.timeout(delai),
        headers: {
          Authorization: `Bearer ${jetonSession}`,
          ...(corps !== undefined && { 'Content-Type': 'application/json' }),
        },
        ...(corps !== undefined && { body: JSON.stringify(corps) }),
      });
      return { ok: reponse.ok, corps: await reponse.json().catch(() => undefined) };
    } catch {
      // Le navigateur est en ligne : ce n'est pas une coupure, c'est le serveur qui ne répond pas.
      return { ok: false, corps: { erreur: 'SERVEUR_INJOIGNABLE' } };
    }
  }

  function lireCopie(): ListeEcrans | null {
    try {
      const brut = stockage?.getItem(CLE_COPIE_ECRANS);
      if (!brut) return null;
      const { ecrans, copieLe } = JSON.parse(brut) as { ecrans: unknown; copieLe: unknown };
      if (!Array.isArray(ecrans) || typeof copieLe !== 'number') return null;
      const lus = ecrans.map(analyserEcran);
      return lus.every((e) => e !== null) ? { ecrans: lus as Ecran[], connectes: [], copieLe } : null;
    } catch {
      return null;
    }
  }

  function garderCopie(ecrans: Ecran[]): void {
    try {
      stockage?.setItem(CLE_COPIE_ECRANS, JSON.stringify({ ecrans, copieLe: maintenant() }));
    } catch {
      // Stockage refusé : la liste reste en ligne seulement.
    }
  }

  /** Un écran renvoyé par le serveur, ou une erreur. */
  async function ecranDe(methode: string, chemin: string, corps?: unknown): Promise<Resultat<{ ecran: Ecran }>> {
    const reponse = await requete(methode, chemin, corps);
    if (!reponse) return { ok: false, erreur: 'HORS_LIGNE' };
    const ecran = reponse.ok ? analyserEcran((reponse.corps as { ecran?: unknown } | undefined)?.ecran) : null;
    return ecran ? { ok: true, ecran } : { ok: false, erreur: erreurDe(reponse.corps) };
  }

  return {
    /** US-133 CA-1 : les écrans du club ; hors ligne, la dernière copie de l'appareil (avec sa date). */
    async lister(): Promise<Resultat<ListeEcrans>> {
      const reponse = await requete('GET', '/ecrans');
      if (reponse?.ok) {
        const corps = reponse.corps as { ecrans?: unknown; connectes?: unknown } | undefined;
        const ecrans = Array.isArray(corps?.ecrans) ? corps.ecrans.map(analyserEcran) : null;
        if (ecrans && ecrans.every((e) => e !== null)) {
          garderCopie(ecrans as Ecran[]);
          const connectes = Array.isArray(corps?.connectes)
            ? corps.connectes.filter((id): id is string => typeof id === 'string')
            : [];
          return { ok: true, ecrans: ecrans as Ecran[], connectes, copieLe: null };
        }
        return { ok: false, erreur: 'ERREUR_INATTENDUE' };
      }
      if (reponse) return { ok: false, erreur: erreurDe(reponse.corps) };
      const copie = lireCopie();
      return copie ? { ok: true, ...copie } : { ok: false, erreur: 'HORS_LIGNE' };
    },

    /** La copie gardée sur l'appareil (fenêtre locale, US-136), sans réseau. */
    copie: lireCopie,

    creer: (demande: DemandeEcran) => ecranDe('POST', '/ecrans', demande),
    modifier: (id: string, reglages: ReglagesEcran) => ecranDe('PATCH', `/ecrans/${id}`, reglages),
    regenerer: (id: string) => ecranDe('POST', `/ecrans/${id}/jeton`),
    /** US-135 : impose une vue (ou reprend le défilement avec null). */
    imposer: (id: string, vue: VueImposee | null) => ecranDe('PUT', `/ecrans/${id}/vue`, vue),

    async supprimer(id: string): Promise<Resultat<object>> {
      const reponse = await requete('DELETE', `/ecrans/${id}`);
      if (!reponse) return { ok: false, erreur: 'HORS_LIGNE' };
      return reponse.ok ? { ok: true } : { ok: false, erreur: erreurDe(reponse.corps) };
    },
  };
}

export type ClientEcrans = ReturnType<typeof creerClientEcrans>;
