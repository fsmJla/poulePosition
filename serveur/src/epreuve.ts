// Durable Object « Epreuve » : une instance par épreuve (idFromName(`epreuve:<clubId>:<id>`), ADR-0014).
// US-001 : accepte les connexions et souhaite la bienvenue. WebSockets en hibernation : une épreuve
// silencieuse ne consomme pas de durée, et le ping reçoit son pong sans réveiller l'objet (ADR-0004).
// US-022 (ADR-0016) : copie du journal envoyée par le pilote, ajoutée lot par lot, et appareil pilote.
import { DurableObject } from 'cloudflare:workers';
import { messageBienvenue, messageErreur, MESSAGE_PING, MESSAGE_PONG } from '@poule-position/protocole';
import type { DemandeEnvoi, DemandePriseDeMain } from '@poule-position/protocole';
import type { Evenement } from '@poule-position/domaine';
import { erreurMessageClient } from './logique';
import {
  deciderAjout,
  deciderPresence,
  deciderPriseDeMain,
  piloteConnecte,
  type DecisionAjout,
  type DecisionPresence,
  type DecisionPriseDeMain,
  type EtatJournal,
} from './replication';
import type { Env } from './index';

/** Clé de l'unique ligne de la table `pilote`. */
const LIGNE_UNIQUE = 'courante';

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
    // US-029 : dernier signe de vie du pilote (lot ou battement), pour savoir s'il est connecté.
    sql.exec(`CREATE TABLE IF NOT EXISTS presence (cle TEXT PRIMARY KEY, vu_le INTEGER NOT NULL)`);
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

  private noterPresence(maintenant: number): void {
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO presence (cle, vu_le) VALUES (?, ?)', LIGNE_UNIQUE, maintenant);
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
      this.noterPresence(Date.now());
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
      this.noterPresence(Date.now());
      const journal = this.lire() as NonNullable<ReturnType<Epreuve['lire']>>;
      return { ok: true as const, ancienAppareil: decision.ancienAppareil, ...journal };
    });
  }

  /** US-029 CA-2 : battement du pilote ; un autre appareil reçoit `PAS_PILOTE`. */
  battement(appareilId: string): DecisionPresence {
    return this.ctx.storage.transactionSync(() => {
      const decision = deciderPresence(this.etat(), appareilId);
      if (decision.ok) this.noterPresence(Date.now());
      return decision;
    });
  }

  /** US-029 CA-4 : pilote en place et présence, ou null si l’épreuve n'a encore rien reçu. */
  etatPilote(): { piloteAppareil: string; connecte: boolean } | null {
    const { piloteAppareil } = this.etat();
    if (piloteAppareil === null) return null;
    const [ligne] = this.ctx.storage.sql
      .exec<{ vu_le: number }>('SELECT vu_le FROM presence WHERE cle = ?', LIGNE_UNIQUE)
      .toArray();
    return { piloteAppareil, connecte: piloteConnecte(ligne?.vu_le ?? null, Date.now()) };
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

  override async fetch(requete: Request): Promise<Response> {
    const epreuveId = new URL(requete.url).searchParams.get('epreuveId') ?? '';
    const [client, serveur] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(serveur);
    serveur.send(messageBienvenue(epreuveId));
    return new Response(null, { status: 101, webSocket: client });
  }

  override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    ws.send(messageErreur(erreurMessageClient(message)));
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
