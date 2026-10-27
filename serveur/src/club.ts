// Durable Object « Club » : un objet par club (idFromName(`club:<clubId>`), ADR-0014). Comptes des administrateurs
// et des organisateurs (ADR-0006), essais de connexion erronés par e-mail (US-004) et demandes de réinitialisation
// par e-mail (US-019), en SQLite. Les écritures d'un même objet sont sérialisées : deux créations simultanées du
// premier administrateur, ou d'un même e-mail, ne peuvent pas aboutir toutes les deux.
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
  type CouleurAvatar,
  type Essais,
  type Role,
} from '@poule-position/domaine';
import type { Env } from './index';

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

export class Club extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
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
