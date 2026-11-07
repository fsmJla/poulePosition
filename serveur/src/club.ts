// Durable Object « Club » : un objet par club (idFromName(`club:<clubId>`), ADR-0014). Comptes des administrateurs
// et des organisateurs (ADR-0006), essais de connexion erronés par e-mail (US-004) et demandes de réinitialisation
// par e-mail (US-019), index des compétitions du club (US-022, ADR-0016) et manifestations (US-023), en SQLite. Les
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
  estVideEpreuve,
  type DonneesEpreuve,
  type DonneesManifestation,
  type CouleurAvatar,
  type Essais,
  type Role,
} from '@poule-position/domaine';
import type {
  CompetitionIndexee,
  DemandeModificationEpreuve,
  DemandeModificationManifestation,
  Epreuve,
  Manifestation,
} from '@poule-position/protocole';
import type { Env } from './index';
import { ListeEnMemoire, type Lecture } from './liste-en-memoire';
import { deciderSuppression } from './replication';

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
  private readonly index = new ListeEnMemoire<CompetitionIndexee>(
    () => this.lireListe('SELECT contenu FROM competitions ORDER BY modifiee_le DESC'),
    signalerLecture('competitions'),
  );
  private readonly pierresTombales = new ListeEnMemoire<string>(() => {
    const curseur = this.ctx.storage.sql.exec<{ id: string }>('SELECT id FROM competitions_supprimees ORDER BY id');
    return { valeurs: curseur.toArray().map(({ id }) => id), lignesLues: curseur.rowsRead };
  }, signalerLecture('competitions_supprimees'));
  private readonly listeManifestations = new ListeEnMemoire<Manifestation>(
    () => this.lireListe('SELECT contenu FROM manifestations ORDER BY debut, id'),
    signalerLecture('manifestations'),
  );
  private readonly listeEpreuves = new ListeEnMemoire<Epreuve>(
    () => this.lireListe('SELECT contenu FROM epreuves ORDER BY manifestation_id, id'),
    signalerLecture('epreuves'),
  );

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
    // US-022 (ADR-0016) : une ligne par compétition, le résumé fourni par le pilote complété par le Worker.
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS competitions (
        id TEXT PRIMARY KEY,
        club_id TEXT NOT NULL,
        contenu TEXT NOT NULL,
        modifiee_le INTEGER NOT NULL
      )`);
    // US-039 (ADR-0019) : pierre tombale d'une compétition supprimée, pour qu'aucun PC ne la recrée.
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS competitions_supprimees (
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
    // US-024 (ADR-0016 §4) : une ligne par épreuve, rattachée à une manifestation, avec le même contrôle de version.
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS epreuves (
        id TEXT PRIMARY KEY,
        club_id TEXT NOT NULL,
        manifestation_id TEXT NOT NULL,
        contenu TEXT NOT NULL,
        version INTEGER NOT NULL
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

  /** US-022 CA-3 : enregistre ou remplace la ligne d'une compétition dans l'index du club. */
  async indexerCompetition(ligne: CompetitionIndexee): Promise<void> {
    // US-039 CA-4 : un lot arrivé pendant la suppression ne recrée pas la ligne.
    if (this.estSupprimee(ligne.id)) return;
    this.ctx.storage.sql.exec(
      `INSERT INTO competitions (id, club_id, contenu, modifiee_le) VALUES (?, ?, ?, ?)
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

  private estSupprimee(competitionId: string): boolean {
    return this.pierresTombales.obtenir().includes(competitionId);
  }

  /** US-039 CA-4 : vrai si la compétition a été supprimée définitivement. */
  async supprimee(competitionId: string): Promise<boolean> {
    return this.estSupprimee(competitionId);
  }

  /** US-039 CA-5 : identifiants des compétitions supprimées, que les PC effacent de leurs copies. */
  async listerSupprimees(): Promise<string[]> {
    return [...this.pierresTombales.obtenir()];
  }

  /**
   * US-039 CA-1 : retire la compétition de l'index et pose sa pierre tombale. Refusée si le dernier résumé du pilote
   * la dit en cours (CA-3). `aEffacer` dit s'il reste un journal à effacer : la ligne existait, ou une suppression
   * précédente a été interrompue (CA-7) ; une compétition inconnue ne produit aucune écriture.
   */
  async supprimerCompetition(
    competitionId: string,
  ): Promise<{ ok: true; aEffacer: boolean } | { ok: false; statut: 409; erreur: 'COMPETITION_EN_COURS' }> {
    const ligne = this.lireLigneIndex(competitionId);
    const decision = deciderSuppression(ligne?.statut ?? null);
    if (!decision.ok) return decision;
    if (this.estSupprimee(competitionId)) return { ok: true, aEffacer: true };
    if (!ligne) return { ok: true, aEffacer: false };
    this.ctx.storage.sql.exec(
      'INSERT OR IGNORE INTO competitions_supprimees (id, supprimee_le) VALUES (?, ?)',
      competitionId,
      Date.now(),
    );
    this.ctx.storage.sql.exec('DELETE FROM competitions WHERE id = ?', competitionId);
    this.pierresTombales.invalider();
    this.index.modifier((lignes) => lignes.filter(({ id }) => id !== competitionId));
    return { ok: true, aEffacer: true };
  }

  /** US-029 : ligne de l'index d'une compétition, ou null. */
  async ligneCompetition(competitionId: string): Promise<CompetitionIndexee | null> {
    return this.lireLigneIndex(competitionId);
  }

  /** CA-3 : une compétition se lit par son identifiant (une ligne), jamais en parcourant tout l'index. */
  private lireLigneIndex(competitionId: string): CompetitionIndexee | null {
    const [ligne] = this.ctx.storage.sql
      .exec<{ contenu: string }>('SELECT contenu FROM competitions WHERE id = ?', competitionId)
      .toArray();
    return ligne ? (JSON.parse(ligne.contenu) as CompetitionIndexee) : null;
  }

  /** US-029 CA-1 : l'index désigne le nouveau pilote, sans toucher au reste de la ligne. */
  async changerPilote(competitionId: string, piloteAppareil: string, piloteNom: string): Promise<void> {
    const ligne = this.lireLigneIndex(competitionId);
    if (!ligne) return;
    this.ctx.storage.sql.exec(
      'UPDATE competitions SET contenu = ? WHERE id = ?',
      JSON.stringify({ ...ligne, piloteAppareil, piloteNom }),
      competitionId,
    );
    this.index.modifier((lignes) =>
      lignes.map((courante) => (courante.id === competitionId ? { ...courante, piloteAppareil, piloteNom } : courante)),
    );
  }

  /** US-022 CA-4 : index des compétitions du club, les plus récemment modifiées d'abord. */
  async listerCompetitions(): Promise<CompetitionIndexee[]> {
    return [...this.lignesIndex()];
  }

  /** Lecture synchrone de l'index : aucune autre requête ne s'intercale avant l'écriture qui suit. */
  private lignesIndex(): readonly CompetitionIndexee[] {
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
    const manifestation = { id, ...donnees, version: version + 1, modifieeLe: Date.now(), modifieePar: auteur };
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
   * US-023 CA-5 : supprime une manifestation vide. Une compétition de l'index qui s'y rattache l'en empêche (les
   * lignes d'avant US-025, sans rattachement, ne comptent pas).
   */
  async supprimerManifestation(
    id: string,
  ): Promise<{ ok: true } | { ok: false; erreur: 'MANIFESTATION_INCONNUE' | 'MANIFESTATION_NON_VIDE' }> {
    if (!this.lireManifestation(id)) return { ok: false, erreur: 'MANIFESTATION_INCONNUE' };
    const competitions = this.lignesIndex().map(({ rattachement }) => ({ rattachement: rattachement ?? null }));
    if (!estVide(id, competitions, await this.listerEpreuves())) return { ok: false, erreur: 'MANIFESTATION_NON_VIDE' };
    this.ctx.storage.sql.exec('DELETE FROM manifestations WHERE id = ?', id);
    this.listeManifestations.invalider();
    return { ok: true };
  }

  /** US-024 CA-1 : épreuves du club, regroupées par manifestation. */
  async listerEpreuves(): Promise<Epreuve[]> {
    return [...this.listeEpreuves.obtenir()];
  }

  /** US-024 CA-1 et CA-2 : enregistre une nouvelle épreuve, en version 1, dans une manifestation existante. */
  async creerEpreuve(
    donnees: DonneesEpreuve,
    auteur: string,
  ): Promise<{ ok: true; epreuve: Epreuve } | { ok: false; erreur: 'MANIFESTATION_INCONNUE' }> {
    if (!this.lireManifestation(donnees.manifestationId)) return { ok: false, erreur: 'MANIFESTATION_INCONNUE' };
    const epreuve = { id: crypto.randomUUID(), ...donnees, version: 1, modifieeLe: Date.now(), modifieePar: auteur };
    this.ctx.storage.sql.exec(
      'INSERT INTO epreuves (id, club_id, manifestation_id, contenu, version) VALUES (?, ?, ?, ?, ?)',
      epreuve.id,
      this.env.CLUB_ID,
      epreuve.manifestationId,
      JSON.stringify(epreuve),
      epreuve.version,
    );
    this.listeEpreuves.invalider();
    return { ok: true, epreuve };
  }

  private lireEpreuve(id: string): Epreuve | null {
    const ligne = this.ctx.storage.sql
      .exec<{ contenu: string }>('SELECT contenu FROM epreuves WHERE id = ?', id)
      .toArray()[0];
    return ligne ? (JSON.parse(ligne.contenu) as Epreuve) : null;
  }

  /**
   * US-024 CA-3 : remplace nom, arme et commentaire si la demande part de la version courante ; sinon, refus avec la
   * version courante. La manifestation ne change pas, et les compétitions rattachées non plus.
   */
  async modifierEpreuve(
    id: string,
    { version, ...donnees }: DemandeModificationEpreuve,
    auteur: string,
  ): Promise<
    | { ok: true; epreuve: Epreuve }
    | { ok: false; erreur: 'EPREUVE_INCONNUE' }
    | { ok: false; erreur: 'MODIFIEE_ENTRE_TEMPS'; epreuve: Epreuve }
  > {
    const courante = this.lireEpreuve(id);
    if (!courante) return { ok: false, erreur: 'EPREUVE_INCONNUE' };
    if (courante.version !== version) return { ok: false, erreur: 'MODIFIEE_ENTRE_TEMPS', epreuve: courante };
    const epreuve = {
      id,
      manifestationId: courante.manifestationId,
      ...donnees,
      version: version + 1,
      modifieeLe: Date.now(),
      modifieePar: auteur,
    };
    this.ctx.storage.sql.exec(
      'UPDATE epreuves SET contenu = ?, version = ? WHERE id = ?',
      JSON.stringify(epreuve),
      epreuve.version,
      id,
    );
    this.listeEpreuves.invalider();
    return { ok: true, epreuve };
  }

  /** US-024 CA-5 : supprime une épreuve vide. Une compétition de l'index qui s'y rattache l'en empêche. */
  async supprimerEpreuve(
    id: string,
  ): Promise<{ ok: true } | { ok: false; erreur: 'EPREUVE_INCONNUE' | 'EPREUVE_NON_VIDE' }> {
    if (!this.lireEpreuve(id)) return { ok: false, erreur: 'EPREUVE_INCONNUE' };
    const competitions = this.lignesIndex().map(({ rattachement }) => ({ rattachement: rattachement ?? null }));
    if (!estVideEpreuve(id, competitions)) return { ok: false, erreur: 'EPREUVE_NON_VIDE' };
    this.ctx.storage.sql.exec('DELETE FROM epreuves WHERE id = ?', id);
    this.listeEpreuves.invalider();
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
