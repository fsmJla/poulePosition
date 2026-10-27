import { pbkdf2Sync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  analyserDemandeEssaiEmail,
  analyserDemandeInstallation,
  decoderBase64Url,
  deriverCle,
  encoderBase64Url,
  messageErreurInstallation,
  nouveauSel,
  preparerDemandeInstallation,
  ITERATIONS_PBKDF2,
  TAILLE_CLE,
  TAILLE_SEL,
} from './authentification';

describe('base64url', () => {
  it('encode et décode sans perte, sans rembourrage ni caractères + /', () => {
    const octets = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255]);
    const texte = encoderBase64Url(octets);
    expect(texte).not.toMatch(/[+/=]/);
    expect([...decoderBase64Url(texte)]).toEqual([...octets]);
  });

  it('refuse un texte qui n’est pas du base64url', () => {
    expect(() => decoderBase64Url('pas du base64 !')).toThrow();
  });
});

describe('dérivation du mot de passe (ADR-0006)', () => {
  it('produit un sel aléatoire de 16 octets', () => {
    const sel = nouveauSel();
    expect(decoderBase64Url(sel)).toHaveLength(TAILLE_SEL);
    expect(nouveauSel()).not.toBe(sel);
  });

  it('US-002 CA-2 : la dérivation PBKDF2-SHA256 (600 000 itérations) est identique sous Node et dans WebCrypto', async () => {
    const sel = nouveauSel();
    const attendu = pbkdf2Sync('mot de passe très sûr', decoderBase64Url(sel), ITERATIONS_PBKDF2, TAILLE_CLE, 'sha256');
    expect(await deriverCle('mot de passe très sûr', sel)).toBe(encoderBase64Url(new Uint8Array(attendu)));
  });

  it('normalise le mot de passe en NFC (un « é » composé ou décomposé donne la même clé)', async () => {
    const sel = nouveauSel();
    expect(await deriverCle('café-escrime', sel)).toBe(await deriverCle('café-escrime', sel));
  });
});

describe('demande d’installation', () => {
  it('US-002 CA-2 : ne contient ni le mot de passe, ni rien d’autre que e-mail, nom, sel et clé dérivée', async () => {
    const demande = await preparerDemandeInstallation({
      email: ' Admin@Club.FR ',
      nom: '  Julien Lameyre ',
      motDePasse: 'secret-du-club-2027',
    });
    expect(Object.keys(demande).sort()).toEqual(['cle', 'email', 'nom', 'sel']);
    expect(demande.email).toBe('admin@club.fr');
    expect(demande.nom).toBe('Julien Lameyre');
    expect(JSON.stringify(demande)).not.toContain('secret-du-club-2027');
    expect(demande.cle).toBe(await deriverCle('secret-du-club-2027', demande.sel));
  });

  it('analyserDemandeInstallation accepte une demande valide', async () => {
    const demande = await preparerDemandeInstallation({ email: 'a@club.fr', nom: 'A', motDePasse: 'x'.repeat(10) });
    expect(analyserDemandeInstallation(demande)).toEqual({ ok: true, demande });
  });

  it.each([
    ['pas un objet', 'texte'],
    ['null', null],
    ['e-mail invalide', { email: 'pas-un-email', nom: 'A', sel: 'AAAAAAAAAAAAAAAAAAAAAA', cle: 'A'.repeat(43) }],
    ['nom vide', { email: 'a@club.fr', nom: ' ', sel: 'AAAAAAAAAAAAAAAAAAAAAA', cle: 'A'.repeat(43) }],
    ['sel de mauvaise taille', { email: 'a@club.fr', nom: 'A', sel: 'AAAA', cle: 'A'.repeat(43) }],
    ['clé de mauvaise taille', { email: 'a@club.fr', nom: 'A', sel: 'AAAAAAAAAAAAAAAAAAAAAA', cle: 'AAAA' }],
    ['clé non base64url', { email: 'a@club.fr', nom: 'A', sel: 'AAAAAAAAAAAAAAAAAAAAAA', cle: '!'.repeat(43) }],
    [
      'champ en trop (mot de passe)',
      { email: 'a@club.fr', nom: 'A', sel: 'AAAAAAAAAAAAAAAAAAAAAA', cle: 'A'.repeat(43), motDePasse: 'x' },
    ],
  ])('analyserDemandeInstallation refuse : %s', (_cas, brut) => {
    expect(analyserDemandeInstallation(brut)).toEqual({ ok: false });
  });
});

describe('erreurs d’installation', () => {
  it('donne le message lisible d’un code, ou un message générique', () => {
    expect(messageErreurInstallation('ADMINISTRATEUR_EXISTANT')).toBe(
      'Un administrateur existe déjà : utilisez la gestion des comptes',
    );
    expect(messageErreurInstallation('INCONNU')).toBe('Erreur inattendue du serveur');
    expect(messageErreurInstallation(undefined)).toBe('Erreur inattendue du serveur');
  });
});

describe('essai d’envoi d’e-mail (US-018)', () => {
  it('US-018 CA-2 : accepte exactement un destinataire valide, normalisé', () => {
    expect(analyserDemandeEssaiEmail({ destinataire: ' Julien@Club.FR ' })).toEqual({
      ok: true,
      destinataire: 'julien@club.fr',
    });
  });

  it.each([
    ['vide', {}],
    ['destinataire invalide', { destinataire: 'pas-un-email' }],
    ['champ en trop', { destinataire: 'julien@club.fr', copie: 'autre@club.fr' }],
    ['null', null],
  ])('US-018 : refuse une demande invalide (%s)', (_cas, brut) => {
    expect(analyserDemandeEssaiEmail(brut)).toEqual({ ok: false });
  });

  it('US-018 CA-4 et CA-5 : les erreurs d’envoi ont un message lisible, sans détail SMTP', () => {
    expect(messageErreurInstallation('ENVOI_NON_CONFIGURE')).toMatch(/non configuré/);
    expect(messageErreurInstallation('ENVOI_IMPOSSIBLE')).toMatch(/^Envoi impossible/);
  });
});
