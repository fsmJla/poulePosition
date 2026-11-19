// Saisie par smartphone (US-097, ADR-0005 et ADR-0007) : un téléphone entre par le lien d'un QR code, sans compte. Il
// garde sur lui le jeton, son identifiant d'appareil, le nom et la piste de l'arbitre, et la dernière vue de saisie
// reçue de la table : il retrouve ainsi son écran au retour sur le lien, même sans réseau.
import {
  FERMETURES,
  messageSaisie,
  type Accuse,
  type MessageServeur,
  type SaisieTelephone,
} from '@poule-position/protocole';
import type { RoleQr, VueSaisie } from '@poule-position/domaine';
import { demarrerConnexion, urlConnexion, type EtatConnexion, type SocketMinimale } from './connexion';

/** Ce que le téléphone garde pour une épreuve. */
export interface MemoireSaisie {
  jeton: string;
  appareilId: string | null;
  role: RoleQr | null;
  nom: string | null;
  piste: number | null;
  vue: VueSaisie | null;
  /** US-099 CA-4 : saisies envoyées sans accusé de la table (renvoyées à la reconnexion, US-102). */
  enAttente?: SaisieTelephone[];
}

/** CA-2 et US-096 CA-6 : motif d'un refus du serveur. */
export type RefusSaisie = 'lien' | 'terminee' | 'trop';

export interface EtatSaisie {
  connexion: EtatConnexion;
  /** CA-5 : la table (le PC pilote) est connectée ; faux tant que le serveur ne l'a pas dit. */
  table: boolean;
  role: RoleQr | null;
  appareilId: string | null;
  vue: VueSaisie | null;
  refus: RefusSaisie | null;
  /** US-099 : accusés reçus de la table, par identifiant de saisie. */
  accuses: Record<string, Accuse>;
}

/** Longueur maximale du nom d'un arbitre (CA-3). */
export const LONGUEUR_MAX_NOM = 40;

const cleMemoire = (epreuveId: string) => `saisie:${epreuveId}`;

export function lireMemoire(epreuveId: string, stockage: Storage | null = stockageLocal()): MemoireSaisie | null {
  try {
    const texte = stockage?.getItem(cleMemoire(epreuveId));
    return texte ? (JSON.parse(texte) as MemoireSaisie) : null;
  } catch {
    return null;
  }
}

export function ecrireMemoire(epreuveId: string, memoire: MemoireSaisie, stockage: Storage | null = stockageLocal()) {
  try {
    stockage?.setItem(cleMemoire(epreuveId), JSON.stringify(memoire));
  } catch {
    // Stockage refusé (navigation privée) : le téléphone redemandera le nom et la piste.
  }
}

function stockageLocal(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Le jeton porté par le fragment du lien du QR code (`#j=<jeton>`), ou null. */
export function jetonDuFragment(fragment: string): string | null {
  const jeton = new URLSearchParams(fragment.replace(/^#/, '')).get('j');
  return jeton && /^[A-Za-z0-9_-]{22}$/.test(jeton) ? jeton : null;
}

/** CA-1 : les pistes qui ont une poule, avec leurs poules dans l'ordre (« Poule 2 », ou « Poules 2 et 6 »). */
export function pistesDeLaVue(vue: VueSaisie | null): { piste: number; poules: number[] }[] {
  const pistes = new Map<number, number[]>();
  for (const { piste, numero } of vue?.poules ?? []) pistes.set(piste, [...(pistes.get(piste) ?? []), numero]);
  return [...pistes.entries()]
    .sort(([a], [b]) => a - b)
    .map(([piste, poules]) => ({ piste, poules: poules.sort((a, b) => a - b) }));
}

/** Motif d'une fermeture définitive du serveur, ou null pour une coupure ordinaire. */
export function refusDuCode(code: number): RefusSaisie | null {
  if (code === FERMETURES.EXCLUE) return 'lien';
  if (code === FERMETURES.FERMEE) return 'terminee';
  if (code === FERMETURES.REFUS) return 'trop';
  return null;
}

export interface OptionsSaisie {
  /** Adresse WebSocket du serveur ; absente s'il n'est pas configuré. */
  urlServeur: string | undefined;
  epreuveId: string;
  memoire: MemoireSaisie;
  /** Garde la mémoire à chaque changement (identifiant, vue). */
  garder: (memoire: MemoireSaisie) => void;
  creerSocket?: (url: string) => SocketMinimale;
}

/** Ouvre la connexion du téléphone et la tient ; renvoie de quoi suivre son état et l'arrêter. */
export function creerSaisieSmartphone({ urlServeur, epreuveId, memoire, garder, creerSocket }: OptionsSaisie) {
  let courante = { ...memoire };
  const ecouteurs = new Set<(etat: EtatSaisie) => void>();
  let etat: EtatSaisie = {
    connexion: 'connexion',
    table: false,
    role: memoire.role,
    appareilId: memoire.appareilId,
    vue: memoire.vue,
    refus: null,
    accuses: {},
  };
  const changer = (modif: Partial<EtatSaisie>) => {
    etat = { ...etat, ...modif };
    ecouteurs.forEach((ecouteur) => ecouteur(etat));
  };
  const memoriser = (modif: Partial<MemoireSaisie>) => {
    courante = { ...courante, ...modif };
    garder(courante);
  };

  const base = urlConnexion(urlServeur, epreuveId);
  const { arreter, envoyer } = demarrerConnexion({
    adresse: base
      ? async () => {
          const appareil = courante.appareilId ? `&appareil=${encodeURIComponent(courante.appareilId)}` : '';
          return { url: `${base}?j=${encodeURIComponent(courante.jeton)}${appareil}` };
        }
      : null,
    creerSocket,
    surEtat: (connexion) => changer({ connexion, ...(connexion !== 'connecte' && { table: false }) }),
    surFin: (code) => changer({ refus: refusDuCode(code) ?? 'lien', table: false }),
    surMessage: (message: MessageServeur) => {
      if (message.type === 'acces') {
        memoriser({ role: message.role, appareilId: message.appareilId });
        changer({ role: message.role, appareilId: message.appareilId });
      } else if (message.type === 'table') changer({ table: message.connectee });
      else if (message.type === 'vue') {
        memoriser({ vue: message.vue });
        changer({ vue: message.vue });
      } else if (message.type === 'accuse') {
        const { accuse } = message;
        // Une saisie suspendue reste à faire sur papier ; les autres réponses closent la saisie.
        memoriser({ enAttente: (courante.enAttente ?? []).filter(({ id }) => id !== accuse.id) });
        changer({ accuses: { ...etat.accuses, [accuse.id]: accuse } });
      }
    },
  });

  return {
    etat: () => etat,
    surEtat(ecouteur: (etat: EtatSaisie) => void): () => void {
      ecouteurs.add(ecouteur);
      ecouteur(etat);
      return () => ecouteurs.delete(ecouteur);
    },
    /** CA-3 et CA-4 : retient le nom et la piste de l'arbitre sur ce téléphone. */
    choisir(nom: string, piste: number) {
      memoriser({ nom: nom.trim().slice(0, LONGUEUR_MAX_NOM), piste });
    },
    memoire: () => courante,
    /**
     * US-099 CA-4 : envoie une saisie à la table et la garde « en attente » jusqu'à l'accusé ; faux si la connexion
     * n'est pas établie (rien n'est alors envoyé).
     */
    envoyerSaisie(saisie: SaisieTelephone): boolean {
      if (!envoyer(messageSaisie(saisie))) return false;
      memoriser({ enAttente: [...(courante.enAttente ?? []), saisie] });
      return true;
    },
    arreter,
  };
}

export type SaisieSmartphone = ReturnType<typeof creerSaisieSmartphone>;
