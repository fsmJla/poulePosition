import { describe, expect, it } from 'vitest';
import { decoderCsv, lireFichierEquipes, TAILLE_MAX_FICHIER_EQUIPES } from './fichier-equipes';

const latin1 = (texte: string) => Uint8Array.from([...texte].map((c) => c.charCodeAt(0)));
const utf8 = (texte: string) => new TextEncoder().encode(texte);
const BOM = String.fromCharCode(0xfeff);
const CSV = 'Équipe;Nom 1;Prénom 1;Nom 2;Prénom 2\nPessac 1;DUBOIS;Chloé;MÉRIGNAC;Léa\n';

describe('lecture du CSV d’équipes (US-156)', () => {
  it('CA-1 : décode l’UTF-8 avec ou sans BOM, puis l’ISO-8859-1', () => {
    expect(decoderCsv(utf8(CSV))).toBe(CSV);
    expect(decoderCsv(utf8(`${BOM}${CSV}`))).toBe(CSV);
    expect(decoderCsv(latin1(CSV))).toBe(CSV);
  });

  it('CA-1 : lit les équipes d’un fichier ISO-8859-1 ou UTF-8', () => {
    for (const octets of [latin1(CSV), utf8(CSV)]) {
      const lu = lireFichierEquipes(octets);
      expect(lu.ok && lu.lignes[0]?.titulaires[1]).toMatchObject({ nom: 'MÉRIGNAC', prenom: 'Léa' });
    }
  });

  it('CA-5 : refuse un fichier trop gros, d’un autre format ou sans équipe', () => {
    expect(lireFichierEquipes(new Uint8Array(TAILLE_MAX_FICHIER_EQUIPES + 1))).toEqual({
      ok: false,
      erreur: 'TROP_GROS',
    });
    expect(lireFichierEquipes(utf8('<?xml version="1.0"?><Base/>'))).toMatchObject({
      ok: false,
      erreur: 'COLONNES_MANQUANTES',
    });
    expect(lireFichierEquipes(utf8('Équipe;Nom 1;Prénom 1;Nom 2;Prénom 2\n'))).toEqual({
      ok: false,
      erreur: 'AUCUNE_EQUIPE',
    });
  });
});
