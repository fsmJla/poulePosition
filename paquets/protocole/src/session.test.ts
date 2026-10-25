import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { decoderBase64Url, deriverCle, encoderBase64Url, nouveauSel } from './authentification';
import {
  analyserDemandeConnexion,
  analyserDemandeSel,
  analyserReponseSel,
  analyserReponseSession,
  verificateurLocal,
  CODES_ERREUR_SESSION,
} from './session';

const SEL = 'AAAAAAAAAAAAAAAAAAAAAA';
const CLE = 'A'.repeat(43);

const sessionValide = {
  ok: true,
  jeton: 'en-tete.charge.signature',
  expireLe: 1_795_000_000_000,
  compte: { email: 'orga@club.fr', nom: 'Orga', role: 'organisateur', temporaire: false },
};

describe('demande de sel', () => {
  it('US-003 : normalise l’e-mail (majuscules, espaces)', () => {
    expect(analyserDemandeSel({ email: '  Orga@Club.FR ' })).toEqual({ ok: true, email: 'orga@club.fr' });
  });

  it.each([
    ['pas un objet', 'orga@club.fr'],
    ['null', null],
    ['tableau', []],
    ['e-mail invalide', { email: 'pas-un-email' }],
    ['e-mail absent', {}],
    ['champ en trop', { email: 'orga@club.fr', cle: CLE }],
  ])('refuse : %s', (_cas, brut) => {
    expect(analyserDemandeSel(brut)).toEqual({ ok: false });
  });
});

describe('demande de connexion', () => {
  it('US-003 : accepte e-mail et clé dérivée, e-mail normalisé', () => {
    expect(analyserDemandeConnexion({ email: ' Orga@Club.fr', cle: CLE })).toEqual({
      ok: true,
      demande: { email: 'orga@club.fr', cle: CLE },
    });
  });

  it.each([
    ['null', null],
    ['clé de mauvaise taille', { email: 'orga@club.fr', cle: 'AAAA' }],
    ['clé non base64url', { email: 'orga@club.fr', cle: '!'.repeat(43) }],
    ['e-mail invalide', { email: 'orga', cle: CLE }],
    ['mot de passe envoyé', { email: 'orga@club.fr', cle: CLE, motDePasse: 'x' }],
  ])('refuse : %s', (_cas, brut) => {
    expect(analyserDemandeConnexion(brut)).toEqual({ ok: false });
  });
});

describe('réponses du serveur (côté application)', () => {
  it('lit un sel', () => {
    expect(analyserReponseSel({ ok: true, sel: SEL })).toEqual({ ok: true, sel: SEL });
  });

  it('refuse une réponse de sel mal formée, et transmet un code d’erreur connu', () => {
    expect(analyserReponseSel({ ok: true, sel: 'AAAA' })).toEqual({ ok: false, erreur: 'REPONSE_INVALIDE' });
    expect(analyserReponseSel('texte')).toEqual({ ok: false, erreur: 'REPONSE_INVALIDE' });
    expect(analyserReponseSel({ ok: false, erreur: 'SERVEUR_NON_CONFIGURE' })).toEqual({
      ok: false,
      erreur: 'SERVEUR_NON_CONFIGURE',
    });
    expect(analyserReponseSel({ ok: false, erreur: 'INCONNU' })).toEqual({ ok: false, erreur: 'REPONSE_INVALIDE' });
  });

  it('US-003 CA-1 : lit une session (jeton, expiration, compte)', () => {
    expect(analyserReponseSession(sessionValide)).toEqual({
      ok: true,
      session: {
        jeton: sessionValide.jeton,
        expireLe: sessionValide.expireLe,
        compte: sessionValide.compte,
      },
    });
  });

  it.each([
    ['jeton absent', { ...sessionValide, jeton: '' }],
    ['expiration non numérique', { ...sessionValide, expireLe: 'demain' }],
    ['compte absent', { ...sessionValide, compte: null }],
    ['rôle inconnu', { ...sessionValide, compte: { ...sessionValide.compte, role: 'arbitre' } }],
    ['nom absent', { ...sessionValide, compte: { ...sessionValide.compte, nom: 3 } }],
    ['temporaire absent', { ...sessionValide, compte: { email: 'a@b.fr', nom: 'A', role: 'organisateur' } }],
  ])('refuse une session mal formée : %s', (_cas, brut) => {
    expect(analyserReponseSession(brut)).toEqual({ ok: false, erreur: 'REPONSE_INVALIDE' });
  });

  it.each(CODES_ERREUR_SESSION)('US-003 CA-2/CA-3/CA-7 : transmet le code %s', (code) => {
    expect(analyserReponseSession({ ok: false, erreur: code })).toEqual({ ok: false, erreur: code });
  });
});

describe('vérificateur local (ADR-0006)', () => {
  it('US-003 CA-5 : vaut HMAC-SHA256(clé, "local") et diffère de la clé', async () => {
    const cle = await deriverCle('mot-de-passe-solide', nouveauSel());
    const attendu = createHmac('sha256', decoderBase64Url(cle)).update('local').digest();
    const local = await verificateurLocal(cle);
    expect(local).toBe(encoderBase64Url(new Uint8Array(attendu)));
    expect(local).not.toBe(cle);
  });
});
