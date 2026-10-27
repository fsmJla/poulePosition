import { describe, expect, it } from 'vitest';
import { deriverCle } from './authentification';
import {
  analyserDemandeCreationCompte,
  analyserDemandeModificationCompte,
  analyserDemandeReinitialisation,
  analyserReponseCompte,
  analyserReponseComptes,
  analyserReponseSuppression,
  preparerCreationCompte,
  preparerReinitialisation,
} from './comptes';
import { CODES_ERREUR_SESSION } from './session';

const SEL = 'AAAAAAAAAAAAAAAAAAAAAA';
const CLE = 'A'.repeat(43);
const compte = {
  id: 'c1',
  email: 'orga@club.fr',
  nom: 'Orga',
  role: 'organisateur',
  actif: true,
  temporaire: true,
  derniereConnexion: null,
};

describe('création d’un compte (US-007)', () => {
  it('US-007 CA-2 : prépare un mot de passe temporaire et n’envoie que sa clé dérivée', async () => {
    const { demande, motDePasseTemporaire } = await preparerCreationCompte({
      email: ' Orga@Club.FR ',
      nom: ' Orga ',
      role: 'organisateur',
    });
    expect(motDePasseTemporaire).toMatch(/^[A-Za-z2-9]{12}$/);
    expect(Object.keys(demande).sort()).toEqual(['cle', 'email', 'nom', 'role', 'sel']);
    expect(demande).toMatchObject({ email: 'orga@club.fr', nom: 'Orga', role: 'organisateur' });
    expect(demande.cle).toBe(await deriverCle(motDePasseTemporaire, demande.sel));
    expect(JSON.stringify(demande)).not.toContain(motDePasseTemporaire);
    expect(analyserDemandeCreationCompte(demande)).toEqual({ ok: true, demande });
  });

  it('deux créations donnent deux mots de passe différents', async () => {
    const saisie = { email: 'a@club.fr', nom: 'A', role: 'organisateur' as const };
    const [premier, second] = await Promise.all([preparerCreationCompte(saisie), preparerCreationCompte(saisie)]);
    expect(premier.motDePasseTemporaire).not.toBe(second.motDePasseTemporaire);
  });

  it.each([
    ['null', null],
    ['e-mail invalide', { email: 'orga', nom: 'Orga', role: 'organisateur', sel: SEL, cle: CLE }],
    ['nom vide', { email: 'orga@club.fr', nom: ' ', role: 'organisateur', sel: SEL, cle: CLE }],
    ['rôle inconnu', { email: 'orga@club.fr', nom: 'Orga', role: 'arbitre', sel: SEL, cle: CLE }],
    ['clé absente', { email: 'orga@club.fr', nom: 'Orga', role: 'organisateur', sel: SEL }],
    [
      'mot de passe en clair',
      { email: 'orga@club.fr', nom: 'Orga', role: 'organisateur', sel: SEL, cle: CLE, motDePasse: 'x' },
    ],
  ])('refuse une demande de création invalide : %s', (_cas, brut) => {
    expect(analyserDemandeCreationCompte(brut)).toEqual({ ok: false });
  });
});

describe('modification d’un compte (US-007 CA-4)', () => {
  it('accepte le nom, le rôle, ou les deux', () => {
    expect(analyserDemandeModificationCompte({ nom: ' Nouveau nom ' })).toEqual({
      ok: true,
      demande: { nom: 'Nouveau nom' },
    });
    expect(analyserDemandeModificationCompte({ role: 'administrateur' })).toEqual({
      ok: true,
      demande: { role: 'administrateur' },
    });
    expect(analyserDemandeModificationCompte({ nom: 'N', role: 'organisateur' })).toEqual({
      ok: true,
      demande: { nom: 'N', role: 'organisateur' },
    });
  });

  it('US-008 CA-1 et CA-2 : accepte l’état actif, seul ou avec le nom et le rôle', () => {
    expect(analyserDemandeModificationCompte({ actif: false })).toEqual({ ok: true, demande: { actif: false } });
    expect(analyserDemandeModificationCompte({ actif: true, nom: 'N' })).toEqual({
      ok: true,
      demande: { actif: true, nom: 'N' },
    });
  });

  it.each([
    ['vide', {}],
    ['nom vide', { nom: ' ' }],
    ['rôle inconnu', { role: 'arbitre' }],
    ['état actif qui n’est pas un booléen', { actif: 'non' }],
    ['e-mail (non modifiable)', { email: 'autre@club.fr' }],
    ['tableau', []],
  ])('refuse : %s', (_cas, brut) => {
    expect(analyserDemandeModificationCompte(brut)).toEqual({ ok: false });
  });
});

describe('réponses (côté application)', () => {
  it('US-007 CA-1 : lit la liste des comptes', () => {
    expect(analyserReponseComptes({ ok: true, comptes: [compte] })).toEqual({ ok: true, comptes: [compte] });
    expect(analyserReponseComptes({ ok: true, comptes: [{ ...compte, derniereConnexion: 5 }] })).toMatchObject({
      ok: true,
    });
  });

  it('refuse une liste mal formée', () => {
    expect(analyserReponseComptes({ ok: true, comptes: [{ ...compte, actif: 'oui' }] })).toEqual({
      ok: false,
      erreur: 'REPONSE_INVALIDE',
    });
    expect(analyserReponseComptes({ ok: true })).toEqual({ ok: false, erreur: 'REPONSE_INVALIDE' });
  });

  it('lit un compte créé ou modifié, et transmet les codes d’erreur des comptes', () => {
    expect(analyserReponseCompte({ ok: true, compte })).toEqual({ ok: true, compte });
    for (const code of ['ACCES_REFUSE', 'COMPTE_INCONNU', 'EMAIL_DEJA_UTILISE', 'DERNIER_ADMINISTRATEUR']) {
      expect(CODES_ERREUR_SESSION).toContain(code);
      expect(analyserReponseCompte({ ok: false, erreur: code })).toEqual({ ok: false, erreur: code });
    }
  });

  it('US-008 CA-3 : lit la réponse d’une suppression', () => {
    expect(analyserReponseSuppression({ ok: true })).toEqual({ ok: true });
    expect(analyserReponseSuppression({ ok: false, erreur: 'DERNIER_ADMINISTRATEUR' })).toEqual({
      ok: false,
      erreur: 'DERNIER_ADMINISTRATEUR',
    });
    expect(analyserReponseSuppression(undefined)).toEqual({ ok: false, erreur: 'REPONSE_INVALIDE' });
  });
});

describe('réinitialisation d’un mot de passe (US-009)', () => {
  it('US-009 CA-1 : nouveau mot de passe temporaire, seule sa clé dérivée est envoyée', async () => {
    const { demande, motDePasseTemporaire } = await preparerReinitialisation();
    expect(motDePasseTemporaire).toMatch(/^[A-Za-z2-9]{12}$/);
    expect(Object.keys(demande).sort()).toEqual(['cle', 'sel']);
    expect(demande.cle).toBe(await deriverCle(motDePasseTemporaire, demande.sel));
    expect(JSON.stringify(demande)).not.toContain(motDePasseTemporaire);
    expect(analyserDemandeReinitialisation(demande)).toEqual({ ok: true, demande });
  });

  it.each([
    ['null', null],
    ['sel absent', { cle: CLE }],
    ['clé de mauvaise taille', { sel: SEL, cle: 'AAAA' }],
    ['mot de passe en clair', { sel: SEL, cle: CLE, motDePasse: 'x' }],
  ])('refuse une demande invalide : %s', (_cas, brut) => {
    expect(analyserDemandeReinitialisation(brut)).toEqual({ ok: false });
  });
});
