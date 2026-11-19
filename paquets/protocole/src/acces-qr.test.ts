import { describe, expect, it } from 'vitest';
import { analyserDemandeJetonQr, analyserReponseJetonQr, analyserReponseJetonsQr, estRoleQr } from './acces-qr';

const J = 'Q3f9abcdefghijklmnopqr';

describe('jetons des QR codes dans le protocole (US-096)', () => {
  it('CA-2 : la demande porte l’appareil pilote et un jeton de 128 bits', () => {
    expect(analyserDemandeJetonQr({ appareilId: 'pc-a', jeton: J })).toEqual({
      ok: true,
      demande: { appareilId: 'pc-a', jeton: J },
    });
    for (const casse of [
      null,
      { appareilId: 'pc-a' },
      { appareilId: '', jeton: J },
      { appareilId: 'x'.repeat(65), jeton: J },
      { appareilId: 'pc-a', jeton: 'court' },
      { appareilId: 'pc-a', jeton: J, enTrop: 1 },
    ]) {
      expect(analyserDemandeJetonQr(casse)).toEqual({ ok: false });
    }
  });

  it('CA-1 : la lecture des jetons, en clair ou null', () => {
    expect(analyserReponseJetonsQr({ ok: true, arbitre: J, tireur: null })).toEqual({
      ok: true,
      arbitre: J,
      tireur: null,
    });
    expect(analyserReponseJetonsQr({ ok: true, arbitre: 'faux', tireur: null })).toEqual({
      ok: false,
      erreur: 'REPONSE_INVALIDE',
    });
    expect(analyserReponseJetonsQr({ ok: false, erreur: 'SESSION_INVALIDE' })).toEqual({
      ok: false,
      erreur: 'SESSION_INVALIDE',
    });
    expect(analyserReponseJetonsQr(undefined)).toEqual({ ok: false, erreur: 'REPONSE_INVALIDE' });
  });

  it('CA-4 : un refus PAS_PILOTE dit qui pilote', () => {
    expect(analyserReponseJetonQr({ ok: true })).toEqual({ ok: true });
    expect(
      analyserReponseJetonQr({ ok: false, erreur: 'PAS_PILOTE', piloteAppareil: 'pc-b', piloteNom: 'Marie' }),
    ).toEqual({
      ok: false,
      erreur: 'PAS_PILOTE',
      piloteAppareil: 'pc-b',
      piloteNom: 'Marie',
    });
    expect(analyserReponseJetonQr('n’importe quoi')).toEqual({ ok: false, erreur: 'REPONSE_INVALIDE' });
    expect(estRoleQr('arbitre')).toBe(true);
    expect(estRoleQr('public')).toBe(false);
  });
});
