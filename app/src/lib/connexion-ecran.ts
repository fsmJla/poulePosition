// Écran géant (US-134, ADR-0029) : l'écran échange le jeton de son lien contre un ticket de 60 s, ouvre sa socket de
// contrôle (ses réglages, la vue imposée) et une socket de lecture par épreuve cochée (la vue en direct). Il se
// reconnecte seul, avec un nouveau ticket ; un lien régénéré ou un écran supprimé le ferme (`4003`).
import type { VueDirect } from '@poule-position/domaine';
import { FERMETURES, type EcranPublic, type ReponseTicketEcran } from '@poule-position/protocole';
import { demarrerConnexion, type Adresse, type SocketMinimale } from './connexion';

export interface VueRecue {
  vue: VueDirect;
  /** Heure de publication par le pilote (ms). */
  publieeLe: number;
}

export interface EtatEcran {
  ecran: EcranPublic | null;
  titre: string;
  vues: ReadonlyMap<string, VueRecue>;
  /** Pilote connecté, par épreuve (absent : inconnu). */
  pilotes: ReadonlyMap<string, boolean>;
  /** CA-4 : l'écran ne joint plus le serveur. */
  horsLigne: boolean;
  /** CA-5 : lien régénéré, écran supprimé ou jeton faux. */
  lienInvalide: boolean;
}

export interface OptionsConnexionEcran {
  /** Adresse WebSocket du serveur (`wss://…`). */
  urlServeur: string | undefined;
  /** Adresse HTTP du serveur, pour le ticket. */
  urlHttp: string | null;
  ecranId: string;
  jeton: string;
  surEtat: (etat: EtatEcran) => void;
  creerSocket?: (url: string) => SocketMinimale;
  envoyer?: typeof fetch;
  maintenant?: () => number;
}

/** Marge sous laquelle un ticket est jugé trop près de son expiration pour ouvrir une socket. */
const MARGE_TICKET = 10_000;

export function creerConnexionEcran({
  urlServeur,
  urlHttp,
  ecranId,
  jeton,
  surEtat,
  creerSocket,
  envoyer = (...args) => fetch(...args),
  maintenant = () => Date.now(),
}: OptionsConnexionEcran) {
  const base = urlServeur?.trim().replace(/\/+$/, '') ?? '';
  const vues = new Map<string, VueRecue>();
  const pilotes = new Map<string, boolean>();
  const lecteurs = new Map<string, () => void>();
  let ecran: EcranPublic | null = null;
  let titre = '';
  let lienInvalide = false;
  let controleConnecte = false;
  let ticket: { valeur: string; expireLe: number } | null = null;
  let arreterControle: () => void = () => {};

  const publier = () =>
    surEtat({ ecran, titre, vues, pilotes, horsLigne: !controleConnecte && !lienInvalide, lienInvalide });

  /** Un ticket encore valable, ou un nouveau ; null si le lien ne vaut plus rien (CA-5) ou si le serveur est injoignable. */
  async function obtenirTicket(): Promise<string | null | 'invalide'> {
    if (ticket && ticket.expireLe - MARGE_TICKET > maintenant()) return ticket.valeur;
    if (!urlHttp) return null;
    try {
      const reponse = await envoyer(`${urlHttp}/ecrans/${ecranId}/ticket`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jeton }),
      });
      if (reponse.status === 401) return 'invalide';
      const corps = (await reponse.json()) as ReponseTicketEcran;
      if (!corps.ok) return null;
      ticket = { valeur: corps.ticket, expireLe: corps.expireLe };
      titre = corps.titre;
      if (!ecran) ecran = corps.ecran;
      return corps.ticket;
    } catch {
      return null;
    }
  }

  function invalider() {
    lienInvalide = true;
    arreter();
    publier();
  }

  async function adresseDe(chemin: string): Promise<Adresse> {
    const obtenu = await obtenirTicket();
    if (obtenu === 'invalide') {
      queueMicrotask(invalider);
      return { arreter: true };
    }
    return obtenu ? { url: `${base}${chemin}?ticket=${encodeURIComponent(obtenu)}` } : { attendre: true };
  }

  /** Ouvre la socket de lecture des épreuves cochées, ferme celles qui ne le sont plus. */
  function actualiserLecteurs() {
    const voulues = new Set(ecran?.epreuves ?? []);
    for (const [epreuveId, fermer] of lecteurs) {
      if (voulues.has(epreuveId)) continue;
      fermer();
      lecteurs.delete(epreuveId);
      vues.delete(epreuveId);
      pilotes.delete(epreuveId);
    }
    for (const epreuveId of voulues) {
      if (lecteurs.has(epreuveId)) continue;
      const { arreter: fermer } = demarrerConnexion({
        adresse: base ? () => adresseDe(`/epreuves/${epreuveId}/direct`) : null,
        creerSocket,
        surEtat: () => {},
        surMessage: (message) => {
          if (message.type === 'vueDirect') {
            vues.set(epreuveId, { vue: message.vue, publieeLe: message.publieeLe ?? maintenant() });
            publier();
          } else if (message.type === 'table') {
            pilotes.set(epreuveId, message.connectee);
            publier();
          }
        },
      });
      lecteurs.set(epreuveId, fermer);
    }
  }

  function demarrer() {
    const { arreter } = demarrerConnexion({
      adresse: base ? () => adresseDe(`/ecrans/${ecranId}/connexion`) : null,
      creerSocket,
      surEtat: (etat) => {
        controleConnecte = etat === 'connecte';
        publier();
      },
      surMessage: (message) => {
        if (message.type !== 'ecran') return;
        ecran = message.ecran;
        actualiserLecteurs();
        publier();
      },
      surFin: (code) => {
        if (code === FERMETURES.EXCLUE) invalider();
      },
    });
    arreterControle = arreter;
  }

  function arreter() {
    arreterControle();
    for (const fermer of lecteurs.values()) fermer();
    lecteurs.clear();
  }

  return { demarrer, arreter };
}
