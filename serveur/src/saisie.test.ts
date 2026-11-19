import { describe, expect, it } from 'vitest';
import { appareilRepris, deciderAccesQr, prochainAppareil } from './saisie';

const jetons = { arbitre: 'Q3f9abcdefghijklmnopqr', tireur: 'k8Tz_abcdefghijklmnop-' };

describe('accès des smartphones (US-097)', () => {
  it('CA-1 : le jeton en service donne son rôle, tant que l’épreuve est ouverte', () => {
    expect(deciderAccesQr({ jeton: jetons.arbitre, jetons, statut: 'enCours', bloque: false })).toEqual({
      ok: true,
      role: 'arbitre',
    });
    expect(deciderAccesQr({ jeton: jetons.tireur, jetons, statut: 'preparation', bloque: false })).toEqual({
      ok: true,
      role: 'tireur',
    });
  });

  it('CA-2 : un jeton inconnu ou régénéré, ou une épreuve inconnue, donne « lien » ; trop d’essais, « trop »', () => {
    expect(deciderAccesQr({ jeton: 'inconnu', jetons, statut: 'enCours', bloque: false })).toEqual({
      ok: false,
      refus: 'lien',
    });
    expect(
      deciderAccesQr({ jeton: 'x', jetons: { arbitre: null, tireur: null }, statut: 'enCours', bloque: false }),
    ).toEqual({ ok: false, refus: 'lien' });
    expect(deciderAccesQr({ jeton: jetons.arbitre, jetons, statut: null, bloque: false })).toEqual({
      ok: false,
      refus: 'lien',
    });
    expect(deciderAccesQr({ jeton: jetons.arbitre, jetons, statut: 'enCours', bloque: true })).toEqual({
      ok: false,
      refus: 'trop',
    });
  });

  it('cas limite et US-096 CA-6 : une épreuve terminée ou archivée refuse l’accès', () => {
    for (const statut of ['terminee', 'archivee'] as const) {
      expect(deciderAccesQr({ jeton: jetons.arbitre, jetons, statut, bloque: false })).toEqual({
        ok: false,
        refus: 'terminee',
      });
    }
  });

  it('CA-3 et CA-4 : identifiants d’appareil à la suite, et repris pour le même rôle', () => {
    expect(prochainAppareil([])).toBe('t1');
    expect(prochainAppareil(['t1', 't4', 't2'])).toBe('t5');
    const existants = [
      { id: 't1', role: 'arbitre' },
      { id: 't2', role: 'tireur' },
    ];
    expect(appareilRepris('t1', existants, 'arbitre')).toBe('t1');
    expect(appareilRepris('t2', existants, 'arbitre')).toBeNull();
    expect(appareilRepris('t9', existants, 'arbitre')).toBeNull();
    expect(appareilRepris(null, existants, 'arbitre')).toBeNull();
  });
});
