// Appareils connectés (US-105, planche 21) : ce que la table montre des smartphones entrés par QR code. Le serveur dit
// lesquels il connaît (identifiant, rôle, connecté, vu à, exclu) ; le journal du pilote dit qui ils sont (la signature
// de leurs saisies), où ils saisissent et combien de saisies ils ont faites.
import type { RoleQr } from './acces-qr';
import type { Evenement } from './journal';

/** Un smartphone tel que le serveur le connaît. */
export interface AppareilServeur {
  id: string;
  role: RoleQr;
  connecte: boolean;
  vuLe: number | null;
  exclu: boolean;
}

/** Une ligne du tableau « Appareils connectés ». */
export interface LigneAppareil extends AppareilServeur {
  /** « arbitre Dupont », « tireuse DUBOIS Chloé », ou null si l'appareil n'a encore rien saisi. */
  qui: string | null;
  /** Poule de sa dernière saisie, ou null. */
  poule: number | null;
  saisies: number;
  refusees: number;
}

/** « arbitre Dupont (t4) » → « arbitre Dupont », si la signature est celle de cet appareil. */
function quiDe(par: string, appareilId: string): string | null {
  const fin = ` (${appareilId})`;
  return par.endsWith(fin) ? par.slice(0, -fin.length) : null;
}

/** US-105 CA-1 : les lignes du tableau, dans l'ordre du serveur, complétées par le journal. */
export function lignesAppareils(liste: AppareilServeur[], evenements: Evenement[]): LigneAppareil[] {
  return liste.map((appareil) => {
    const ligne: LigneAppareil = { ...appareil, qui: null, poule: null, saisies: 0, refusees: 0 };
    for (const evenement of evenements) {
      if (evenement.type !== 'ScorePouleSaisi' && evenement.type !== 'SaisieRefusee') continue;
      const origine = evenement.donnees.saisie;
      const qui = origine ? quiDe(origine.par, appareil.id) : null;
      if (!qui) continue;
      ligne.qui = qui;
      ligne.poule = evenement.donnees.poule;
      if (evenement.type === 'ScorePouleSaisi') ligne.saisies += 1;
      else ligne.refusees += 1;
    }
    return ligne;
  });
}
