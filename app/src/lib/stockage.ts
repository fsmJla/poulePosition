// Stockage local de l'appareil (ADR-0003) : IndexedDB par Dexie. Tables `session` (la session ouverte, une au
// plus) et `appareilConnu` (comptes déjà connectés en ligne sur cet appareil, pour la reconnexion hors ligne).
import { Dexie, type EntityTable } from 'dexie';
import type { Role } from '@poule-position/domaine';
import type { Session } from '@poule-position/protocole';

/** Compte déjà connecté en ligne sur cet appareil (ADR-0006) : il pourra s'y reconnecter hors ligne (US-005). */
export interface AppareilConnu {
  email: string;
  nom: string;
  role: Role;
  sel: string;
  verificateurLocal: string;
  /** Date de la première connexion en ligne, en millisecondes. */
  connuDepuis: number;
}

export interface Stockage {
  lireSession(): Promise<Session | null>;
  ecrireSession(session: Session): Promise<void>;
  effacerSession(): Promise<void>;
  enregistrerAppareilConnu(appareil: AppareilConnu): Promise<void>;
  lireAppareilConnu(email: string): Promise<AppareilConnu | null>;
}

/** Clé unique de la table `session` : l'appareil n'a qu'une session ouverte à la fois. */
const SESSION_COURANTE = 'courante';

type LigneSession = Session & { cle: typeof SESSION_COURANTE };

class Base extends Dexie {
  session!: EntityTable<LigneSession, 'cle'>;
  appareilConnu!: EntityTable<AppareilConnu, 'email'>;

  constructor(nom: string) {
    super(nom);
    this.version(1).stores({ session: 'cle', appareilConnu: 'email' });
  }
}

export function ouvrirStockage(nom = 'poulePosition'): Stockage {
  const base = new Base(nom);
  return {
    async lireSession() {
      const ligne = await base.session.get(SESSION_COURANTE);
      if (!ligne) return null;
      const { jeton, expireLe, compte } = ligne;
      return { jeton, expireLe, compte };
    },
    async ecrireSession({ jeton, expireLe, compte }) {
      await base.session.put({ cle: SESSION_COURANTE, jeton, expireLe, compte });
    },
    async effacerSession() {
      await base.session.delete(SESSION_COURANTE);
    },
    async enregistrerAppareilConnu(appareil) {
      await base.appareilConnu.put(appareil);
    },
    async lireAppareilConnu(email) {
      return (await base.appareilConnu.get(email)) ?? null;
    },
  };
}
