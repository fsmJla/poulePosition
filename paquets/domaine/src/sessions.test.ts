import { describe, expect, it } from 'vitest';
import { expirationSession, sessionExpiree, DUREE_SESSION } from './sessions';

const JOUR = 24 * 60 * 60 * 1000;

describe('sessions', () => {
  it('US-003 CA-1 : une session dure 30 jours', () => {
    expect(DUREE_SESSION).toBe(30 * JOUR);
    expect(expirationSession(1_000)).toBe(1_000 + 30 * JOUR);
  });

  it('US-003 CA-4 : chaque usage en ligne repart pour 30 jours à partir de maintenant', () => {
    const ouverture = Date.UTC(2026, 9, 1);
    const usage = ouverture + 12 * JOUR;
    expect(expirationSession(usage) - expirationSession(ouverture)).toBe(12 * JOUR);
  });

  it('US-003 CA-4 : une session est expirée à partir de sa date d’expiration', () => {
    const expireLe = Date.UTC(2026, 10, 1);
    expect(sessionExpiree(expireLe, expireLe - 1)).toBe(false);
    expect(sessionExpiree(expireLe, expireLe)).toBe(true);
    expect(sessionExpiree(expireLe, expireLe + JOUR)).toBe(true);
  });
});
