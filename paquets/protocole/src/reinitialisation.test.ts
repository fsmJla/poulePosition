import { describe, expect, it } from 'vitest';
import { deriverCle } from './authentification';
import {
  analyserDemandeMotDePasseOublie,
  analyserDemandeNouveauMotDePasse,
  jetonDuFragment,
  nouveauJeton,
  preparerNouveauMotDePasse,
  TAILLE_JETON,
} from './reinitialisation';
import { CODES_ERREUR_SESSION } from './session';

const SEL = 'AAAAAAAAAAAAAAAAAAAAAA';
const CLE = 'A'.repeat(43);
// Jeton canonique : 32 octets nuls en base64url (un « B » final ne se réencoderait pas à l'identique).
const JETON = 'A'.repeat(43);

describe('demande de lien (US-019 CA-1)', () => {
  it('US-019 CA-1 : accepte exactement un e-mail, normalisé', () => {
    expect(analyserDemandeMotDePasseOublie({ email: ' Orga@Club.FR ' })).toEqual({ ok: true, email: 'orga@club.fr' });
  });

  it.each([
    ['vide', {}],
    ['e-mail invalide', { email: 'pas-un-email' }],
    ['champ en trop', { email: 'orga@club.fr', nom: 'x' }],
  ])('refuse : %s', (_cas, brut) => {
    expect(analyserDemandeMotDePasseOublie(brut)).toEqual({ ok: false });
  });
});

describe('jeton du lien (US-019 CA-3)', () => {
  it('US-019 CA-3 : 32 octets aléatoires en base64url, différents à chaque tirage', () => {
    expect(TAILLE_JETON).toBe(32);
    const a = nouveauJeton();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(nouveauJeton()).not.toBe(a);
  });

  it('US-019 CA-3 : lit le jeton dans le fragment du lien, refuse un lien tronqué ou modifié', () => {
    expect(jetonDuFragment(`#${JETON}`)).toBe(JETON);
    expect(jetonDuFragment(JETON)).toBe(JETON);
    for (const fragment of ['', '#', `#${JETON.slice(1)}`, `#${JETON}x`, '#!!!']) {
      expect(jetonDuFragment(fragment), fragment).toBeNull();
    }
  });
});

describe('nouveau mot de passe par le lien (US-019 CA-4)', () => {
  it('US-019 CA-4 : prépare un nouveau sel et la clé dérivée, jamais le mot de passe', async () => {
    const demande = await preparerNouveauMotDePasse(JETON, 'nouveau-mot-de-passe');
    expect(Object.keys(demande).sort()).toEqual(['cle', 'jeton', 'sel']);
    expect(demande.jeton).toBe(JETON);
    expect(demande.cle).toBe(await deriverCle('nouveau-mot-de-passe', demande.sel));
    expect(JSON.stringify(demande)).not.toContain('nouveau-mot-de-passe');
    expect(analyserDemandeNouveauMotDePasse(demande)).toEqual({ ok: true, demande });
  });

  it.each([
    ['jeton absent', { sel: SEL, cle: CLE }],
    ['jeton de mauvaise taille', { jeton: 'court', sel: SEL, cle: CLE }],
    ['mot de passe en clair', { jeton: JETON, sel: SEL, cle: CLE, motDePasse: 'x' }],
    ['null', null],
  ])('refuse une demande invalide : %s', (_cas, brut) => {
    expect(analyserDemandeNouveauMotDePasse(brut)).toEqual({ ok: false });
  });

  it('US-019 CA-3 : connaît le code LIEN_INVALIDE', () => {
    expect(CODES_ERREUR_SESSION).toContain('LIEN_INVALIDE');
  });
});
