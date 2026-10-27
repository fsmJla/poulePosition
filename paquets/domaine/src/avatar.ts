// Avatar d'un compte (US-016) : pastille aux initiales du nom, sur une couleur choisie dans une palette fermée. Les
// teintes sont dans la charte de l'application (app.css, variables --avatar-<couleur>) ; le domaine n'en connaît
// que les noms.
import { normaliserEmail } from './comptes';

export const COULEURS_AVATAR = ['sarcelle', 'ardoise', 'foret', 'ocre', 'brique', 'prune', 'ciel', 'terre'] as const;
export type CouleurAvatar = (typeof COULEURS_AVATAR)[number];

export function estCouleurAvatar(valeur: unknown): valeur is CouleurAvatar {
  return (COULEURS_AVATAR as readonly unknown[]).includes(valeur);
}

/**
 * US-016 CA-2 : initiales d'un nom, en majuscules : la première lettre du premier mot et celle du dernier mot, une
 * seule si le nom n'a qu'un mot. Les premiers caractères sont gardés tels quels (chiffre, lettre accentuée).
 */
export function initiales(nom: string): string {
  const mots = nom.trim().split(/\s+/).filter(Boolean);
  const premiere = (mot: string | undefined) => (mot ? ([...mot][0] ?? '') : '');
  const lettres = mots.length > 1 ? premiere(mots[0]) + premiere(mots.at(-1)) : premiere(mots[0]);
  return lettres.toLocaleUpperCase('fr');
}

/**
 * Couleur d'un compte qui n'en a jamais choisi : déduite de son e-mail (empreinte FNV-1a), toujours la même pour un
 * même compte, et répartie sur toute la palette.
 */
export function couleurParDefaut(email: string): CouleurAvatar {
  let empreinte = 0x811c9dc5;
  for (const caractere of normaliserEmail(email)) {
    empreinte ^= caractere.codePointAt(0) ?? 0;
    empreinte = Math.imul(empreinte, 0x01000193) >>> 0;
  }
  return COULEURS_AVATAR[empreinte % COULEURS_AVATAR.length] as CouleurAvatar;
}
