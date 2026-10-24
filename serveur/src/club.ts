// Durable Object « Club » : un objet par club (idFromName(`club:<clubId>`), ADR-0014). Comptes des administrateurs
// et des organisateurs (ADR-0006), en SQLite. Les écritures d'un même objet sont sérialisées : deux créations
// simultanées du premier administrateur ne peuvent pas aboutir toutes les deux.
import { DurableObject } from 'cloudflare:workers';
import type { Role } from '@poule-position/domaine';
import type { Env } from './index';

export interface NouveauCompte {
  email: string;
  nom: string;
  sel: string;
  /** HMAC poivré de la clé dérivée : jamais le mot de passe ni la clé elle-même. */
  verificateur: string;
}

export type ResultatCreation = { ok: true; email: string } | { ok: false; erreur: 'ADMINISTRATEUR_EXISTANT' };

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
        cree_le INTEGER NOT NULL
      )`);
  }

  /** Crée le premier administrateur ; refusé dès qu'un administrateur existe (US-002). */
  async creerPremierAdministrateur(compte: NouveauCompte): Promise<ResultatCreation> {
    const role: Role = 'administrateur';
    const [{ nombre }] = this.ctx.storage.sql
      .exec<{ nombre: number }>('SELECT COUNT(*) AS nombre FROM comptes WHERE role = ?', role)
      .toArray() as [{ nombre: number }];
    if (nombre > 0) return { ok: false, erreur: 'ADMINISTRATEUR_EXISTANT' };
    this.ctx.storage.sql.exec(
      `INSERT INTO comptes (id, club_id, email, nom, role, sel, verificateur, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      crypto.randomUUID(),
      this.env.CLUB_ID,
      compte.email,
      compte.nom,
      role,
      compte.sel,
      compte.verificateur,
      Date.now(),
    );
    return { ok: true, email: compte.email };
  }
}
