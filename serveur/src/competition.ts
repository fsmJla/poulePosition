// Durable Object « Competition » : une instance par compétition (idFromName(`competition:<clubId>:<id>`), ADR-0014).
// US-001 : accepte les connexions et souhaite la bienvenue. WebSockets en hibernation : une compétition
// silencieuse ne consomme pas de durée, et le ping reçoit son pong sans réveiller l'objet (ADR-0004).
// US-022 (ADR-0016) : copie du journal envoyée par le pilote, ajoutée lot par lot, et appareil pilote.
import { DurableObject } from 'cloudflare:workers';
import { messageBienvenue, messageErreur, MESSAGE_PING, MESSAGE_PONG } from '@poule-position/protocole';
import type { DemandeEnvoi } from '@poule-position/protocole';
import type { Evenement } from '@poule-position/domaine';
import { erreurMessageClient } from './logique';
import { deciderAjout, type DecisionAjout, type EtatJournal } from './replication';
import type { Env } from './index';

/** Clé de l'unique ligne de la table `pilote`. */
const LIGNE_UNIQUE = 'courante';

export class Competition extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(MESSAGE_PING, MESSAGE_PONG));
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS evenements (seq INTEGER PRIMARY KEY, contenu TEXT NOT NULL)`);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS pilote (cle TEXT PRIMARY KEY, appareil TEXT NOT NULL)`);
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

  /** Ajoute un lot s'il vient du pilote et suit le dernier seq (ADR-0016) ; le premier lot fixe le pilote. */
  ajouter(lieu: { clubId: string; competitionId: string }, demande: DemandeEnvoi): DecisionAjout {
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

  /** Journal complet, ou null si la compétition n'a encore rien reçu. */
  lire(): { evenements: Evenement[]; dernierSeq: number; piloteAppareil: string } | null {
    const { dernierSeq, piloteAppareil } = this.etat();
    if (piloteAppareil === null) return null;
    const evenements = this.ctx.storage.sql
      .exec<{ contenu: string }>('SELECT contenu FROM evenements ORDER BY seq')
      .toArray()
      .map(({ contenu }) => JSON.parse(contenu) as Evenement);
    return { evenements, dernierSeq, piloteAppareil };
  }

  override async fetch(requete: Request): Promise<Response> {
    const competitionId = new URL(requete.url).searchParams.get('competitionId') ?? '';
    const [client, serveur] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(serveur);
    serveur.send(messageBienvenue(competitionId));
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
