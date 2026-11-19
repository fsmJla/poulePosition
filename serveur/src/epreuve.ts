// Durable Object « Epreuve » : une instance par épreuve (idFromName(`epreuve:<clubId>:<id>`), ADR-0014).
// US-001 : accepte les connexions et souhaite la bienvenue. WebSockets en hibernation : une épreuve
// silencieuse ne consomme pas de durée, et le ping reçoit son pong sans réveiller l'objet (ADR-0004).
// US-022 (ADR-0016) : copie du journal envoyée par le pilote, ajoutée lot par lot, et appareil pilote.
// US-094 (ADR-0028) : WebSocket du pilote, ouverte avec un ticket vérifié par le Worker ; elle fait sa présence.
import { DurableObject } from 'cloudflare:workers';
import type { RoleQr } from '@poule-position/domaine';
import { appareilRepris, prochainAppareil, type RefusAcces } from './saisie';
import {
  analyserMessageClient,
  FERMETURES,
  messageAcces,
  messageAppareils,
  messageAccuse,
  messageSaisie,
  messageBienvenue,
  messageErreur,
  messageTable,
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
  /** US-097 : le pilote, ou un smartphone entré avec le QR code d'un rôle. */
  role: 'pilote' | RoleQr;
  appareil: string;
  epreuveId: string;
  ouverteLe: number;
}

/** US-097 : code de fermeture d'un smartphone refusé (le téléphone en tire son message). */
const FERMETURE_REFUS: Record<RefusAcces, number> = {
  lien: FERMETURES.EXCLUE,
  terminee: FERMETURES.FERMEE,
  trop: FERMETURES.REFUS,
};

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
    // US-102 (ADR-0005) : boîte des saisies relayées à la table et pas encore accusées, livrées au retour du pilote.
    sql.exec(`CREATE TABLE IF NOT EXISTS boite (id TEXT PRIMARY KEY, contenu TEXT NOT NULL)`);
    // US-097 : smartphones entrés par QR code, avec leur identifiant (« t1 »…) et leur rôle.
    sql.exec(
      `CREATE TABLE IF NOT EXISTS appareils (id TEXT PRIMARY KEY, role TEXT NOT NULL, cree_le INTEGER NOT NULL)`,
    );
    // US-105 : dernière fois vu, et exclusion par la table (colonnes ajoutées aux tables existantes).
    for (const colonne of ['vu_le INTEGER', 'exclu INTEGER NOT NULL DEFAULT 0']) {
      try {
        sql.exec(`ALTER TABLE appareils ADD COLUMN ${colonne}`);
      } catch {
        // colonne déjà là
      }
    }
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
        this.diffuser(messageTable(false));
      }
      return { ok: true as const, ancienAppareil: decision.ancienAppareil, ...journal };
    });
  }

  /** US-094 CA-1 : un ticket n'est accordé qu'au pilote en place ; un ancien pilote reçoit `PAS_PILOTE`. */
  decisionTicket(appareilId: string): DecisionTicket {
    return deciderTicket(this.etat(), appareilId);
  }

  /** US-029 CA-4 et US-094 CA-2 : pilote en place et présence par sa WebSocket, ou null si l’épreuve n'a rien reçu. */
  etatPilote(sauf?: WebSocket): { piloteAppareil: string; connecte: boolean } | null {
    const { piloteAppareil } = this.etat();
    if (piloteAppareil === null) return null;
    const ouvertes = this.ctx.getWebSockets(etiquettePilote(piloteAppareil)).filter((socket) => socket !== sauf);
    const sockets = ouvertes.map((socket) => ({
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
    const role = parametres.get('role');
    const refus = parametres.get('refus') as RefusAcces | null;
    if (role !== null || refus !== null) {
      return this.accepterSmartphone(epreuveId, role as RoleQr | null, refus, parametres.get('appareil'));
    }
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
    // US-097 CA-5 : les smartphones apprennent que la table est connectée ; la table, combien ils sont (US-100).
    this.diffuser(messageTable(true));
    this.compterAppareils();
    // US-102 CA-6 : la table reçoit les saisies restées dans la boîte pendant son absence.
    for (const { contenu } of this.ctx.storage.sql.exec<{ contenu: string }>('SELECT contenu FROM boite').toArray()) {
      serveur.send(contenu);
    }
    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * US-097 CA-1 à CA-4 : WebSocket d'un smartphone dont le Worker a vérifié le jeton. Refusé, il est fermé avec le code
   * du motif ; accepté, il reçoit son identifiant d'appareil (repris s'il en présente un de ce rôle), l'état de la table
   * et la dernière vue de saisie (US-095 CA-2).
   */
  private accepterSmartphone(
    epreuveId: string,
    role: RoleQr | null,
    refus: RefusAcces | null,
    presente: string | null,
  ): Response {
    const [client, serveur] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
    if (refus || !role) {
      this.ctx.acceptWebSocket(serveur, ['refuse']);
      serveur.close(FERMETURE_REFUS[refus ?? 'lien'], 'Accès refusé');
      return new Response(null, { status: 101, webSocket: client });
    }
    const appareil = this.ctx.storage.transactionSync(() => {
      const existants = this.ctx.storage.sql
        .exec<{ id: string; role: string }>('SELECT id, role FROM appareils')
        .toArray();
      const repris = appareilRepris(presente, existants, role);
      if (repris) return repris;
      const nouveau = prochainAppareil(existants.map(({ id }) => id));
      this.ctx.storage.sql.exec(
        'INSERT INTO appareils (id, role, cree_le) VALUES (?, ?, ?)',
        nouveau,
        role,
        Date.now(),
      );
      return nouveau;
    });
    // US-105 CA-2 : un appareil exclu ne se reconnecte pas avec son identifiant.
    const [exclusion] = this.ctx.storage.sql
      .exec<{ exclu: number }>('SELECT exclu FROM appareils WHERE id = ?', appareil)
      .toArray();
    if (exclusion?.exclu) {
      this.ctx.acceptWebSocket(serveur, ['refuse']);
      serveur.close(FERMETURES.APPAREIL_EXCLU, 'Appareil exclu');
      return new Response(null, { status: 101, webSocket: client });
    }
    this.ctx.storage.sql.exec('UPDATE appareils SET vu_le = ? WHERE id = ?', Date.now(), appareil);
    this.ctx.acceptWebSocket(serveur, [ETIQUETTE_SAISIE, etiquetteQr(role), `appareil:${appareil}`]);
    serveur.serializeAttachment({ role, appareil, epreuveId, ouverteLe: Date.now() } satisfies AttacheSocket);
    serveur.send(messageBienvenue(epreuveId));
    serveur.send(messageAcces(role, appareil));
    serveur.send(messageTable(this.etatPilote()?.connecte ?? false));
    const vue = this.derniereVue();
    if (vue !== null) serveur.send(`{"v":1,"type":"vue","vue":${vue}}`);
    this.compterAppareils();
    return new Response(null, { status: 101, webSocket: client });
  }

  /**
   * US-100 CA-1 : dit à la table combien de smartphones sont connectés (sans compter une socket qui se ferme) ;
   * US-105 CA-1 : et la liste des appareils connus, connectés ou non, exclus ou non.
   */
  private compterAppareils(sauf?: WebSocket): void {
    const sockets = this.ctx.getWebSockets(ETIQUETTE_SAISIE).filter((socket) => socket !== sauf);
    const enLigne = new Set(
      sockets.map((socket) => (socket.deserializeAttachment() as AttacheSocket | null)?.appareil),
    );
    const liste = this.ctx.storage.sql
      .exec<{ id: string; role: string; vu_le: number | null; exclu: number }>(
        'SELECT id, role, vu_le, exclu FROM appareils ORDER BY cree_le',
      )
      .toArray()
      .map(({ id, role, vu_le, exclu }) => ({
        id,
        role: role as RoleQr,
        connecte: enLigne.has(id),
        vuLe: vu_le,
        exclu: exclu === 1,
      }));
    const message = messageAppareils(sockets.length, liste);
    for (const pilote of this.ctx.getWebSockets('pilote')) {
      try {
        pilote.send(message);
      } catch {
        // socket en cours de fermeture
      }
    }
  }

  /** Envoie un message à tous les smartphones de l'épreuve. */
  private diffuser(message: string): void {
    for (const socket of this.ctx.getWebSockets(ETIQUETTE_SAISIE)) {
      try {
        socket.send(message);
      } catch {
        // socket en cours de fermeture
      }
    }
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
    const { piloteAppareil } = this.etat();
    const duPilote = attache?.role === 'pilote' && attache.appareil === piloteAppareil;
    const message0 = analyse.message;
    // US-099 : la saisie d'un téléphone part à la table, avec le rôle et l'appareil de ce téléphone ; sans table
    // connectée, elle est suspendue (ADR-0005).
    if (message0.type === 'saisie') {
      if (!attache || attache.role === 'pilote') {
        ws.send(messageErreur('TYPE_INTERDIT'));
        return;
      }
      if (!this.etatPilote()?.connecte || !piloteAppareil) {
        ws.send(messageAccuse({ id: message0.saisie.id, decision: 'suspendue' }));
        return;
      }
      const relayee = messageSaisie({ ...message0.saisie, role: attache.role, appareilId: attache.appareil });
      // US-102 CA-6 : la saisie attend dans la boîte jusqu'à l'accusé (même identifiant : une seule fois).
      this.ctx.storage.sql.exec(
        'INSERT OR REPLACE INTO boite (id, contenu) VALUES (?, ?)',
        message0.saisie.id,
        relayee,
      );
      for (const pilote of this.ctx.getWebSockets(etiquettePilote(piloteAppareil))) pilote.send(relayee);
      return;
    }
    // US-105 CA-2 et CA-4 : le pilote exclut un appareil (sa socket est fermée, ses reconnexions refusées) ou le réadmet.
    if (message0.type === 'exclure') {
      if (!duPilote) {
        ws.send(messageErreur('TYPE_INTERDIT'));
        return;
      }
      this.ctx.storage.sql.exec(
        'UPDATE appareils SET exclu = ? WHERE id = ?',
        message0.exclu ? 1 : 0,
        message0.appareilId,
      );
      if (message0.exclu) this.fermer(`appareil:${message0.appareilId}`, FERMETURES.APPAREIL_EXCLU, 'Appareil exclu');
      this.compterAppareils();
      return;
    }
    // US-099 : l'accusé de la table revient au téléphone qui a saisi.
    if (message0.type === 'accuse') {
      if (!duPilote || !message0.appareilId) {
        ws.send(messageErreur('TYPE_INTERDIT'));
        return;
      }
      this.ctx.storage.sql.exec('DELETE FROM boite WHERE id = ?', message0.accuse.id);
      const retour = messageAccuse(message0.accuse);
      for (const telephone of this.ctx.getWebSockets(`appareil:${message0.appareilId}`)) telephone.send(retour);
      return;
    }
    const { vue } = message0;
    if (!duPilote || vue.epreuveId !== attache.epreuveId) {
      ws.send(messageErreur('TYPE_INTERDIT'));
      return;
    }
    const texte = JSON.stringify(vue);
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO vue (cle, contenu) VALUES (?, ?)', LIGNE_UNIQUE, texte);
    this.diffuser(messageVue(vue));
  }

  override async webSocketClose(ws: WebSocket): Promise<void> {
    // Termine la fermeture côté serveur ; lève une exception si le runtime l'a déjà fait.
    try {
      ws.close();
    } catch {
      // déjà fermée
    }
    // US-097 CA-5 : la table se déconnecte quand la dernière socket du pilote se ferme.
    const attache = ws.deserializeAttachment() as AttacheSocket | null;
    if (attache?.role === 'pilote' && !this.etatPilote(ws)?.connecte) this.diffuser(messageTable(false));
    if (attache && attache.role !== 'pilote') {
      // US-105 CA-1 : « vu à 10 h 46 ».
      this.ctx.storage.sql.exec('UPDATE appareils SET vu_le = ? WHERE id = ?', Date.now(), attache.appareil);
      this.compterAppareils(ws);
    }
  }
}
