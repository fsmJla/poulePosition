import { describe, expect, it } from 'vitest';
import { accesQrOuvert, lienQr, MOTIF_JETON_QR, verifierDonneesJetonQr } from './acces-qr';
import { accesDe, projeter, verifierEvenement, type Evenement, type Proposition } from './journal';

const enTete = (seq: number) => ({
  epreuveId: 'e1',
  clubId: 'c1',
  seq,
  version: 1,
  date: 1,
  auteur: 'a@b.fr',
  source: 'clavier' as const,
});
const creation: Evenement = {
  ...enTete(1),
  type: 'EpreuveCreee',
  donnees: {
    nom: 'M13 Dames',
    arme: 'sabre',
    typeEpreuve: 'individuelle',
    categorie: 'M13',
    sexe: 'dames',
    date: null,
    horaires: { appel: null, scratch: null, debutPoules: null },
    lieu: null,
    commentaire: null,
    rattachement: { competitionId: 'comp' },
  },
};
const journal = (...propositions: Proposition[]): Evenement[] => [
  creation,
  ...propositions.map((p, i) => ({ ...enTete(i + 2), ...p }) as Evenement),
];
const E1 = 'a'.repeat(64);
const E2 = 'b'.repeat(64);
const jeton = (role: 'arbitre' | 'tireur', empreinte: string): Proposition => ({
  type: 'JetonQrDefini',
  donnees: { role, empreinte },
});

describe('accès par QR code (US-096)', () => {
  it('CA-2 : le journal garde l’empreinte de chaque jeton, par rôle', () => {
    const { epreuve } = projeter(journal(jeton('arbitre', E1), jeton('tireur', E2)));
    expect(accesDe(epreuve!)).toEqual({ arbitre: E1, tireur: E2 });
    expect(accesDe(projeter(journal()).epreuve!)).toEqual({ arbitre: null, tireur: null });
  });

  it('CA-4 : régénérer remplace l’empreinte du seul rôle concerné', () => {
    const { epreuve } = projeter(journal(jeton('arbitre', E1), jeton('tireur', E1), jeton('arbitre', E2)));
    expect(accesDe(epreuve!)).toEqual({ arbitre: E2, tireur: E1 });
  });

  it('CA-2 : refuse un rôle inconnu, une empreinte mal formée, la même empreinte, une épreuve inconnue ou archivée', () => {
    const avant = projeter(journal(jeton('arbitre', E1)));
    expect(verifierEvenement(avant, jeton('arbitre', E1))).toBe('AUCUNE_MODIFICATION');
    expect(verifierEvenement(avant, jeton('arbitre', 'pas-une-empreinte'))).toBe('EMPREINTE_INVALIDE');
    expect(
      verifierEvenement(avant, { type: 'JetonQrDefini', donnees: { role: 'spectateur' as 'arbitre', empreinte: E2 } }),
    ).toBe('ROLE_QR_INVALIDE');
    expect(verifierEvenement(avant, jeton('tireur', E2))).toBeNull();
    expect(verifierEvenement(projeter([]), jeton('tireur', E2))).toBe('EPREUVE_INCONNUE');
    const archivee = projeter(journal({ type: 'EpreuveArchivee', donnees: {} }));
    expect(verifierEvenement(archivee, jeton('tireur', E2))).toBe('EPREUVE_ARCHIVEE');
  });

  it('CA-6 : l’accès n’est ouvert qu’en préparation et en cours', () => {
    expect(accesQrOuvert('preparation')).toBe(true);
    expect(accesQrOuvert('enCours')).toBe(true);
    expect(accesQrOuvert('terminee')).toBe(false);
    expect(accesQrOuvert('archivee')).toBe(false);
  });

  it('CA-1 : le lien porte le jeton dans le fragment, jamais dans le chemin ni la requête', () => {
    expect(lienQr('https://poule-position.pessac-escrime.fr/', 'e1', 'Q3f9abcdefghijklmnopqr')).toBe(
      'https://poule-position.pessac-escrime.fr/saisie/e1#j=Q3f9abcdefghijklmnopqr',
    );
    expect(MOTIF_JETON_QR.test('Q3f9abcdefghijklmnopqr')).toBe(true);
    expect(MOTIF_JETON_QR.test('court')).toBe(false);
    expect(verifierDonneesJetonQr({ role: 'tireur', empreinte: E1 })).toBeNull();
  });
});
