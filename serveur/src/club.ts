// Durable Object « Club » : un objet par club (idFromName(`club:<clubId>`), ADR-0014). Comptes des administrateurs
// et des organisateurs (ADR-0006), essais de connexion erronés par e-mail (US-004) et demandes de réinitialisation
// par e-mail (US-019), index des épreuves du club (US-022, ADR-0016) et manifestations (US-023), en SQLite. Les
// écritures d'un même objet sont sérialisées : deux créations simultanées du premier administrateur, ou d'un même
// e-mail, ne peuvent pas aboutir toutes les deux, et deux modifications d'une même manifestation non plus.
import { DurableObject } from 'cloudflare:workers';
import {
  essaisVides,
  noterEchec,
  saisieBloquee,
  verifierChangementRole,
  verifierRetrait,
  REGLE_COMPTE,
  demandeAutorisee,
  expirationLien,
  lienExpire,
  noterDemande,
  estCouleurAvatar,
  estVide,
  estVideCompetition,
  estVisibleDuPublic,
  type DonneesCompetition,
  type EpreuvePublique,
  type EpreuveASupprimer,
  type ProprietaireFichier,
  type SorteFichier,
  type TypeFichier,
  type DonneesManifestation,
  type CouleurAvatar,
  type Essais,
  type Role,
} from '@poule-position/domaine';
import type {
  EpreuveIndexee,
  DemandeModificationCompetition,
  DemandeModificationManifestation,
  Competition,
  FichierJoint,
  Manifestation,
  ReponsePublique,
} from '@poule-position/protocole';
import { completerResume } from '@poule-position/protocole';
import type { Env } from './index';
import { requetesCompetitionsSeules, requetesInversionVocabulaire, type ColonneSql } from './logique';
import { ListeEnMemoire, type Lecture } from './liste-en-memoire';
import { deciderSuppression } from './replication';
import { StockageFichiers, type ResultatDepot } from './fichiers';

export interface NouveauCompte {
  email: string;
  nom: string;
  sel: string;
  /** HMAC poivré de la clé dérivée : jamais le mot de passe ni la clé elle-même. */
  verificateur: string;
}

/** Compte tel qu'il est stocké, pour la connexion (US-003) et la gestion des comptes (US-007). */
export interface CompteStocke {
  id: string;
  email: string;
  nom: string;
  role: Role;
  sel: string;
  verificateur: string;
  actif: boolean;
  temporaire: boolean;
  /** Version du mot de passe (US-010) : augmente à chaque changement, ce qui invalide les autres sessions. */
  versionMdp: number;
  /** Dernière connexion par mot de passe, en millisecondes, ou null (US-007). */
  derniereConnexion: number | null;
  /** Couleur d'avatar choisie (US-016), ou null : couleur par défaut, déduite de l'e-mail. */
  avatar: CouleurAvatar | null;
}

interface LigneCompte {
  id: string;
  email: string;
  nom: string;
  role: Role;
  sel: string;
  verificateur: string;
  actif: number;
  temporaire: number;
  versionMdp: number;
  derniereConnexion: number | null;
  avatar: string | null;
  [colonne: string]: SqlStorageValue;
}

export type ResultatCreation = { ok: true; email: string } | { ok: false; erreur: 'ADMINISTRATEUR_EXISTANT' };

export type ResultatCompte =
  | { ok: true; compte: CompteStocke }
  | { ok: false; erreur: 'EMAIL_DEJA_UTILISE' | 'COMPTE_INCONNU' | 'DERNIER_ADMINISTRATEUR' };

const COLONNES = `id, email, nom, role, sel, verificateur, actif, temporaire, version_mdp AS versionMdp,
  derniere_connexion AS derniereConnexion, avatar`;

/** CA-4 : journal du Worker, pour repérer un tableau dont le parcours devient coûteux (quota de lignes lues). */
const signalerLecture = (liste: string) => (lignesLues: number) =>
  console.log(JSON.stringify({ evenement: 'liste_lue', liste, lignesLues }));

export class Club extends DurableObject<Env> {
  /**
   * US-038 : les listes du club ne sont lues dans la base qu'une fois, puis gardées en mémoire. Le plan gratuit compte
   * chaque ligne parcourue : relire tout un tableau à chaque requête épuisait le quota quotidien.
   */
  private readonly index = new ListeEnMemoire<EpreuveIndexee>(
    () => this.lireListe('SELECT contenu FROM epreuves ORDER BY modifiee_le DESC'),
    signalerLecture('epreuves'),
  );
  private readonly pierresTombales = new ListeEnMemoire<string>(() => {
    const curseur = this.ctx.storage.sql.exec<{ id: string }>('SELECT id FROM epreuves_supprimees ORDER BY id');
    return { valeurs: curseur.toArray().map(({ id }) => id), lignesLues: curseur.rowsRead };
  }, signalerLecture('epreuves_supprimees'));
  private readonly listeManifestations = new ListeEnMemoire<Manifestation>(
    () => this.lireListe('SELECT contenu FROM manifestations ORDER BY debut, id'),
    signalerLecture('manifestations'),
  );
  private readonly listeCompetitions = new ListeEnMemoire<Competition>(
    () => this.lireListe('SELECT contenu FROM competitions ORDER BY manifestation_id, id'),
    signalerLecture('competitions'),
  );

  /** US-030 : affiches et feuilles de route des manifestations, compétitions et épreuves. */
  private readonly fichiers: StockageFichiers;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.fichiers = new StockageFichiers(ctx.storage.sql, signalerLecture('fichiers'));
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS comptes (
        id TEXT PRIMARY KEY,
        club_id TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        nom TEXT NOT NULL,
        role TEXT NOT NULL,
        sel TEXT NOT NULL,
        verificateur TEXT NOT NULL,
        actif INTEGER NOT NULL DEFAULT 1,
        temporaire INTEGER NOT NULL DEFAULT 0,
        cree_le INTEGER NOT NULL,
        version_mdp INTEGER NOT NULL DEFAULT 0,
        derniere_connexion INTEGER
      )`);
    // Migrations : colonnes ajoutées aux tables créées avant elles (US-010, US-007, US-016).
    const colonnes = ctx.storage.sql.exec<{ name: string }>('PRAGMA table_info(comptes)').toArray();
    const ajouter = (nom: string, definition: string) => {
      if (!colonnes.some(({ name }) => name === nom)) {
        ctx.storage.sql.exec(`ALTER TABLE comptes ADD COLUMN ${nom} ${definition}`);
      }
    };
    ajouter('version_mdp', 'INTEGER NOT NULL DEFAULT 0');
    ajouter('derniere_connexion', 'INTEGER');
    ajouter('avatar', 'TEXT');
    // US-004 : essais erronés par e-mail normalisé, que le compte existe ou non (CA-4). Purgés dès qu'ils ne servent
    // plus (alarme), pour ne pas garder les e-mails essayés (ADR-0014).
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS essais_comptes (
        email TEXT PRIMARY KEY,
        echecs TEXT NOT NULL,
        bloque_jusqua INTEGER NOT NULL,
        expire_le INTEGER NOT NULL
      )`);
    // US-019 : une demande de lien par compte ; seule l'empreinte du jeton est gardée (NULL une fois le lien utilisé),
    // avec les dates des demandes de l'heure (limite de 3) ; purgée à l'expiration.
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS demandes_reinitialisation (
        compte_id TEXT PRIMARY KEY,
        empreinte TEXT,
        expire_le INTEGER NOT NULL,
        demandes TEXT NOT NULL
      )`);
    // US-044 (ADR-0021) : les tables d'avant l'inversion du vocabulaire (données de test) sont supprimées, puis recréées
    // ci-dessous sous leur nouveau sens. Les comptes ne sont pas touchés.
    const colonnesEpreuves = ctx.storage.sql.exec<{ name: string }>('PRAGMA table_info(epreuves)').toArray();
    for (const requete of requetesInversionVocabulaire(colonnesEpreuves.map(({ name }) => name))) {
      ctx.storage.sql.exec(requete);
    }
    // US-045 : une compétition peut être seule, `manifestation_id` accepte NULL (ancien schéma : table recréée).
    const colonnesCompetitions = ctx.storage.sql.exec<Record<keyof ColonneSql, SqlStorageValue>>(
      'PRAGMA table_info(competitions)',
    );
    for (const requete of requetesCompetitionsSeules(colonnesCompetitions.toArray() as unknown as ColonneSql[])) {
      ctx.storage.sql.exec(requete);
    }
    // US-022 (ADR-0016) : une ligne par épreuve, le résumé fourni par le pilote complété par le Worker.
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS epreuves (
        id TEXT PRIMARY KEY,
        club_id TEXT NOT NULL,
        contenu TEXT NOT NULL,
        modifiee_le INTEGER NOT NULL
      )`);
    // US-039 (ADR-0019) : pierre tombale d'une épreuve supprimée, pour qu'aucun PC ne la recrée.
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS epreuves_supprimees (
        id TEXT PRIMARY KEY,
        supprimee_le INTEGER NOT NULL
      )`);
    // US-023 (ADR-0016 §4) : une ligne par manifestation ; `version` refuse l'écrasement d'une modification concurrente.
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS manifestations (
        id TEXT PRIMARY KEY,
        club_id TEXT NOT NULL,
        contenu TEXT NOT NULL,
        version INTEGER NOT NULL,
        debut TEXT NOT NULL
      )`);
    // US-024 (ADR-0016 §4) : une ligne par compétition, avec le même contrôle de version ; rattachée à une manifestation,
    // ou seule (US-045 : `manifestation_id` NULL).
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS competitions (
        id TEXT PRIMARY KEY,
        club_id TEXT NOT NULL,
        manifestation_id TEXT,
        contenu TEXT NOT NULL,
        version INTEGER NOT NULL
      )`);
  }

  /** US-030 : description des fichiers joints du club. */
  async listerFichiers(): Promise<FichierJoint[]> {
    return this.fichiers.lister();
  }

  /** L'élément qui porte un fichier existe-t-il ? Une épreuve existe tant qu'elle est dans l'index et non supprimée. */
  private proprietaireExiste(proprietaire: ProprietaireFichier, id: string): boolean {
    if (proprietaire === 'manifestation') return this.lireManifestation(id) !== null;
    if (proprietaire === 'competition') return this.lireCompetition(id) !== null;
    return !this.estSupprimee(id) && this.lireLigneIndex(id) !== null;
  }

  /** US-030 CA-1, CA-2, CA-3, CA-5 : joint ou remplace un fichier sur un élément existant. */
  async deposerFichier(
    proprietaire: ProprietaireFichier,
    id: string,
    sorte: SorteFichier,
    octets: Uint8Array,
    auteur: string,
  ): Promise<ResultatDepot | { ok: false; raison: 'PROPRIETAIRE_INCONNU' }> {
    if (!this.proprietaireExiste(proprietaire, id)) return { ok: false, raison: 'PROPRIETAIRE_INCONNU' };
    return this.fichiers.deposer(proprietaire, id, sorte, octets, auteur);
  }

  /** US-030 CA-5 : retire un fichier ; faux s'il n'y en avait pas. */
  async retirerFichier(proprietaire: ProprietaireFichier, id: string, sorte: SorteFichier): Promise<boolean> {
    return this.fichiers.retirer(proprietaire, id, sorte);
  }

  /** US-030 : contenu d'un fichier par son nom (lecture publique), ou null s'il n'est plus gardé. */
  async lireFichier(nom: string): Promise<{ type: TypeFichier; octets: ArrayBuffer } | null> {
    return this.fichiers.lire(nom);
  }

  /** US-004 CA-1 / CA-4 : vrai si les connexions à cet e-mail sont refusées. */
  async compteBloque(email: string): Promise<boolean> {
    return saisieBloquee(this.lireEssais(email), Date.now());
  }

  /** US-004 CA-1 : enregistre un échec pour cet e-mail ; vrai s'il est désormais bloqué. */
  async noterEchecCompte(email: string): Promise<boolean> {
    const maintenant = Date.now();
    const essais = noterEchec(this.lireEssais(email), maintenant, REGLE_COMPTE);
    const expireLe = Math.max(essais.bloqueJusqua, maintenant + REGLE_COMPTE.fenetre);
    this.ctx.storage.sql.exec(
      `INSERT INTO essais_comptes (email, echecs, bloque_jusqua, expire_le) VALUES (?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET echecs = excluded.echecs, bloque_jusqua = excluded.bloque_jusqua,
       expire_le = excluded.expire_le`,
      email,
      JSON.stringify(essais.echecs),
      essais.bloqueJusqua,
      expireLe,
    );
    await this.programmerPurge(expireLe);
    return saisieBloquee(essais, maintenant);
  }

  /** L'alarme de purge passe au plus tard à `date` (compteurs d'essais et demandes de réinitialisation). */
  private async programmerPurge(date: number): Promise<void> {
    const alarme = await this.ctx.storage.getAlarm();
    if (alarme === null || alarme > date) await this.ctx.storage.setAlarm(date);
  }

  /**
   * US-019 CA-1 / CA-2 / CA-5 : enregistre une demande de lien pour cet e-mail, avec l'empreinte du nouveau jeton (le
   * lien précédent est annulé). Renvoie le destinataire à qui envoyer l'e-mail, ou null s'il ne faut rien envoyer :
   * e-mail inconnu, compte désactivé, ou plus de 3 demandes dans l'heure.
   */
  async preparerReinitialisation(email: string, empreinte: string): Promise<{ email: string; nom: string } | null> {
    const compte = this.lireCompte('email', email);
    if (!compte?.actif) return null;
    const maintenant = Date.now();
    const [ligne] = this.ctx.storage.sql
      .exec<{ demandes: string }>('SELECT demandes FROM demandes_reinitialisation WHERE compte_id = ?', compte.id)
      .toArray();
    const demandes = ligne ? (JSON.parse(ligne.demandes) as number[]) : [];
    if (!demandeAutorisee(demandes, maintenant)) return null;
    const expireLe = expirationLien(maintenant);
    this.ctx.storage.sql.exec(
      `INSERT INTO demandes_reinitialisation (compte_id, empreinte, expire_le, demandes) VALUES (?, ?, ?, ?)
       ON CONFLICT(compte_id) DO UPDATE SET empreinte = excluded.empreinte, expire_le = excluded.expire_le,
       demandes = excluded.demandes`,
      compte.id,
      empreinte,
      expireLe,
      JSON.stringify(noterDemande(demandes, maintenant)),
    );
    await this.programmerPurge(expireLe);
    return { email: compte.email, nom: compte.nom };
  }

  /**
   * US-019 CA-3 / CA-4 : nouveau mot de passe par un lien encore valable, d'un compte toujours actif. La version du
   * mot de passe augmente (les autres sessions tombent), le mot de passe n'est plus temporaire, le lien ne sert plus,
   * et le blocage pour trop d'essais est levé (US-004). Renvoie le compte à jour, ou null si le lien n'est pas valable.
   */
  async reinitialiserParLien(empreinte: string, sel: string, verificateur: string): Promise<CompteStocke | null> {
    const [demande] = this.ctx.storage.sql
      .exec<{ compteId: string; expireLe: number }>(
        'SELECT compte_id AS compteId, expire_le AS expireLe FROM demandes_reinitialisation WHERE empreinte = ?',
        empreinte,
      )
      .toArray();
    if (!demande || lienExpire(demande.expireLe, Date.now())) return null;
    const compte = this.lireCompte('id', demande.compteId);
    if (!compte?.actif) return null;
    this.ctx.storage.sql.exec(
      'UPDATE comptes SET sel = ?, verificateur = ?, version_mdp = version_mdp + 1, temporaire = 0 WHERE id = ?',
      sel,
      verificateur,
      compte.id,
    );
    // Le lien ne sert qu'une fois ; la ligne reste jusqu'à son expiration pour compter les demandes (CA-5).
    this.ctx.storage.sql.exec('UPDATE demandes_reinitialisation SET empreinte = NULL WHERE compte_id = ?', compte.id);
    await this.effacerEssaisCompte(compte.email);
    return this.lireCompte('id', compte.id);
  }

  /** US-004 CA-3 et US-009 CA-3 : connexion réussie ou mot de passe réinitialisé, le compteur repart de zéro. */
  async effacerEssaisCompte(email: string): Promise<void> {
    this.ctx.storage.sql.exec('DELETE FROM essais_comptes WHERE email = ?', email);
  }

  /**
   * Purge les compteurs d'essais et les demandes de réinitialisation qui ne servent plus (ADR-0014 : données
   * minimales), et reprogramme l'alarme pour la suivante.
   */
  override async alarm(): Promise<void> {
    const maintenant = Date.now();
    this.ctx.storage.sql.exec('DELETE FROM essais_comptes WHERE expire_le <= ?', maintenant);
    this.ctx.storage.sql.exec('DELETE FROM demandes_reinitialisation WHERE expire_le <= ?', maintenant);
    const [suivant] = this.ctx.storage.sql
      .exec<{ prochain: number | null }>(
        `SELECT MIN(expire_le) AS prochain FROM (
           SELECT expire_le FROM essais_comptes UNION ALL SELECT expire_le FROM demandes_reinitialisation)`,
      )
      .toArray();
    if (suivant?.prochain) await this.ctx.storage.setAlarm(suivant.prochain);
  }

  private lireEssais(email: string): Essais {
    const [ligne] = this.ctx.storage.sql
      .exec<{ echecs: string; bloqueJusqua: number }>(
        'SELECT echecs, bloque_jusqua AS bloqueJusqua FROM essais_comptes WHERE email = ?',
        email,
      )
      .toArray();
    return ligne ? { echecs: JSON.parse(ligne.echecs) as number[], bloqueJusqua: ligne.bloqueJusqua } : essaisVides();
  }

  /** Crée le premier administrateur ; refusé dès qu'un administrateur existe (US-002). */
  async creerPremierAdministrateur(compte: NouveauCompte): Promise<ResultatCreation> {
    const role: Role = 'administrateur';
    const [{ nombre }] = this.ctx.storage.sql
      .exec<{ nombre: number }>('SELECT COUNT(*) AS nombre FROM comptes WHERE role = ?', role)
      .toArray() as [{ nombre: number }];
    if (nombre > 0) return { ok: false, erreur: 'ADMINISTRATEUR_EXISTANT' };
    this.inserer(compte, role, false);
    return { ok: true, email: compte.email };
  }

  /** US-007 CA-2 / CA-3 : crée un compte actif au mot de passe temporaire ; l'e-mail (normalisé) est unique. */
  async creerCompte(compte: NouveauCompte & { role: Role }): Promise<ResultatCompte> {
    if (this.lireCompte('email', compte.email)) return { ok: false, erreur: 'EMAIL_DEJA_UTILISE' };
    const id = this.inserer(compte, compte.role, true);
    return { ok: true, compte: this.lireCompte('id', id) as CompteStocke };
  }

  /** US-007 CA-1 : tous les comptes du club, triés par nom. */
  async listerComptes(): Promise<CompteStocke[]> {
    return this.ctx.storage.sql
      .exec<LigneCompte>(`SELECT ${COLONNES} FROM comptes ORDER BY nom COLLATE NOCASE, email`)
      .toArray()
      .map(versCompte);
  }

  /**
   * US-007 CA-4 / CA-5, US-008 CA-1 / CA-2 / CA-4 : modifie le nom, le rôle ou l'état actif ; il doit rester au moins
   * un administrateur actif.
   */
  async modifierCompte(
    id: string,
    modification: { nom?: string; role?: Role; actif?: boolean },
  ): Promise<ResultatCompte> {
    const compte = this.lireCompte('id', id);
    if (!compte) return { ok: false, erreur: 'COMPTE_INCONNU' };
    const comptes = await this.listerComptes();
    if (
      (modification.role && verifierChangementRole(comptes, id, modification.role)) ||
      (modification.actif === false && verifierRetrait(comptes, id))
    ) {
      return { ok: false, erreur: 'DERNIER_ADMINISTRATEUR' };
    }
    this.ctx.storage.sql.exec(
      'UPDATE comptes SET nom = ?, role = ?, actif = ? WHERE id = ?',
      modification.nom ?? compte.nom,
      modification.role ?? compte.role,
      (modification.actif ?? compte.actif) ? 1 : 0,
      id,
    );
    return { ok: true, compte: this.lireCompte('id', id) as CompteStocke };
  }

  /** US-008 CA-3 / CA-4 : efface le compte et ses données ; il doit rester au moins un administrateur actif. */
  async supprimerCompte(
    id: string,
  ): Promise<{ ok: true } | { ok: false; erreur: 'COMPTE_INCONNU' | 'DERNIER_ADMINISTRATEUR' }> {
    const compte = this.lireCompte('id', id);
    if (!compte) return { ok: false, erreur: 'COMPTE_INCONNU' };
    if (verifierRetrait(await this.listerComptes(), id)) return { ok: false, erreur: 'DERNIER_ADMINISTRATEUR' };
    this.ctx.storage.sql.exec('DELETE FROM comptes WHERE id = ?', id);
    await this.effacerEssaisCompte(compte.email);
    this.ctx.storage.sql.exec('DELETE FROM demandes_reinitialisation WHERE compte_id = ?', id);
    return { ok: true };
  }

  /**
   * US-016 CA-3 / CA-4 : le compte modifie son propre nom ou la couleur de son avatar. Renvoie le compte à jour, ou
   * null s'il n'existe plus.
   */
  async modifierProfil(id: string, profil: { nom?: string; avatar?: CouleurAvatar }): Promise<CompteStocke | null> {
    const compte = this.lireCompte('id', id);
    if (!compte) return null;
    this.ctx.storage.sql.exec(
      'UPDATE comptes SET nom = ?, avatar = ? WHERE id = ?',
      profil.nom ?? compte.nom,
      profil.avatar ?? compte.avatar,
      id,
    );
    return this.lireCompte('id', id);
  }

  /** US-022 CA-3 : enregistre ou remplace la ligne d'une épreuve dans l'index du club. */
  async indexerEpreuve(ligne: EpreuveIndexee): Promise<void> {
    // US-039 CA-4 : un lot arrivé pendant la suppression ne recrée pas la ligne.
    if (this.estSupprimee(ligne.id)) return;
    this.ctx.storage.sql.exec(
      `INSERT INTO epreuves (id, club_id, contenu, modifiee_le) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET contenu = excluded.contenu, modifiee_le = excluded.modifiee_le`,
      ligne.id,
      this.env.CLUB_ID,
      JSON.stringify(ligne),
      ligne.modifieeLe,
    );
    // CA-2 : la ligne est mise à jour dans la liste gardée, qui reste triée de la plus récente à la plus ancienne.
    this.index.modifier((lignes) =>
      [ligne, ...lignes.filter(({ id }) => id !== ligne.id)].sort((a, b) => b.modifieeLe - a.modifieeLe),
    );
  }

  private estSupprimee(epreuveId: string): boolean {
    return this.pierresTombales.obtenir().includes(epreuveId);
  }

  /** US-039 CA-4 : vrai si l’épreuve a été supprimée définitivement. */
  async supprimee(epreuveId: string): Promise<boolean> {
    return this.estSupprimee(epreuveId);
  }

  /** US-039 CA-5 : identifiants des épreuves supprimées, que les PC effacent de leurs copies. */
  async listerSupprimees(): Promise<string[]> {
    return [...this.pierresTombales.obtenir()];
  }

  /**
   * US-039 CA-1 : retire l’épreuve de l'index et pose sa pierre tombale. Refusée si le dernier résumé du pilote
   * la dit en cours (CA-3). `aEffacer` dit s'il reste un journal à effacer : la ligne existait, ou une suppression
   * précédente a été interrompue (CA-7) ; une épreuve inconnue ne produit aucune écriture.
   */
  async supprimerEpreuve(
    epreuveId: string,
  ): Promise<{ ok: true; aEffacer: boolean } | { ok: false; statut: 409; erreur: 'EPREUVE_EN_COURS' }> {
    const ligne = this.lireLigneIndex(epreuveId);
    const decision = deciderSuppression(ligne?.statut ?? null);
    if (!decision.ok) return decision;
    if (this.estSupprimee(epreuveId)) return { ok: true, aEffacer: true };
    if (!ligne) return { ok: true, aEffacer: false };
    this.ctx.storage.sql.exec(
      'INSERT OR IGNORE INTO epreuves_supprimees (id, supprimee_le) VALUES (?, ?)',
      epreuveId,
      Date.now(),
    );
    this.ctx.storage.sql.exec('DELETE FROM epreuves WHERE id = ?', epreuveId);
    this.pierresTombales.invalider();
    this.index.modifier((lignes) => lignes.filter(({ id }) => id !== epreuveId));
    this.fichiers.effacerDe('epreuve', [epreuveId]);
    this.retirerCompetitionsSeulesVides(ligne.rattachement ? [ligne.rattachement.competitionId] : []);
    return { ok: true, aEffacer: true };
  }

  /**
   * US-041 : la compétition existe-t-elle, et quelles épreuves de l'index s'y rattachent ? Le statut est celui du dernier
   * résumé du pilote (ADR-0016 §3) ; le serveur ne calcule rien d'escrime.
   */
  async contenuCompetition(competitionId: string): Promise<{ existe: boolean; epreuves: EpreuveASupprimer[] }> {
    const epreuves = this.lignesIndex()
      .filter(({ rattachement }) => rattachement?.competitionId === competitionId)
      .map(({ id, nom, statut }) => ({ id, nom, statut }));
    return { existe: this.lireCompetition(competitionId) !== null, epreuves };
  }

  /**
   * US-041 : supprime un lot d’épreuves (pierre tombale, retrait de l'index) en une seule requête vers ce DO, pour
   * ne pas épuiser les sous-requêtes du Worker (ADR-0020). Renvoie celles dont le DO `Epreuve` reste à vider : la
   * ligne existait, ou une suppression précédente a été interrompue. Une épreuve inconnue ne produit aucune écriture.
   */
  async supprimerEpreuves(epreuveIds: readonly string[]): Promise<string[]> {
    const aEffacer: string[] = [];
    const competitions = new Set<string>();
    for (const epreuveId of epreuveIds) {
      if (this.estSupprimee(epreuveId)) {
        aEffacer.push(epreuveId);
        continue;
      }
      const ligne = this.lireLigneIndex(epreuveId);
      if (!ligne) continue;
      this.ctx.storage.sql.exec(
        'INSERT OR IGNORE INTO epreuves_supprimees (id, supprimee_le) VALUES (?, ?)',
        epreuveId,
        Date.now(),
      );
      this.ctx.storage.sql.exec('DELETE FROM epreuves WHERE id = ?', epreuveId);
      if (ligne.rattachement) competitions.add(ligne.rattachement.competitionId);
      aEffacer.push(epreuveId);
    }
    this.pierresTombales.invalider();
    this.index.modifier((lignes) => lignes.filter(({ id }) => !epreuveIds.includes(id)));
    this.fichiers.effacerDe('epreuve', aEffacer);
    this.retirerCompetitionsSeulesVides([...competitions]);
    return aEffacer;
  }

  /**
   * US-045 CA-6 : une compétition seule n'a de sens que par ses épreuves ; la dernière épreuve supprimée l'emporte. Une
   * compétition d'une manifestation, elle, reste (vide) : elle se supprime à part.
   */
  private retirerCompetitionsSeulesVides(competitionIds: readonly string[]) {
    const restantes = new Set(this.lignesIndex().map(({ rattachement }) => rattachement?.competitionId));
    for (const id of competitionIds) {
      if (restantes.has(id) || this.lireCompetition(id)?.manifestationId !== null) continue;
      this.ctx.storage.sql.exec('DELETE FROM competitions WHERE id = ?', id);
      this.listeCompetitions.invalider();
      this.fichiers.effacerDe('competition', [id]);
    }
  }

  /** Identifiants des compétitions d'une manifestation. */
  private competitionsDe(manifestationId: string): string[] {
    return this.listeCompetitions
      .obtenir()
      .filter((competition) => competition.manifestationId === manifestationId)
      .map(({ id }) => id);
  }

  /** US-029 : ligne de l'index d'une épreuve, ou null. */
  async ligneEpreuve(epreuveId: string): Promise<EpreuveIndexee | null> {
    return this.lireLigneIndex(epreuveId);
  }

  /** CA-3 : une épreuve se lit par son identifiant (une ligne), jamais en parcourant tout l'index. */
  private lireLigneIndex(epreuveId: string): EpreuveIndexee | null {
    const [ligne] = this.ctx.storage.sql
      .exec<{ contenu: string }>('SELECT contenu FROM epreuves WHERE id = ?', epreuveId)
      .toArray();
    return ligne ? (JSON.parse(ligne.contenu) as EpreuveIndexee) : null;
  }

  /** US-029 CA-1 : l'index désigne le nouveau pilote, sans toucher au reste de la ligne. */
  async changerPilote(epreuveId: string, piloteAppareil: string, piloteNom: string): Promise<void> {
    const ligne = this.lireLigneIndex(epreuveId);
    if (!ligne) return;
    this.ctx.storage.sql.exec(
      'UPDATE epreuves SET contenu = ? WHERE id = ?',
      JSON.stringify({ ...ligne, piloteAppareil, piloteNom }),
      epreuveId,
    );
    this.index.modifier((lignes) =>
      lignes.map((courante) => (courante.id === epreuveId ? { ...courante, piloteAppareil, piloteNom } : courante)),
    );
  }

  /** US-022 CA-4 : index des épreuves du club, les plus récemment modifiées d'abord. */
  async listerEpreuves(): Promise<EpreuveIndexee[]> {
    return [...this.lignesIndex()];
  }

  /**
   * US-031 CA-2 à CA-5 : épreuves publiées non archivées, avec les seules manifestations et compétitions qui les
   * contiennent et leurs fichiers joints. Un filtre sur l'index, sans calcul métier : seuls des champs publics sont
   * copiés (aucun nom de compte, appareil, numéro de séquence ni commentaire).
   */
  async lirePublic(): Promise<Extract<ReponsePublique, { ok: true }>> {
    const epreuves = this.epreuvesPubliques();
    const competitionsVues = new Set(epreuves.map(({ competitionId }) => competitionId));
    const competitions = [...this.listeCompetitions.obtenir()]
      .filter(({ id }) => competitionsVues.has(id))
      .map(({ id, manifestationId, nom, arme }) => ({ id, manifestationId, nom, arme }));
    const manifestationsVues = new Set(competitions.map(({ manifestationId }) => manifestationId));
    const manifestations = [...this.listeManifestations.obtenir()]
      .filter(({ id }) => manifestationsVues.has(id))
      .map(({ id, nom, debut, fin, lieu }) => ({ id, nom, debut, fin, lieu }));
    const proprietaires = new Set([
      ...epreuves.map(({ id }) => `epreuve:${id}`),
      ...competitions.map(({ id }) => `competition:${id}`),
      ...manifestations.map(({ id }) => `manifestation:${id}`),
    ]);
    // Le nom du compte qui a joint le fichier reste réservé aux organisateurs.
    const fichiers = this.fichiers
      .lister()
      .filter(({ proprietaire, proprietaireId }) => proprietaires.has(`${proprietaire}:${proprietaireId}`))
      .map(({ proprietaire, proprietaireId, sorte, nom, type, taille, ajouteLe }) => ({
        proprietaire,
        proprietaireId,
        sorte,
        nom,
        type,
        taille,
        ajouteLe,
      }));
    return { ok: true, manifestations, competitions, epreuves, fichiers };
  }

  /** US-031 CA-4 : l'épreuve si elle est publiée et non archivée, sinon null (une inconnue répond de même). */
  async lireEpreuvePublique(epreuveId: string): Promise<EpreuvePublique | null> {
    return this.epreuvesPubliques().find(({ id }) => id === epreuveId) ?? null;
  }

  private epreuvesPubliques(): EpreuvePublique[] {
    return this.lignesIndex()
      .map((ligne) => completerResume(ligne))
      .filter((ligne) => estVisibleDuPublic(ligne) && ligne.rattachement?.competitionId)
      .map(({ id, nom, arme, categorie, sexe, date, horaires, lieu, rattachement }) => ({
        id,
        nom,
        arme,
        categorie,
        sexe,
        date,
        horaires,
        lieu,
        competitionId: rattachement.competitionId,
      }));
  }

  /** Lecture synchrone de l'index : aucune autre requête ne s'intercale avant l'écriture qui suit. */
  private lignesIndex(): readonly EpreuveIndexee[] {
    return this.index.obtenir();
  }

  /** Lecture complète d'un tableau, avec le nombre de lignes que la base a dû parcourir (CA-4). */
  private lireListe<T>(requete: string): Lecture<T> {
    const curseur = this.ctx.storage.sql.exec<{ contenu: string }>(requete);
    const valeurs = curseur.toArray().map(({ contenu }) => JSON.parse(contenu) as T);
    return { valeurs, lignesLues: curseur.rowsRead };
  }

  /** US-023 CA-1 : manifestations du club, par date de début. */
  async listerManifestations(): Promise<Manifestation[]> {
    return [...this.listeManifestations.obtenir()];
  }

  /** US-023 CA-1 : enregistre une nouvelle manifestation, en version 1. */
  async creerManifestation(donnees: DonneesManifestation, auteur: string): Promise<Manifestation> {
    const manifestation = {
      id: crypto.randomUUID(),
      ...donnees,
      version: 1,
      modifieeLe: Date.now(),
      modifieePar: auteur,
    };
    this.ctx.storage.sql.exec(
      'INSERT INTO manifestations (id, club_id, contenu, version, debut) VALUES (?, ?, ?, ?, ?)',
      manifestation.id,
      this.env.CLUB_ID,
      JSON.stringify(manifestation),
      manifestation.version,
      manifestation.debut,
    );
    this.listeManifestations.invalider();
    return manifestation;
  }

  private lireManifestation(id: string): Manifestation | null {
    const ligne = this.ctx.storage.sql
      .exec<{ contenu: string }>('SELECT contenu FROM manifestations WHERE id = ?', id)
      .toArray()[0];
    return ligne ? (JSON.parse(ligne.contenu) as Manifestation) : null;
  }

  /**
   * US-023 CA-2 : remplace les champs si la demande part de la version courante ; sinon, refus avec la version
   * courante (cas limite : pas d'écrasement silencieux d'une modification concurrente).
   */
  async modifierManifestation(
    id: string,
    { version, ...donnees }: DemandeModificationManifestation,
    auteur: string,
  ): Promise<
    | { ok: true; manifestation: Manifestation }
    | { ok: false; erreur: 'MANIFESTATION_INCONNUE' }
    | { ok: false; erreur: 'MODIFIEE_ENTRE_TEMPS'; manifestation: Manifestation }
  > {
    const courante = this.lireManifestation(id);
    if (!courante) return { ok: false, erreur: 'MANIFESTATION_INCONNUE' };
    if (courante.version !== version) return { ok: false, erreur: 'MODIFIEE_ENTRE_TEMPS', manifestation: courante };
    // US-033 : l'archivage ne se perd pas à la modification des champs.
    const archivage = courante.archivee === undefined ? {} : { archivee: courante.archivee };
    const manifestation = {
      id,
      ...donnees,
      ...archivage,
      version: version + 1,
      modifieeLe: Date.now(),
      modifieePar: auteur,
    };
    this.ctx.storage.sql.exec(
      'UPDATE manifestations SET contenu = ?, version = ?, debut = ? WHERE id = ?',
      JSON.stringify(manifestation),
      manifestation.version,
      manifestation.debut,
      id,
    );
    this.listeManifestations.invalider();
    return { ok: true, manifestation };
  }

  /**
   * US-033 CA-4 : archive ou désarchive la manifestation et toutes ses compétitions, en une seule écriture. Les épreuves
   * s'archivent dans leur journal, sur le PC pilote (ADR-0001) : le serveur ne décide rien à leur place.
   */
  async archiverManifestation(
    id: string,
    archivee: boolean,
    auteur: string,
  ): Promise<
    | { ok: true; manifestation: Manifestation; competitions: Competition[] }
    | { ok: false; erreur: 'MANIFESTATION_INCONNUE' }
  > {
    const courante = this.lireManifestation(id);
    if (!courante) return { ok: false, erreur: 'MANIFESTATION_INCONNUE' };
    const maintenant = Date.now();
    const manifestation: Manifestation = {
      ...courante,
      archivee,
      version: courante.version + 1,
      modifieeLe: maintenant,
      modifieePar: auteur,
    };
    const competitions = (await this.listerCompetitions())
      .filter(({ manifestationId }) => manifestationId === id)
      .map((competition) => ({
        ...competition,
        archivee,
        version: competition.version + 1,
        modifieeLe: maintenant,
        modifieePar: auteur,
      }));
    this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec(
        'UPDATE manifestations SET contenu = ?, version = ? WHERE id = ?',
        JSON.stringify(manifestation),
        manifestation.version,
        id,
      );
      for (const competition of competitions) {
        this.ctx.storage.sql.exec(
          'UPDATE competitions SET contenu = ?, version = ? WHERE id = ?',
          JSON.stringify(competition),
          competition.version,
          competition.id,
        );
      }
    });
    this.listeManifestations.invalider();
    this.listeCompetitions.invalider();
    return { ok: true, manifestation, competitions };
  }

  /**
   * US-023 CA-5 : supprime une manifestation vide : une compétition qui s'y rattache l'en empêche (ses épreuves sont
   * dans ses compétitions, US-045).
   */
  async supprimerManifestation(
    id: string,
  ): Promise<{ ok: true } | { ok: false; erreur: 'MANIFESTATION_INCONNUE' | 'MANIFESTATION_NON_VIDE' }> {
    if (!this.lireManifestation(id)) return { ok: false, erreur: 'MANIFESTATION_INCONNUE' };
    if (!estVide(id, await this.listerCompetitions())) return { ok: false, erreur: 'MANIFESTATION_NON_VIDE' };
    this.ctx.storage.sql.exec('DELETE FROM manifestations WHERE id = ?', id);
    this.listeManifestations.invalider();
    this.fichiers.effacerDe('manifestation', [id]);
    return { ok: true };
  }

  /**
   * US-042 : la manifestation existe-t-elle, et quelles épreuves de l'index s'y rattachent, directement ou par une de
   * ses compétitions ? Le statut est celui du dernier résumé du pilote (ADR-0016 §3).
   */
  async contenuManifestation(manifestationId: string): Promise<{ existe: boolean; epreuves: EpreuveASupprimer[] }> {
    const competitions = new Set(this.competitionsDe(manifestationId));
    const epreuves = this.lignesIndex()
      .filter(({ rattachement }) => rattachement && competitions.has(rattachement.competitionId))
      .map(({ id, nom, statut }) => ({ id, nom, statut }));
    return { existe: this.lireManifestation(manifestationId) !== null, epreuves };
  }

  /**
   * US-042 : retire la manifestation et ses compétitions, une fois ses épreuves supprimées. Refusée si une épreuve
   * s'y rattache encore (rattachée entre-temps par un PC hors ligne) : la requête suivante la prendra. Une manifestation
   * inconnue donne un succès sans effet.
   */
  async supprimerManifestationEtCompetitions(
    manifestationId: string,
  ): Promise<{ ok: true } | { ok: false; erreur: 'MANIFESTATION_NON_VIDE' }> {
    if (!this.lireManifestation(manifestationId)) return { ok: true };
    const competitions = new Set(this.competitionsDe(manifestationId));
    if (this.lignesIndex().some(({ rattachement }) => rattachement && competitions.has(rattachement.competitionId))) {
      return { ok: false, erreur: 'MANIFESTATION_NON_VIDE' };
    }
    this.fichiers.effacerDe('competition', [...competitions]);
    this.ctx.storage.sql.exec('DELETE FROM competitions WHERE manifestation_id = ?', manifestationId);
    this.listeCompetitions.invalider();
    this.ctx.storage.sql.exec('DELETE FROM manifestations WHERE id = ?', manifestationId);
    this.listeManifestations.invalider();
    this.fichiers.effacerDe('manifestation', [manifestationId]);
    return { ok: true };
  }

  /** US-024 CA-1 : compétitions du club, regroupées par manifestation. */
  async listerCompetitions(): Promise<Competition[]> {
    return [...this.listeCompetitions.obtenir()];
  }

  /** US-024 CA-1 et CA-2 : enregistre une nouvelle compétition, en version 1, dans une manifestation existante. */
  async creerCompetition(
    donnees: DonneesCompetition,
    auteur: string,
  ): Promise<{ ok: true; competition: Competition } | { ok: false; erreur: 'MANIFESTATION_INCONNUE' }> {
    // US-045 CA-2 : une compétition seule (manifestation null) n'a rien à vérifier.
    if (donnees.manifestationId !== null && !this.lireManifestation(donnees.manifestationId)) {
      return { ok: false, erreur: 'MANIFESTATION_INCONNUE' };
    }
    const competition = {
      id: crypto.randomUUID(),
      ...donnees,
      version: 1,
      modifieeLe: Date.now(),
      modifieePar: auteur,
    };
    this.ctx.storage.sql.exec(
      'INSERT INTO competitions (id, club_id, manifestation_id, contenu, version) VALUES (?, ?, ?, ?, ?)',
      competition.id,
      this.env.CLUB_ID,
      competition.manifestationId,
      JSON.stringify(competition),
      competition.version,
    );
    this.listeCompetitions.invalider();
    return { ok: true, competition };
  }

  private lireCompetition(id: string): Competition | null {
    const ligne = this.ctx.storage.sql
      .exec<{ contenu: string }>('SELECT contenu FROM competitions WHERE id = ?', id)
      .toArray()[0];
    return ligne ? (JSON.parse(ligne.contenu) as Competition) : null;
  }

  /**
   * US-024 CA-3 : remplace nom, arme et commentaire si la demande part de la version courante ; sinon, refus avec la
   * version courante. La manifestation ne change pas, et les épreuves rattachées non plus.
   */
  async modifierCompetition(
    id: string,
    { version, ...donnees }: DemandeModificationCompetition,
    auteur: string,
  ): Promise<
    | { ok: true; competition: Competition }
    | { ok: false; erreur: 'COMPETITION_INCONNUE' }
    | { ok: false; erreur: 'MODIFIEE_ENTRE_TEMPS'; competition: Competition }
  > {
    const courante = this.lireCompetition(id);
    if (!courante) return { ok: false, erreur: 'COMPETITION_INCONNUE' };
    if (courante.version !== version) return { ok: false, erreur: 'MODIFIEE_ENTRE_TEMPS', competition: courante };
    const archivage = courante.archivee === undefined ? {} : { archivee: courante.archivee };
    const competition = {
      id,
      manifestationId: courante.manifestationId,
      ...donnees,
      ...archivage,
      version: version + 1,
      modifieeLe: Date.now(),
      modifieePar: auteur,
    };
    this.ctx.storage.sql.exec(
      'UPDATE competitions SET contenu = ?, version = ? WHERE id = ?',
      JSON.stringify(competition),
      competition.version,
      id,
    );
    this.listeCompetitions.invalider();
    return { ok: true, competition };
  }

  /** US-024 CA-5 : supprime une compétition vide. Une épreuve de l'index qui s'y rattache l'en empêche. */
  async supprimerCompetition(
    id: string,
  ): Promise<{ ok: true } | { ok: false; erreur: 'COMPETITION_INCONNUE' | 'COMPETITION_NON_VIDE' }> {
    if (!this.lireCompetition(id)) return { ok: false, erreur: 'COMPETITION_INCONNUE' };
    const epreuves = this.lignesIndex().map(({ rattachement }) => ({ rattachement: rattachement ?? null }));
    if (!estVideCompetition(id, epreuves)) return { ok: false, erreur: 'COMPETITION_NON_VIDE' };
    this.ctx.storage.sql.exec('DELETE FROM competitions WHERE id = ?', id);
    this.listeCompetitions.invalider();
    this.fichiers.effacerDe('competition', [id]);
    return { ok: true };
  }

  /** US-007 CA-1 : date de la dernière connexion par mot de passe. */
  async noterConnexion(id: string, date: number): Promise<void> {
    this.ctx.storage.sql.exec('UPDATE comptes SET derniere_connexion = ? WHERE id = ?', date, id);
  }

  /** Compte d'un e-mail normalisé, ou null s'il n'existe pas (US-003). */
  async compteParEmail(email: string): Promise<CompteStocke | null> {
    return this.lireCompte('email', email);
  }

  /** Compte d'un identifiant de session, ou null s'il a été supprimé depuis (US-003 CA-7). */
  async compteParId(id: string): Promise<CompteStocke | null> {
    return this.lireCompte('id', id);
  }

  /**
   * Remplace le mot de passe (US-010) : nouveau sel et nouveau vérificateur, version suivante, fin du mot de passe
   * temporaire. Renvoie le compte à jour, ou null s'il n'existe plus.
   */
  async changerMotDePasse(id: string, sel: string, verificateur: string): Promise<CompteStocke | null> {
    this.ctx.storage.sql.exec(
      'UPDATE comptes SET sel = ?, verificateur = ?, version_mdp = version_mdp + 1, temporaire = 0 WHERE id = ?',
      sel,
      verificateur,
      id,
    );
    return this.lireCompte('id', id);
  }

  /**
   * US-009 CA-1 : nouveau mot de passe temporaire. La version suivante invalide toutes les sessions de la personne.
   * Renvoie le compte à jour, ou null s'il n'existe pas.
   */
  async reinitialiserMotDePasse(id: string, sel: string, verificateur: string): Promise<CompteStocke | null> {
    this.ctx.storage.sql.exec(
      'UPDATE comptes SET sel = ?, verificateur = ?, version_mdp = version_mdp + 1, temporaire = 1 WHERE id = ?',
      sel,
      verificateur,
      id,
    );
    const compte = this.lireCompte('id', id);
    // US-009 CA-3 : le blocage du compte après trop d'essais (US-004) est levé.
    if (compte) await this.effacerEssaisCompte(compte.email);
    return compte;
  }

  private inserer(compte: NouveauCompte, role: Role, temporaire: boolean): string {
    const id = crypto.randomUUID();
    this.ctx.storage.sql.exec(
      `INSERT INTO comptes (id, club_id, email, nom, role, sel, verificateur, temporaire, cree_le)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      this.env.CLUB_ID,
      compte.email,
      compte.nom,
      role,
      compte.sel,
      compte.verificateur,
      temporaire ? 1 : 0,
      Date.now(),
    );
    return id;
  }

  private lireCompte(colonne: 'email' | 'id', valeur: string): CompteStocke | null {
    const [ligne] = this.ctx.storage.sql
      .exec<LigneCompte>(`SELECT ${COLONNES} FROM comptes WHERE ${colonne} = ?`, valeur)
      .toArray();
    return ligne ? versCompte(ligne) : null;
  }
}

function versCompte(ligne: LigneCompte): CompteStocke {
  return {
    ...ligne,
    actif: ligne.actif === 1,
    temporaire: ligne.temporaire === 1,
    avatar: estCouleurAvatar(ligne.avatar) ? ligne.avatar : null,
  };
}
