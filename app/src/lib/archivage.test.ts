import { describe, expect, it } from 'vitest';
import { verdictEpreuve, verdictManifestation } from './archivage';

describe('messages de l’archivage (US-033)', () => {
  it('CA-4 : une manifestation archivée est un succès, avec une remarque si des épreuves restent archivées ailleurs', () => {
    expect(verdictManifestation({ ok: true, epreuves: 2, pilotesAilleurs: [] })).toEqual({ ok: true });
    const verdict = verdictManifestation({ ok: true, epreuves: 0, pilotesAilleurs: ['Épée dames'] });
    expect(verdict).toMatchObject({ ok: true });
    expect(verdict.ok && verdict.remarque).toContain('Épée dames');
  });

  it('CA-5 : le refus pour une épreuve pilotée ailleurs nomme les épreuves', () => {
    expect(
      verdictManifestation({ ok: false, erreur: 'PILOTEE_AILLEURS', epreuves: ['Épée dames', 'Sabre M13'] }),
    ).toEqual({
      ok: false,
      message: 'Prenez la main sur Épée dames, Sabre M13 ou archivez-les depuis leur PC',
    });
  });

  it('CA-2 et CA-4 : le refus pour une épreuve en cours nomme les épreuves, au singulier comme au pluriel', () => {
    expect(verdictManifestation({ ok: false, erreur: 'EPREUVE_EN_COURS', epreuves: ['Sabre M13'] })).toEqual({
      ok: false,
      message: 'Une épreuve en cours ne peut pas être archivée :',
      noms: ['Sabre M13'],
    });
    expect(verdictManifestation({ ok: false, erreur: 'EPREUVE_EN_COURS', epreuves: ['A', 'B'] })).toMatchObject({
      message: 'Des épreuves en cours ne peuvent pas être archivées :',
    });
  });

  it('hors ligne : le serveur injoignable a son message', () => {
    expect(verdictManifestation({ ok: false, erreur: 'HORS_LIGNE' })).toMatchObject({ ok: false });
    expect(verdictEpreuve({ ok: false, erreur: 'PAS_PILOTE' })).toEqual({
      ok: false,
      message: 'Seul le PC pilote de l’épreuve peut l’archiver ou la désarchiver',
    });
    expect(verdictEpreuve({ ok: true, modifiee: true })).toEqual({ ok: true });
  });
});
