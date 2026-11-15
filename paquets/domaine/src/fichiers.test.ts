// Fichiers joints (US-030) : type réel par les octets, contrôles, dimensions d'image et héritage.
import { describe, expect, it } from 'vitest';
import {
  controlerFichier,
  dimensionsImage,
  estAnimee,
  fichierHerite,
  MOTIF_NOM_FICHIER,
  nomDeFichier,
  PIXELS_MAX,
  typeDeNom,
  TAILLE_MAX_FICHIER,
  typeReel,
} from './fichiers';

const texte = (valeur: string) => [...valeur].map((c) => c.charCodeAt(0));
const octets = (...parties: (number[] | string)[]) =>
  Uint8Array.from(parties.flatMap((p) => (typeof p === 'string' ? texte(p) : p)));
const entier32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const petit24 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];

const PDF = octets('%PDF-1.7\n', [0, 1, 2]);
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** PNG minimal : signature, un bloc IHDR de la taille demandée, puis des blocs vides de ces noms. */
const png = (largeur: number, hauteur: number, ...blocs: string[]) =>
  octets(
    PNG_SIGNATURE,
    entier32(13),
    'IHDR',
    entier32(largeur),
    entier32(hauteur),
    [8, 6, 0, 0, 0, 0, 0, 0, 0],
    ...blocs.map((nom) => [...entier32(0), ...texte(nom), 0, 0, 0, 0]),
  );
/** JPEG minimal : SOI, un segment APP0, puis SOF0 de la taille demandée. */
const jpeg = (largeur: number, hauteur: number) =>
  octets(
    [0xff, 0xd8],
    [0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46],
    [0xff, 0xc0, 0x00, 0x0b, 0x08, hauteur >> 8, hauteur & 255, largeur >> 8, largeur & 255, 0x01, 0x01, 0x11, 0x00],
    [0xff, 0xd9],
  );
const riff = (...morceau: (number[] | string)[]) => octets('RIFF', [0, 0, 0, 0], 'WEBP', ...morceau);
const webpVp8x = (largeur: number, hauteur: number, drapeaux = 0) =>
  riff('VP8X', [10, 0, 0, 0], [drapeaux, 0, 0, 0], petit24(largeur - 1), petit24(hauteur - 1));
const webpVp8l = (largeur: number, hauteur: number) => {
  const bits = (largeur - 1) | ((hauteur - 1) << 14);
  return riff('VP8L', [5, 0, 0, 0], [0x2f], [bits & 255, (bits >> 8) & 255, (bits >> 16) & 255, (bits >> 24) & 255]);
};
const webpVp8 = (largeur: number, hauteur: number) =>
  riff(
    'VP8 ',
    [10, 0, 0, 0],
    [0, 0, 0],
    [0x9d, 0x01, 0x2a],
    [largeur & 255, largeur >> 8, hauteur & 255, hauteur >> 8],
  );

describe('typeReel (US-030 CA-3)', () => {
  it('reconnaît PDF, PNG, JPEG et WebP par leurs premiers octets', () => {
    expect(typeReel(PDF)).toBe('pdf');
    expect(typeReel(png(10, 10))).toBe('png');
    expect(typeReel(jpeg(10, 10))).toBe('jpeg');
    expect(typeReel(webpVp8x(10, 10))).toBe('webp');
  });

  it('refuse ce qui ressemble à autre chose, sans regarder l’extension', () => {
    expect(typeReel(octets('GIF89a', [0, 0, 0, 0, 0, 0]))).toBeNull();
    expect(typeReel(octets('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(typeReel(octets('MZ', [0x90, 0, 3, 0]))).toBeNull();
    expect(typeReel(octets('RIFF', [0, 0, 0, 0], 'WAVE', [0, 0]))).toBeNull();
    expect(typeReel(new Uint8Array())).toBeNull();
    expect(typeReel(octets([0x89, 0x50]))).toBeNull();
  });
});

describe('controlerFichier (US-030 CA-3)', () => {
  it('accepte une image pour une affiche et un PDF pour une feuille de route', () => {
    expect(controlerFichier('affiche', png(10, 10))).toEqual({ ok: true, type: 'png' });
    expect(controlerFichier('affiche', jpeg(10, 10))).toEqual({ ok: true, type: 'jpeg' });
    expect(controlerFichier('affiche', webpVp8l(10, 10))).toEqual({ ok: true, type: 'webp' });
    expect(controlerFichier('feuilleDeRoute', PDF)).toEqual({ ok: true, type: 'pdf' });
  });

  it('refuse un type qui ne convient pas à la sorte, avec la raison', () => {
    expect(controlerFichier('affiche', PDF)).toEqual({ ok: false, raison: 'TYPE_INCOMPATIBLE' });
    expect(controlerFichier('feuilleDeRoute', png(10, 10))).toEqual({ ok: false, raison: 'TYPE_INCOMPATIBLE' });
  });

  it('refuse un type inconnu, un fichier vide et un fichier de plus de 5 Mo', () => {
    expect(controlerFichier('affiche', octets('GIF89a', [0, 0, 0, 0, 0, 0]))).toEqual({
      ok: false,
      raison: 'TYPE_REFUSE',
    });
    expect(controlerFichier('affiche', new Uint8Array())).toEqual({ ok: false, raison: 'VIDE' });
    const gros = new Uint8Array(TAILLE_MAX_FICHIER + 1);
    gros.set(PDF);
    expect(controlerFichier('feuilleDeRoute', gros)).toEqual({ ok: false, raison: 'TROP_GROS' });
  });

  it('accepte un fichier d’exactement 5 Mo', () => {
    const limite = new Uint8Array(TAILLE_MAX_FICHIER);
    limite.set(PDF);
    expect(controlerFichier('feuilleDeRoute', limite)).toEqual({ ok: true, type: 'pdf' });
  });

  it('refuse une image animée ou de plus de 20 Mpx', () => {
    expect(controlerFichier('affiche', webpVp8x(10, 10, 0x02))).toEqual({ ok: false, raison: 'IMAGE_ANIMEE' });
    expect(controlerFichier('affiche', png(10, 10, 'acTL'))).toEqual({ ok: false, raison: 'IMAGE_ANIMEE' });
    expect(controlerFichier('affiche', png(6000, 4000))).toEqual({ ok: false, raison: 'IMAGE_TROP_GRANDE' });
    expect(controlerFichier('affiche', png(5000, 4000))).toEqual({ ok: true, type: 'png' });
  });
});

describe('dimensionsImage', () => {
  it('lit la taille d’un PNG', () => {
    expect(dimensionsImage(png(1234, 567))).toEqual({ largeur: 1234, hauteur: 567 });
  });

  it('lit la taille d’un JPEG, après ses segments d’en-tête', () => {
    expect(dimensionsImage(jpeg(1600, 900))).toEqual({ largeur: 1600, hauteur: 900 });
  });

  it('lit la taille d’un WebP, dans ses trois variantes', () => {
    expect(dimensionsImage(webpVp8x(3000, 2000))).toEqual({ largeur: 3000, hauteur: 2000 });
    expect(dimensionsImage(webpVp8l(640, 480))).toEqual({ largeur: 640, hauteur: 480 });
    expect(dimensionsImage(webpVp8(320, 200))).toEqual({ largeur: 320, hauteur: 200 });
  });

  it('renvoie null pour ce qui n’est pas une image lisible ou est tronqué', () => {
    expect(dimensionsImage(PDF)).toBeNull();
    expect(dimensionsImage(octets(PNG_SIGNATURE, [0, 0]))).toBeNull();
    expect(dimensionsImage(octets([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBeNull();
    expect(dimensionsImage(octets('RIFF', [0, 0, 0, 0], 'WEBP', 'VP8X'))).toBeNull();
  });

  it('PIXELS_MAX vaut 20 millions', () => {
    expect(PIXELS_MAX).toBe(20_000_000);
  });
});

describe('estAnimee', () => {
  it('reconnaît un PNG animé (bloc acTL avant les données) et un WebP animé', () => {
    expect(estAnimee(png(10, 10, 'acTL'))).toBe(true);
    expect(estAnimee(png(10, 10))).toBe(false);
    expect(estAnimee(webpVp8x(10, 10, 0x02))).toBe(true);
    expect(estAnimee(webpVp8x(10, 10, 0x10))).toBe(false);
    expect(estAnimee(webpVp8l(10, 10))).toBe(false);
    expect(estAnimee(jpeg(10, 10))).toBe(false);
  });
});

describe('nomDeFichier', () => {
  const empreinte = 'a'.repeat(64);

  it('compose un nom à empreinte avec l’extension du type', () => {
    expect(nomDeFichier(empreinte, 'pdf')).toBe(`${empreinte}.pdf`);
    expect(nomDeFichier(empreinte, 'jpeg')).toBe(`${empreinte}.jpg`);
    expect(nomDeFichier(empreinte, 'webp')).toBe(`${empreinte}.webp`);
    expect(nomDeFichier(empreinte, 'png')).toBe(`${empreinte}.png`);
  });

  it('typeDeNom retrouve le type d’après l’extension', () => {
    expect(typeDeNom(`${empreinte}.jpg`)).toBe('jpeg');
    expect(typeDeNom(`${empreinte}.pdf`)).toBe('pdf');
    expect(typeDeNom('autre.pdf')).toBeNull();
  });

  it('MOTIF_NOM_FICHIER n’accepte que ces noms', () => {
    expect(MOTIF_NOM_FICHIER.test(`${empreinte}.jpg`)).toBe(true);
    expect(MOTIF_NOM_FICHIER.test(`${empreinte}.svg`)).toBe(false);
    expect(MOTIF_NOM_FICHIER.test(`../${empreinte}.pdf`)).toBe(false);
    expect(MOTIF_NOM_FICHIER.test(`${'a'.repeat(63)}.pdf`)).toBe(false);
  });
});

describe('fichierHerite (US-030 CA-4)', () => {
  it('prend celui de l’épreuve, à défaut celui de la compétition, à défaut celui de la manifestation', () => {
    expect(fichierHerite(['epreuve', 'competition', 'manifestation'])).toBe('epreuve');
    expect(fichierHerite([null, 'competition', 'manifestation'])).toBe('competition');
    expect(fichierHerite([undefined, null, 'manifestation'])).toBe('manifestation');
  });

  it('renvoie null quand personne n’en a', () => {
    expect(fichierHerite([null, undefined, null])).toBeNull();
    expect(fichierHerite([])).toBeNull();
  });
});
