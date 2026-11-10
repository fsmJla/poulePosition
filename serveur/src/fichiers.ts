// Stockage des fichiers joints dans le DO `Club` (US-030, ADR-0011 et ADR-0022) : une affiche et une feuille de route au
// plus par manifestation, compétition ou épreuve, en SQLite. Une ligne SQLite est limitée à 2 Mo : le contenu est découpé
// en morceaux de 1 Mo. Le nom d'un fichier est l'empreinte SHA-256 de son contenu : il change quand le fichier est
// remplacé (CA-5), et le contenu se sert avec un cache immuable. Le serveur ne décide d'aucune règle d'escrime : il
// applique les contrôles du domaine (taille, type réel) et garde les octets.
import {
  controlerFichier,
  nomDeFichier,
  TAILLE_MORCEAU,
  typeDeNom,
  type ProprietaireFichier,
  type RaisonRefus,
  type SorteFichier,
  type TypeFichier,
} from '@poule-position/domaine';
import type { FichierJoint } from '@poule-position/protocole';
import { ListeEnMemoire } from './liste-en-memoire';

type LigneFichier = {
  proprietaire: ProprietaireFichier;
  proprietaireId: string;
  sorte: SorteFichier;
  nom: string;
  type: TypeFichier;
  taille: number;
  ajouteLe: number;
  ajoutePar: string;
};

const COLONNES = `proprietaire, proprietaire_id AS proprietaireId, sorte, nom, type, taille, ajoute_le AS ajouteLe,
  ajoute_par AS ajoutePar`;

const hexadecimal = (octets: ArrayBuffer) =>
  [...new Uint8Array(octets)].map((octet) => octet.toString(16).padStart(2, '0')).join('');

export type ResultatDepot = { ok: true; fichier: FichierJoint } | { ok: false; raison: RaisonRefus };

export class StockageFichiers {
  /** US-038 : la description des fichiers est lue une fois, puis gardée en mémoire jusqu'à la prochaine écriture. */
  private readonly liste: ListeEnMemoire<FichierJoint>;

  constructor(
    private readonly sql: SqlStorage,
    signalerLecture: (lignesLues: number) => void,
  ) {
    sql.exec(`
      CREATE TABLE IF NOT EXISTS fichiers (
        proprietaire TEXT NOT NULL,
        proprietaire_id TEXT NOT NULL,
        sorte TEXT NOT NULL,
        nom TEXT NOT NULL,
        type TEXT NOT NULL,
        taille INTEGER NOT NULL,
        ajoute_le INTEGER NOT NULL,
        ajoute_par TEXT NOT NULL,
        PRIMARY KEY (proprietaire, proprietaire_id, sorte)
      )`);
    sql.exec(`
      CREATE TABLE IF NOT EXISTS fichiers_morceaux (
        nom TEXT NOT NULL,
        rang INTEGER NOT NULL,
        donnees BLOB NOT NULL,
        PRIMARY KEY (nom, rang)
      )`);
    this.liste = new ListeEnMemoire<FichierJoint>(() => {
      const curseur = sql.exec<LigneFichier>(
        `SELECT ${COLONNES} FROM fichiers ORDER BY proprietaire, proprietaire_id, sorte`,
      );
      return { valeurs: curseur.toArray(), lignesLues: curseur.rowsRead };
    }, signalerLecture);
  }

  /** Description de tous les fichiers du club (jamais leur contenu). */
  lister(): FichierJoint[] {
    return [...this.liste.obtenir()];
  }

  private ligne(proprietaire: ProprietaireFichier, id: string, sorte: SorteFichier): FichierJoint | null {
    return (
      this.sql
        .exec<LigneFichier>(
          `SELECT ${COLONNES} FROM fichiers WHERE proprietaire = ? AND proprietaire_id = ? AND sorte = ?`,
          proprietaire,
          id,
          sorte,
        )
        .toArray()[0] ?? null
    );
  }

  /**
   * US-030 CA-1, CA-2, CA-3 et CA-5 : contrôle le fichier, le range en morceaux et remplace celui de même sorte. Le
   * contenu est haché avant tout accès au stockage, pour que rien ne s'intercale entre la lecture et les écritures.
   * Renvoyer le même contenu ne produit aucune écriture.
   */
  async deposer(
    proprietaire: ProprietaireFichier,
    id: string,
    sorte: SorteFichier,
    octets: Uint8Array,
    auteur: string,
  ): Promise<ResultatDepot> {
    const controle = controlerFichier(sorte, octets);
    if (!controle.ok) return controle;
    const empreinte = hexadecimal(await crypto.subtle.digest('SHA-256', octets));
    const nom = nomDeFichier(empreinte, controle.type);
    const ancien = this.ligne(proprietaire, id, sorte);
    if (ancien?.nom === nom) return { ok: true, fichier: ancien };

    const dejaGarde = this.sql.exec('SELECT 1 FROM fichiers_morceaux WHERE nom = ? LIMIT 1', nom).toArray().length > 0;
    if (!dejaGarde) {
      for (let rang = 0, debut = 0; debut < octets.length; rang += 1, debut += TAILLE_MORCEAU) {
        const morceau = octets.slice(debut, debut + TAILLE_MORCEAU);
        this.sql.exec('INSERT INTO fichiers_morceaux (nom, rang, donnees) VALUES (?, ?, ?)', nom, rang, morceau.buffer);
      }
    }
    const fichier: FichierJoint = {
      proprietaire,
      proprietaireId: id,
      sorte,
      nom,
      type: controle.type,
      taille: octets.length,
      ajouteLe: Date.now(),
      ajoutePar: auteur,
    };
    this.sql.exec(
      `INSERT OR REPLACE INTO fichiers (proprietaire, proprietaire_id, sorte, nom, type, taille, ajoute_le, ajoute_par)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      proprietaire,
      id,
      sorte,
      nom,
      fichier.type,
      fichier.taille,
      fichier.ajouteLe,
      auteur,
    );
    if (ancien) this.libererContenu(ancien.nom);
    this.liste.invalider();
    return { ok: true, fichier };
  }

  /** US-030 CA-5 : retire le fichier ; faux s'il n'y en avait pas. L'ancien contenu n'est plus servi. */
  retirer(proprietaire: ProprietaireFichier, id: string, sorte: SorteFichier): boolean {
    const ancien = this.ligne(proprietaire, id, sorte);
    if (!ancien) return false;
    this.sql.exec(
      'DELETE FROM fichiers WHERE proprietaire = ? AND proprietaire_id = ? AND sorte = ?',
      proprietaire,
      id,
      sorte,
    );
    this.libererContenu(ancien.nom);
    this.liste.invalider();
    return true;
  }

  /** Efface les fichiers d'éléments supprimés (manifestation, compétition ou épreuve) : rien ne reste orphelin. */
  effacerDe(proprietaire: ProprietaireFichier, ids: readonly string[]): void {
    let efface = false;
    for (const id of ids) {
      const lignes = this.sql
        .exec<{ nom: string }>(
          'SELECT nom FROM fichiers WHERE proprietaire = ? AND proprietaire_id = ?',
          proprietaire,
          id,
        )
        .toArray();
      if (lignes.length === 0) continue;
      this.sql.exec('DELETE FROM fichiers WHERE proprietaire = ? AND proprietaire_id = ?', proprietaire, id);
      for (const { nom } of lignes) this.libererContenu(nom);
      efface = true;
    }
    if (efface) this.liste.invalider();
  }

  /** Efface les morceaux d'un contenu que plus aucun élément n'utilise (deux éléments peuvent partager un même contenu). */
  private libererContenu(nom: string): void {
    this.sql.exec(
      'DELETE FROM fichiers_morceaux WHERE nom = ? AND NOT EXISTS (SELECT 1 FROM fichiers WHERE nom = ?)',
      nom,
      nom,
    );
  }

  /** Contenu d'un fichier par son nom, ou null s'il n'est plus gardé (remplacé, retiré ou supprimé avec son élément). */
  lire(nom: string): { type: TypeFichier; octets: ArrayBuffer } | null {
    const type = typeDeNom(nom);
    if (!type) return null;
    const morceaux = this.sql
      .exec<{ donnees: ArrayBuffer }>('SELECT donnees FROM fichiers_morceaux WHERE nom = ? ORDER BY rang', nom)
      .toArray();
    if (morceaux.length === 0) return null;
    const octets = new Uint8Array(morceaux.reduce((total, { donnees }) => total + donnees.byteLength, 0));
    let position = 0;
    for (const { donnees } of morceaux) {
      octets.set(new Uint8Array(donnees), position);
      position += donnees.byteLength;
    }
    return { type, octets: octets.buffer };
  }
}
