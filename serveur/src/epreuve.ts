// Durable Object « Epreuve » : une instance par épreuve (idFromName(`epreuve:<clubId>:<id>`), ADR-0014).
// US-001 : accepte les connexions et souhaite la bienvenue. WebSockets en hibernation : une épreuve
// silencieuse ne consomme pas de durée, et le ping reçoit son pong sans réveiller l'objet (ADR-0004).
// US-022 (ADR-0016) : copie du journal envoyée par le pilote, ajoutée lot par lot, et appareil pilote.
// US-094 (ADR-0028) : WebSocket du pilote, ouverte avec un ticket vérifié par le Worker ; elle fait sa présence.
import { DurableObject } from 'cloudflare:workers';
import {
  analyserMessageClient,
  FERMETURES,
  messageBienvenue,
  messageErreur,
  messageVue,
  MESSAGE_PING,
  MESSAGE_PONG,
} from '@poule-position/protocole';
import type { DemandeEnvoi, DemandePriseDeMain } from '@poule-position/protocole';
import type { Evenement } from '@poule-position/domaine';
import {
  deciderAjout,
  deciderPriseDeMain,
  deciderTicket,
  piloteConnecte,
  type DecisionAjout,
  type DecisionTicket,
  type DecisionPriseDeMain,
  type EtatJournal,
} from './replication';
import type { Env } from './index';

/** Clé de l'unique ligne de la table `pilote`. */
const LIGNE_UNIQUE = 'courante';

/** Ce qu'une WebSocket garde d'elle-même (survit à l'hibernation). */
interface AttacheSocket {
  role: 'pilote';
  appareil: string;
  epreuveId: string;
  ouverteLe: number;
}

/** US-095 : étiquette des sockets qui reçoivent la vue de saisie (smartphones des arbitres et des tireurs, US-097). */
export const ETIQUETTE_SAISIE = 'saisie';

/** US-096 : étiquette des smartphones entrés avec le QR code d'un rôle (US-097, US-103). */
export const etiquetteQr = (role: 'arbitre' | 'tireur') => `qr:${role}`;

/** Étiquette des sockets d'un appareil pilote (une seule à la fois). */
const etiquettePilote = (appareil: string) => `pilote:${appareil}`;

export class Epreuve extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(MESSAGE_PING, MESSAGE_PONG));
    this.creerTables();
  }

  private creerTables(): void {
    const { sql } = this.ctx.storage;
    sql.exec(`CREATE TABLE IF NOT EXISTS evenements (seq INTEGER PRIMARY KEY, contenu TEXT NOT NULL)`);
    sql.exec(`CREATE TABLE IF NOT EXISTS pilote (cle TEXT PRIMARY KEY, appareil TEXT NOT NULL)`);
    // US-096 : jetons des QR codes, en clair (le journal n'en garde que l'empreinte), un par rôle.
    sql.exec(`CREATE TABLE IF NOT EXISTS jetons (role TEXT PRIMARY KEY, jeton TEXT NOT NULL)`);
    // US-095 : dernière vue de saisie publiée par le pilote, gardée pour les smartphones qui se connectent.
    sql.exec(`CREATE TABLE IF NOT EXISTS vue (cle TEXT PRIMARY KEY, contenu TEXT NOT NULL)`);
    // US-094 : la présence vient de la WebSocket du pilote ; la table des battements (US-029) n'existe plus.
    sql.exec(`DROP TABLE IF EXISTS presence`);
  }

  private etat(): EtatJournal {
    const [dernier] = this.ctx.storage.sql
      .exec<{ seq: number | null }>('SELECT MAX(seq) AS seq FROM evenements')
      .toArray();
    const [pilote] = this.ctx.storage.sql
      .exec<{ appareil: string }>('SELECT appareil FROM pilote WHERE cle = ?', LIGNE_UNIQUE)
      .toArray();
    return { dernierSeq: dernier?.seq ?? 0, piloteAppareil: pilote?.appareil ?? null };
  }

  /** Ferme les sockets d'une étiquette (déjà fermées : sans effet). */
  private fermer(etiquette: string, code: number, raison: string, sauf?: WebSocket): void {
    for (const socket of this.ctx.getWebSockets(etiquette)) {
      if (socket === sauf) continue;
      try {
        socket.close(code, raison);
      } catch {
        // déjà fermée
      }
    }
  }

  /** Ajoute un lot s'il vient du pilote et suit le dernier seq (ADR-0016) ; le premier lot fixe le pilote. */
  ajouter(lieu: { clubId: string; epreuveId: string }, demande: DemandeEnvoi): DecisionAjout {
    return this.ctx.storage.transactionSync(() => {
      const decision = deciderAjout(this.etat(), demande, lieu);
      if (!decision.ok) return decision;
      for (const evenement of demande.evenements) {
        this.ctx.storage.sql.exec(
          'INSERT INTO evenements (seq, contenu) VALUES (?, ?)',
          evenement.seq,
          JSON.stringify(evenement),
        );
      }
      this.ctx.storage.sql.exec(
        'INSERT OR IGNORE INTO pilote (cle, appareil) VALUES (?, ?)',
        LIGNE_UNIQUE,
        demande.appareilId,
      );
      return decision;
    });
  }

  /** US-029 CA-1 : désigne l'appareil demandeur comme pilote et renvoie le journal complet. */
  prendreLaMain(
    demande: DemandePriseDeMain,
  ):
    | (DecisionPriseDeMain & { ok: false })
    | { ok: true; ancienAppareil: string; evenements: Evenement[]; dernierSeq: number } {
    return this.ctx.storage.transactionSync(() => {
      const decision = deciderPriseDeMain(this.etat(), demande);
      if (!decision.ok) return decision;
      this.ctx.storage.sql.exec(
        'INSERT OR REPLACE INTO pilote (cle, appareil) VALUES (?, ?)',
        LIGNE_UNIQUE,
        demande.appareilId,
      );
      const journal = this.lire() as NonNullable<ReturnType<Epreuve['lire']>>;
      // US-094 CA-4 : l'ancien pilote est prévenu tout de suite, par la fermeture de sa WebSocket.
      if (decision.ancienAppareil !== demande.appareilId) {
        this.fermer(etiquettePilote(decision.ancienAppareil), FERMETURES.MAIN_PRISE, 'Main prise');
      }
      return { ok: true as const, ancienAppareil: decision.ancienAppareil, ...journal };
    });
  }

  /** US-094 CA-1 : un ticket n'est accordé qu'au pilote en place ; un ancien pilote reçoit `PAS_PILOTE`. */
  decisionTicket(appareilId: string): DecisionTicket {
    return deciderTicket(this.etat(), appareilId);
  }

  /** US-029 CA-4 et US-094 CA-2 : pilote en place et présence par sa WebSocket, ou null si l’épreuve n'a rien reçu. */
  etatPilote(): { piloteAppareil: string; connecte: boolean } | null {
    const { piloteAppareil } = this.etat();
    if (piloteAppareil === null) return null;
    const sockets = this.ctx.getWebSockets(etiquettePilote(piloteAppareil)).map((socket) => ({
      ouverteLe: (socket.deserializeAttachment() as AttacheSocket | null)?.ouverteLe ?? 0,
      dernierPing: this.ctx.getWebSocketAutoResponseTimestamp(socket)?.getTime() ?? null,
    }));
    return { piloteAppareil, connecte: piloteConnecte(sockets, Date.now()) };
  }

  /** Journal complet, ou null si l’épreuve n'a encore rien reçu. */
  lire(): { evenements: Evenement[]; dernierSeq: number; piloteAppareil: string } | null {
    const { dernierSeq, piloteAppareil } = this.etat();
    if (piloteAppareil === null) return null;
    const evenements = this.ctx.storage.sql
      .exec<{ contenu: string }>('SELECT contenu FROM evenements ORDER BY seq')
      .toArray()
      .map(({ contenu }) => JSON.parse(contenu) as Evenement);
    return { evenements, dernierSeq, piloteAppareil };
  }

  /**
   * US-039 CA-1 : efface le journal, le pilote et la présence, et ferme les connexions ouvertes. Sans effet sur un
   * objet déjà vide : une suppression rejouée termine le travail (CA-7).
   */
  async supprimer(): Promise<void> {
    for (const connexion of this.ctx.getWebSockets()) {
      try {
        connexion.close(1000, 'Épreuve supprimée');
      } catch {
        // déjà fermée
      }
    }
    await this.ctx.storage.deleteAll();
    // deleteAll emporte aussi les tables : l'objet, encore en mémoire, doit pouvoir répondre à une requête retardataire.
    this.creerTables();
  }

  /**
   * US-094 CA-1 : WebSocket du pilote, dont le Worker a vérifié le ticket. L'appareil doit être encore le pilote (une
   * prise de main a pu avoir lieu depuis le ticket) : sinon la socket est fermée (`4003`). Une nouvelle socket du même
   * appareil remplace l'ancienne (`4002`).
   */
  override async fetch(requete: Request): Promise<Response> {
    const parametres = new URL(requete.url).searchParams;
    const epreuveId = parametres.get('epreuveId') ?? '';
    const appareil = parametres.get('appareil') ?? '';
    const [client, serveur] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    const etiquette = etiquettePilote(appareil);
    this.ctx.acceptWebSocket(serveur, ['pilote', etiquette]);
    if (!appareil || this.etat().piloteAppareil !== appareil) {
      serveur.close(FERMETURES.EXCLUE, 'Pas le pilote');
      return new Response(null, { status: 101, webSocket: client });
    }
    serveur.serializeAttachment({ role: 'pilote', appareil, epreuveId, ouverteLe: Date.now() } satisfies AttacheSocket);
    this.fermer(etiquette, FERMETURES.REMPLACEE, 'Connexion remplacée', serveur);
    serveur.send(messageBienvenue(epreuveId));
    return new Response(null, { status: 101, webSocket: client });
  }

  /** US-096 CA-1 : jetons des QR codes en service, par rôle (null s'il n'y en a pas). */
  jetonsQr(): { arbitre: string | null; tireur: string | null } {
    const lignes = this.ctx.storage.sql
      .exec<{ role: string; jeton: string }>('SELECT role, jeton FROM jetons')
      .toArray();
    const de = (role: string) => lignes.find((ligne) => ligne.role === role)?.jeton ?? null;
    return { arbitre: de('arbitre'), tireur: de('tireur') };
  }

  /**
   * US-096 CA-2 et CA-4 : le pilote en place confie (ou remplace) le jeton d'un rôle. Les smartphones entrés avec l'ancien
   * jeton sont fermés (`4003`) : ils doivent scanner le nouveau QR code.
   */
  definirJetonQr(appareilId: string, role: 'arbitre' | 'tireur', jeton: string): DecisionTicket {
    return this.ctx.storage.transactionSync(() => {
      const decision = deciderTicket(this.etat(), appareilId);
      if (!decision.ok) return decision;
      const [ancien] = this.ctx.storage.sql
        .exec<{ jeton: string }>('SELECT jeton FROM jetons WHERE role = ?', role)
        .toArray();
      this.ctx.storage.sql.exec('INSERT OR REPLACE INTO jetons (role, jeton) VALUES (?, ?)', role, jeton);
      if (ancien && ancien.jeton !== jeton) this.fermer(etiquetteQr(role), FERMETURES.EXCLUE, 'Lien régénéré');
      return decision;
    });
  }

  /** US-095 CA-2 : dernière vue de saisie publiée (son texte JSON), ou null. */
  derniereVue(): string | null {
    const [ligne] = this.ctx.storage.sql
      .exec<{ contenu: string }>('SELECT contenu FROM vue WHERE cle = ?', LIGNE_UNIQUE)
      .toArray();
    return ligne?.contenu ?? null;
  }

  /**
   * US-095 CA-1, CA-2 et CA-4 : seul le pilote en place publie la vue de saisie de son épreuve ; le DO la garde (sans la
   * lire ni la recalculer) et la diffuse aux smartphones connectés. Tout autre message est refusé.
   */
  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const analyse = analyserMessageClient(message);
    if (!analyse.ok) {
      ws.send(messageErreur(analyse.erreur));
      return;
    }
    const attache = ws.deserializeAttachment() as AttacheSocket | null;
    const { vue } = analyse.message;
    const duPilote = attache?.role === 'pilote' && attache.appareil === this.etat().piloteAppareil;
    if (!duPilote || vue.epreuveId !== attache.epreuveId) {
      ws.send(messageErreur('TYPE_INTERDIT'));
      return;
    }
    const texte = JSON.stringify(vue);
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO vue (cle, contenu) VALUES (?, ?)', LIGNE_UNIQUE, texte);
    const diffusion = messageVue(vue);
    for (const socket of this.ctx.getWebSockets(ETIQUETTE_SAISIE)) {
      try {
        socket.send(diffusion);
      } catch {
        // socket en cours de fermeture
      }
    }
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    // Termine la fermeture côté serveur ; lève une exception si le runtime l'a déjà fait.
    try {
      ws.close();
    } catch {
      // déjà fermée
    }
  }
}
