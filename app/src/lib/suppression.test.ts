import { describe, expect, it } from 'vitest';
import { nomConfirme, peutSupprimer } from './suppression';

describe('suppression définitive d’une compétition (US-039)', () => {
  it('US-039 CA-1 : un administrateur supprime une compétition qui n’est pas en cours', () => {
    for (const statut of ['preparation', 'terminee', 'archivee'] as const) {
      expect(peutSupprimer('administrateur', statut)).toEqual({ ok: true });
    }
  });

  it('US-039 CA-2 : un organisateur ne supprime pas', () => {
    expect(peutSupprimer('organisateur', 'terminee')).toEqual({ ok: false, motif: 'ADMINISTRATEUR_REQUIS' });
  });

  it('US-039 CA-3 : une compétition en cours ne se supprime pas', () => {
    expect(peutSupprimer('administrateur', 'enCours')).toEqual({ ok: false, motif: 'EN_COURS' });
  });

  it('US-039 CA-8 : le nom saisi doit être exactement celui de la compétition', () => {
    expect(nomConfirme('Challenge Orpi', 'Challenge Orpi')).toBe(true);
    expect(nomConfirme('  Challenge Orpi ', 'Challenge Orpi')).toBe(true);
    expect(nomConfirme('challenge orpi', 'Challenge Orpi')).toBe(false);
    expect(nomConfirme('', 'Challenge Orpi')).toBe(false);
  });
});
