// Accès par QR code (US-096, ADR-0007) : le pilote génère un jeton de 128 bits par rôle, le confie au DO de l'épreuve,
// inscrit son empreinte au journal (`JetonQrDefini`) et garde le jeton sur ce PC pour afficher et imprimer les QR codes
// sans internet. Un autre PC du club (lecture seule, ou après une prise de main) relit les jetons sur le serveur.
import { ROLES_QR, type RoleQr } from '@poule-position/domaine';
import { analyserReponseJetonQr, analyserReponseJetonsQr, encoderBase64Url } from '@poule-position/protocole';
import { ecrire, type Contexte } from './inscriptions';
import type { Journal } from './journal';
import { Base, type JetonsQrLocaux } from './stockage';
import { DELAI_REPONSE } from './session';

export type JetonsQr = Record<RoleQr, string | null>;

export type ErreurAccesQr = 'HORS_LIGNE' | 'PAS_PILOTE' | 'SESSION_INVALIDE' | 'ERREUR_INATTENDUE';

export interface OptionsAccesQr {
  /** Adresse HTTP du serveur ; null s'il n'est pas configuré. */
  urlServeur: string | null;
  journal: Journal;
  jeton: () => Promise<string | null>;
  nomBase?: string;
  envoyer?: typeof fetch;
  enLigne?: () => boolean;
  /** Source d'aléa (permet un jeton connu dans les tests). */
  aleatoire?: (octets: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;
}

/** CA-2 : jeton aléatoire de 128 bits, en base64url (22 caractères). */
export function nouveauJetonQr(
  aleatoire: (octets: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer> = (octets) => crypto.getRandomValues(octets),
): string {
  return encoderBase64Url(aleatoire(new Uint8Array(16)));
}

/** CA-2 : empreinte SHA-256 d'un jeton, en hexadécimal ; c'est elle seule qui va au journal. */
export async function empreinteJetonQr(jeton: string): Promise<string> {
  const condensat = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(jeton)));
  return [...condensat].map((octet) => octet.toString(16).padStart(2, '0')).join('');
}

export function creerAccesQr({
  urlServeur,
  journal,
  jeton,
  nomBase = 'poulePosition',
  envoyer = (...args) => fetch(...args),
  enLigne = () => navigator.onLine,
  aleatoire,
}: OptionsAccesQr) {
  const base = new Base(nomBase);
  const vides = (): JetonsQr => ({ arbitre: null, tireur: null });

  async function local(epreuveId: string): Promise<JetonsQr> {
    const ligne = await base.jetonsQr.get(epreuveId);
    return ligne ? { arbitre: ligne.arbitre, tireur: ligne.tireur } : vides();
  }

  async function garder(epreuveId: string, jetons: JetonsQr): Promise<void> {
    await base.jetonsQr.put({ epreuveId, ...jetons } satisfies JetonsQrLocaux);
  }

  async function requete(chemin: string, methode: 'GET' | 'PUT', corps?: unknown): Promise<unknown | null> {
    const jetonSession = urlServeur && enLigne() ? await jeton() : null;
    if (!jetonSession) return null;
    try {
      const reponse = await envoyer(`${urlServeur}${chemin}`, {
        method: methode,
        signal: AbortSignal.timeout(DELAI_REPONSE),
        headers: {
          Authorization: `Bearer ${jetonSession}`,
          ...(corps !== undefined && { 'Content-Type': 'application/json' }),
        },
        ...(corps !== undefined && { body: JSON.stringify(corps) }),
      });
      return await reponse.json().catch(() => undefined);
    } catch {
      return null;
    }
  }

  /** Confie un jeton au serveur, puis inscrit son empreinte au journal et le garde sur ce PC. */
  async function definir(
    epreuveId: string,
    role: RoleQr,
    contexte: Contexte,
  ): Promise<{ ok: true; jeton: string } | { ok: false; erreur: ErreurAccesQr }> {
    const nouveau = nouveauJetonQr(aleatoire);
    const brut = await requete(`/epreuves/${epreuveId}/jetons/${role}`, 'PUT', {
      appareilId: await journal.appareil(),
      jeton: nouveau,
    });
    if (brut === null) return { ok: false, erreur: 'HORS_LIGNE' };
    const reponse = analyserReponseJetonQr(brut);
    if (!reponse.ok) {
      if (reponse.erreur === 'PAS_PILOTE') return { ok: false, erreur: 'PAS_PILOTE' };
      const session = ['SESSION_INVALIDE', 'COMPTE_MODIFIE', 'COMPTE_RETIRE'].includes(reponse.erreur);
      return { ok: false, erreur: session ? 'SESSION_INVALIDE' : 'ERREUR_INATTENDUE' };
    }
    const empreinte = await empreinteJetonQr(nouveau);
    await ecrire(journal, epreuveId, { type: 'JetonQrDefini', donnees: { role, empreinte } }, contexte);
    await garder(epreuveId, { ...(await local(epreuveId)), [role]: nouveau });
    return { ok: true, jeton: nouveau };
  }

  return {
    /** Jetons gardés sur ce PC (hors ligne compris). */
    local,

    /**
     * CA-1 : jetons à afficher. Ceux de ce PC d'abord ; en ligne, ceux du serveur les complètent ou les remplacent (un
     * autre PC a pu régénérer, ou ce PC n'est pas le pilote), et sont gardés pour le hors ligne.
     */
    async lire(epreuveId: string): Promise<JetonsQr> {
      const gardes = await local(epreuveId);
      const brut = await requete(`/epreuves/${epreuveId}/jetons`, 'GET');
      if (brut === null) return gardes;
      const reponse = analyserReponseJetonsQr(brut);
      if (!reponse.ok) return gardes;
      const lus = { arbitre: reponse.arbitre ?? gardes.arbitre, tireur: reponse.tireur ?? gardes.tireur };
      await garder(epreuveId, lus);
      return lus;
    },

    /** CA-2 : en ligne, le pilote génère le jeton de chaque rôle qui n'en a pas encore. */
    async assurer(epreuveId: string, existants: JetonsQr, contexte: Contexte): Promise<JetonsQr> {
      const jetons = { ...existants };
      for (const role of ROLES_QR) {
        if (jetons[role]) continue;
        const resultat = await definir(epreuveId, role, contexte);
        if (!resultat.ok) break;
        jetons[role] = resultat.jeton;
      }
      return jetons;
    },

    /** CA-4 : remplace le jeton d'un rôle (en ligne, pilote seulement) ; l'ancien lien cesse de donner accès. */
    regenerer: definir,
  };
}

export type AccesQrClient = ReturnType<typeof creerAccesQr>;
