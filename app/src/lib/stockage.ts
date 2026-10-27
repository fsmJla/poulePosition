// Stockage local de l'appareil (ADR-0003) : IndexedDB par Dexie. Tables `session` (la session ouverte, une au
// plus), `appareilConnu` (comptes déjà connectés en ligne sur cet appareil, pour la reconnexion hors ligne) et
// `essaisLocaux` (frein local de la reconnexion hors ligne, US-005).
import { Dexie, type EntityTable } from 'dexie';
import { couleurParDefaut, essaisVides, type CouleurAvatar, type Essais, type Role } from '@poule-position/domaine';
import type { CompteConnecte, Session } from '@poule-position/protocole';

/** Compte déjà connecté en ligne sur cet appareil (ADR-0006) : il pourra s'y reconnecter hors ligne (US-005). */
export interface AppareilConnu {
  email: string;
  nom: string;
  role: Role;
  sel: string;
  verificateurLocal: string;
  /** Mot de passe temporaire (US-009) : une session locale ne sert alors qu'à le changer, une fois en ligne. */
  temporaire: boolean;
  /** Couleur de l'avatar (US-016), pour l'afficher hors ligne. */
  avatar: CouleurAvatar;
  /** Date de la première connexion en ligne, en millisecondes. */
  connuDepuis: number;
}

/** Session ouverte hors ligne avec le vérificateur local (US-005) : sans jeton, revalidée au retour en ligne. */
export interface SessionLocale {
  locale: true;
  /** Date d'expiration, en millisecondes. */
  expireLe: number;
  compte: CompteConnecte;
}

/** Session ouverte sur l'appareil : en ligne (jeton du serveur, US-003) ou locale (US-005). */
export type SessionAppareil = Session | SessionLocale;

export function estLocale(session: SessionAppareil): session is SessionLocale {
  return 'locale' in session;
}

export interface Stockage {
  lireSession(): Promise<SessionAppareil | null>;
  ecrireSession(session: SessionAppareil): Promise<void>;
  effacerSession(): Promise<void>;
  enregistrerAppareilConnu(appareil: AppareilConnu): Promise<void>;
  lireAppareilConnu(email: string): Promise<AppareilConnu | null>;
  /** Efface le vérificateur local d'un compte (compte modifié ou retiré, US-010 CA-5, US-008 CA-5, US-005 CA-6). */
  oublierAppareilConnu(email: string): Promise<void>;
  lireEssaisLocaux(): Promise<Essais>;
  ecrireEssaisLocaux(essais: Essais): Promise<void>;
}

/** Clé unique des tables `session` et `essaisLocaux` : une seule ligne par appareil. */
const LIGNE_UNIQUE = 'courante';

type LigneSession = {
  cle: typeof LIGNE_UNIQUE;
  jeton?: string;
  locale?: true;
  expireLe: number;
  compte: CompteConnecte;
};
type LigneEssais = Essais & { cle: typeof LIGNE_UNIQUE };

class Base extends Dexie {
  session!: EntityTable<LigneSession, 'cle'>;
  appareilConnu!: EntityTable<AppareilConnu, 'email'>;
  essaisLocaux!: EntityTable<LigneEssais, 'cle'>;

  constructor(nom: string) {
    super(nom);
    this.version(1).stores({ session: 'cle', appareilConnu: 'email' });
    this.version(2).stores({ session: 'cle', appareilConnu: 'email', essaisLocaux: 'cle' });
  }
}

export function ouvrirStockage(nom = 'poulePosition'): Stockage {
  const base = new Base(nom);
  return {
    async lireSession() {
      const ligne = await base.session.get(LIGNE_UNIQUE);
      if (!ligne) return null;
      const { jeton, locale, expireLe } = ligne;
      // Une session gardée avant US-016 n'a pas de couleur d'avatar : celle par défaut du compte.
      const compte = { ...ligne.compte, avatar: ligne.compte.avatar ?? couleurParDefaut(ligne.compte.email) };
      if (locale) return { locale, expireLe, compte };
      return jeton ? { jeton, expireLe, compte } : null;
    },
    async ecrireSession(session) {
      const { expireLe, compte } = session;
      const ligne = estLocale(session) ? { locale: true as const } : { jeton: session.jeton };
      await base.session.put({ cle: LIGNE_UNIQUE, ...ligne, expireLe, compte });
    },
    async effacerSession() {
      await base.session.delete(LIGNE_UNIQUE);
    },
    async enregistrerAppareilConnu(appareil) {
      await base.appareilConnu.put(appareil);
    },
    async lireAppareilConnu(email) {
      const appareil = await base.appareilConnu.get(email);
      // Une entrée d'avant US-005 n'a pas de champ `temporaire` (mot de passe définitif) ; une entrée d'avant US-016 n'a pas
      // de couleur d'avatar (couleur par défaut du compte).
      if (!appareil) return null;
      const { temporaire = false, avatar = couleurParDefaut(appareil.email) }: Partial<AppareilConnu> = appareil;
      return { ...appareil, temporaire, avatar };
    },
    async oublierAppareilConnu(email) {
      await base.appareilConnu.delete(email);
    },
    async lireEssaisLocaux() {
      const ligne = await base.essaisLocaux.get(LIGNE_UNIQUE);
      return ligne ? { echecs: ligne.echecs, bloqueJusqua: ligne.bloqueJusqua } : essaisVides();
    },
    async ecrireEssaisLocaux({ echecs, bloqueJusqua }) {
      await base.essaisLocaux.put({ cle: LIGNE_UNIQUE, echecs, bloqueJusqua });
    },
  };
}
