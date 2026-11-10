// Fichiers joints (US-030, ADR-0011 et ADR-0022) : une affiche (image) et une feuille de route (PDF) par manifestation,
// compétition ou épreuve. Règles pures : le type réel se lit dans les premiers octets (jamais dans l'extension), la
// taille et les dimensions se contrôlent, et une épreuve sans fichier hérite de celui de sa compétition, puis de sa
// manifestation. Le navigateur et le serveur appliquent les mêmes contrôles.

/** Taille maximale d'un fichier joint : 5 Mo (ADR-0011). */
export const TAILLE_MAX_FICHIER = 5 * 1024 * 1024;

/** Taille d'un morceau stocké : une ligne SQLite d'un Durable Object est limitée à 2 Mo (ADR-0011). */
export const TAILLE_MORCEAU = 1024 * 1024;

/** Une image de plus de 20 millions de pixels est refusée avant d'être décodée (cas limite d'US-030). */
export const PIXELS_MAX = 20_000_000;

/** Côté le plus long d'une affiche après réduction dans le navigateur. */
export const COTE_MAX_AFFICHE = 1600;

export const TYPES_FICHIER = ['pdf', 'png', 'jpeg', 'webp'] as const;
export type TypeFichier = (typeof TYPES_FICHIER)[number];

export const SORTES_FICHIER = ['affiche', 'feuilleDeRoute'] as const;
/** Une affiche est une image, une feuille de route est un PDF. */
export type SorteFichier = (typeof SORTES_FICHIER)[number];

export const PROPRIETAIRES_FICHIER = ['manifestation', 'competition', 'epreuve'] as const;
export type ProprietaireFichier = (typeof PROPRIETAIRES_FICHIER)[number];

export const TYPE_MIME: Record<TypeFichier, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

const EXTENSION: Record<TypeFichier, string> = { pdf: 'pdf', png: 'png', jpeg: 'jpg', webp: 'webp' };

/** Types admis pour chaque sorte. */
export const TYPES_PAR_SORTE: Record<SorteFichier, readonly TypeFichier[]> = {
  affiche: ['png', 'jpeg', 'webp'],
  feuilleDeRoute: ['pdf'],
};

/** Type d'un fichier d'après l'extension de son nom d'empreinte, ou null si le nom n'en est pas un. */
export function typeDeNom(nom: string): TypeFichier | null {
  if (!MOTIF_NOM_FICHIER.test(nom)) return null;
  const extension = nom.slice(nom.lastIndexOf('.') + 1);
  return TYPES_FICHIER.find((type) => EXTENSION[type] === extension) ?? null;
}

/** Nom d'un fichier stocké : l'empreinte SHA-256 (64 caractères hexadécimaux) de son contenu, et son extension. */
export const MOTIF_NOM_FICHIER = /^[0-9a-f]{64}\.(pdf|png|jpg|webp)$/;

export function nomDeFichier(empreinte: string, type: TypeFichier): string {
  return `${empreinte}.${EXTENSION[type]}`;
}

export type RaisonRefus =
  'VIDE' | 'TROP_GROS' | 'TYPE_REFUSE' | 'TYPE_INCOMPATIBLE' | 'IMAGE_ANIMEE' | 'IMAGE_TROP_GRANDE';

export type ResultatControle = { ok: true; type: TypeFichier } | { ok: false; raison: RaisonRefus };

const commence = (octets: Uint8Array, signature: readonly number[], decalage = 0) =>
  octets.length >= decalage + signature.length && signature.every((valeur, i) => octets[decalage + i] === valeur);

const texteDe = (octets: Uint8Array, debut: number, longueur: number) =>
  String.fromCharCode(...octets.subarray(debut, debut + longueur));

const entierGrand = (o: Uint8Array, i: number) =>
  ((o[i]! << 24) | (o[i + 1]! << 16) | (o[i + 2]! << 8) | o[i + 3]!) >>> 0;
const entierPetit24 = (o: Uint8Array, i: number) => o[i]! | (o[i + 1]! << 8) | (o[i + 2]! << 16);

const SIGNATURE_PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];
const SIGNATURE_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const SIGNATURE_JPEG = [0xff, 0xd8, 0xff];

/** Type réel d'un fichier d'après ses premiers octets, ou null s'il n'est ni PDF, ni PNG, ni JPEG, ni WebP. */
export function typeReel(octets: Uint8Array): TypeFichier | null {
  if (commence(octets, SIGNATURE_PDF)) return 'pdf';
  if (commence(octets, SIGNATURE_PNG)) return 'png';
  if (commence(octets, SIGNATURE_JPEG)) return 'jpeg';
  if (octets.length >= 12 && texteDe(octets, 0, 4) === 'RIFF' && texteDe(octets, 8, 4) === 'WEBP') return 'webp';
  return null;
}

/** Vrai pour un PNG animé (bloc `acTL` avant les données) ou un WebP animé (drapeau d'animation de `VP8X`). */
export function estAnimee(octets: Uint8Array): boolean {
  const type = typeReel(octets);
  if (type === 'webp') return texteDe(octets, 12, 4) === 'VP8X' && octets.length > 20 && (octets[20]! & 0x02) !== 0;
  if (type !== 'png') return false;
  let position = 8;
  while (position + 8 <= octets.length) {
    const nom = texteDe(octets, position + 4, 4);
    if (nom === 'acTL') return true;
    if (nom === 'IDAT') return false;
    position += 12 + entierGrand(octets, position);
  }
  return false;
}

/** Largeur et hauteur d'un PNG, d'un JPEG ou d'un WebP lues dans ses en-têtes, sans le décoder ; null si illisible. */
export function dimensionsImage(octets: Uint8Array): { largeur: number; hauteur: number } | null {
  const type = typeReel(octets);
  if (type === 'png') {
    return octets.length >= 24 ? { largeur: entierGrand(octets, 16), hauteur: entierGrand(octets, 20) } : null;
  }
  if (type === 'jpeg') return dimensionsJpeg(octets);
  if (type === 'webp') return dimensionsWebp(octets);
  return null;
}

function dimensionsJpeg(octets: Uint8Array): { largeur: number; hauteur: number } | null {
  let position = 2;
  while (position + 4 <= octets.length) {
    if (octets[position] !== 0xff) return null;
    const marqueur = octets[position + 1]!;
    if (marqueur === 0xff) {
      position += 1;
      continue;
    }
    // Les segments « début de trame » (SOF0 à SOF15, hors DHT, JPG et DAC) portent la taille.
    if (marqueur >= 0xc0 && marqueur <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marqueur)) {
      if (position + 9 > octets.length) return null;
      return {
        hauteur: (octets[position + 5]! << 8) | octets[position + 6]!,
        largeur: (octets[position + 7]! << 8) | octets[position + 8]!,
      };
    }
    position += 2 + ((octets[position + 2]! << 8) | octets[position + 3]!);
  }
  return null;
}

function dimensionsWebp(octets: Uint8Array): { largeur: number; hauteur: number } | null {
  const variante = texteDe(octets, 12, 4);
  if (variante === 'VP8X' && octets.length >= 30) {
    return { largeur: entierPetit24(octets, 24) + 1, hauteur: entierPetit24(octets, 27) + 1 };
  }
  if (variante === 'VP8L' && octets.length >= 25) {
    const bits = (octets[21]! | (octets[22]! << 8) | (octets[23]! << 16) | (octets[24]! << 24)) >>> 0;
    return { largeur: (bits & 0x3fff) + 1, hauteur: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (variante === 'VP8 ' && octets.length >= 30) {
    return {
      largeur: (octets[26]! | (octets[27]! << 8)) & 0x3fff,
      hauteur: (octets[28]! | (octets[29]! << 8)) & 0x3fff,
    };
  }
  return null;
}

/** Contrôles d'un fichier avant de l'envoyer et à sa réception (US-030 CA-3) : taille, type réel, sorte, image. */
export function controlerFichier(sorte: SorteFichier, octets: Uint8Array): ResultatControle {
  if (octets.length === 0) return { ok: false, raison: 'VIDE' };
  if (octets.length > TAILLE_MAX_FICHIER) return { ok: false, raison: 'TROP_GROS' };
  const type = typeReel(octets);
  if (!type) return { ok: false, raison: 'TYPE_REFUSE' };
  if (!TYPES_PAR_SORTE[sorte].includes(type)) return { ok: false, raison: 'TYPE_INCOMPATIBLE' };
  if (sorte === 'affiche') {
    if (estAnimee(octets)) return { ok: false, raison: 'IMAGE_ANIMEE' };
    const taille = dimensionsImage(octets);
    if (taille && taille.largeur * taille.hauteur > PIXELS_MAX) return { ok: false, raison: 'IMAGE_TROP_GRANDE' };
  }
  return { ok: true, type };
}

/**
 * Héritage (US-030 CA-4) : le premier fichier trouvé en partant de l'élément lui-même, puis de sa compétition, puis de
 * sa manifestation. `chaine` est dans cet ordre ; null si aucun n'en a.
 */
export function fichierHerite<T>(chaine: readonly (T | null | undefined)[]): T | null {
  return chaine.find((fichier): fichier is T => fichier !== null && fichier !== undefined) ?? null;
}
