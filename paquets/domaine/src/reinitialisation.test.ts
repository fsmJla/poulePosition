import { describe, expect, it } from 'vitest';
import {
  demandeAutorisee,
  expirationLien,
  lienExpire,
  noterDemande,
  DUREE_LIEN_REINITIALISATION,
  MAX_DEMANDES_REINITIALISATION,
  FENETRE_DEMANDES_REINITIALISATION,
} from './reinitialisation';

const MINUTE = 60_000;
const T0 = Date.UTC(2026, 9, 27, 18);

describe('lien de réinitialisation (US-019)', () => {
  it('US-019 CA-3 : un lien vaut 1 heure', () => {
    expect(DUREE_LIEN_REINITIALISATION).toBe(60 * MINUTE);
    expect(expirationLien(T0)).toBe(T0 + 60 * MINUTE);
  });

  it('US-019 CA-3 : un lien est expiré à partir de sa date d’expiration', () => {
    const expireLe = expirationLien(T0);
    expect(lienExpire(expireLe, expireLe - 1)).toBe(false);
    expect(lienExpire(expireLe, expireLe)).toBe(true);
  });
});

describe('limite des demandes (US-019 CA-5)', () => {
  it('US-019 CA-5 : 3 demandes par heure pour un même compte', () => {
    expect(MAX_DEMANDES_REINITIALISATION).toBe(3);
    expect(FENETRE_DEMANDES_REINITIALISATION).toBe(60 * MINUTE);
  });

  it('US-019 CA-5 : la 4e demande dans l’heure est refusée, puis acceptée une fois la plus ancienne sortie de l’heure', () => {
    let demandes: number[] = [];
    for (let i = 0; i < 3; i++) {
      expect(demandeAutorisee(demandes, T0 + i * MINUTE)).toBe(true);
      demandes = noterDemande(demandes, T0 + i * MINUTE);
    }
    expect(demandeAutorisee(demandes, T0 + 10 * MINUTE)).toBe(false);
    expect(demandeAutorisee(demandes, T0 + 60 * MINUTE)).toBe(true);
  });

  it('noterDemande oublie les demandes de plus d’une heure et ne modifie pas la liste reçue', () => {
    const anciennes = [T0, T0 + MINUTE];
    expect(noterDemande(anciennes, T0 + 61 * MINUTE)).toEqual([T0 + MINUTE, T0 + 61 * MINUTE]);
    expect(anciennes).toEqual([T0, T0 + MINUTE]);
  });
});
