import { describe, expect, it } from 'vitest';
import {
  analyserMessageClient,
  analyserMessageServeur,
  messageAccuse,
  messageAppareils,
  messageExclure,
  messageSaisie,
} from './messages';
import { analyserAccuse, analyserSaisieScore, analyserSaisieTelephone } from './saisies';

const telephone = {
  id: 's-1',
  poule: 1,
  tireurA: 'a',
  tireurB: 'b',
  touchesA: 5,
  touchesB: 2,
  auTemps: false,
  nom: 'Dupont',
};

describe('saisies dans le protocole (US-099)', () => {
  it('CA-4 : la saisie du téléphone, puis celle relayée à la table (rôle et appareil)', () => {
    expect(analyserSaisieTelephone(telephone)).toEqual(telephone);
    for (const casse of [
      null,
      { ...telephone, enTrop: 1 },
      { ...telephone, id: '' },
      { ...telephone, poule: 0 },
      { ...telephone, touchesA: -1 },
      { ...telephone, auTemps: 'non' },
      { ...telephone, nom: 'x'.repeat(81) },
    ]) {
      expect(analyserSaisieTelephone(casse)).toBeNull();
    }
    const relayee = { ...telephone, role: 'arbitre', appareilId: 't4' };
    expect(analyserSaisieScore(relayee)).toEqual(relayee);
    expect(analyserSaisieScore({ ...relayee, role: 'public' })).toBeNull();
    expect(analyserSaisieScore({ ...relayee, appareilId: '' })).toBeNull();
    expect(analyserSaisieScore('non')).toBeNull();
  });

  it('CA-5 à CA-7 : les accusés acceptée, refusée avec motif, doublon, suspendue', () => {
    expect(analyserAccuse({ id: 's-1', decision: 'accepte' })).toEqual({ id: 's-1', decision: 'accepte' });
    expect(analyserAccuse({ id: 's-1', decision: 'refuse', motif: 'MATCH_DEJA_SAISI' })).toEqual({
      id: 's-1',
      decision: 'refuse',
      motif: 'MATCH_DEJA_SAISI',
    });
    expect(analyserAccuse({ id: 's-1', decision: 'refuse', motif: 'INCONNU' })).toBeNull();
    expect(analyserAccuse({ id: 's-1', decision: 'accepte', motif: 'MATCH_DEJA_SAISI' })).toBeNull();
    expect(analyserAccuse({ id: 's-1', decision: 'peut-être' })).toBeNull();
    expect(analyserAccuse(null)).toBeNull();
  });

  it('CA-4 et CA-5 : les messages circulent du téléphone à la table et retour', () => {
    expect(analyserMessageClient(messageSaisie(telephone))).toMatchObject({ ok: true, message: { type: 'saisie' } });
    expect(analyserMessageClient('{"v":1,"type":"saisie","saisie":{}}')).toEqual({
      ok: false,
      erreur: 'MESSAGE_INVALIDE',
    });
    const accuse = messageAccuse({ id: 's-1', decision: 'doublon' }, 't4');
    expect(analyserMessageClient(accuse)).toEqual({
      ok: true,
      message: { v: 1, type: 'accuse', accuse: { id: 's-1', decision: 'doublon' }, appareilId: 't4' },
    });
    expect(analyserMessageServeur(messageAccuse({ id: 's-1', decision: 'suspendue' }))).toMatchObject({ ok: true });
    expect(analyserMessageServeur(messageSaisie({ ...telephone, role: 'tireur', appareilId: 't2' }))).toMatchObject({
      ok: true,
      message: { saisie: { role: 'tireur' } },
    });
    expect(analyserMessageServeur('{"v":1,"type":"saisie","saisie":null}')).toEqual({
      ok: false,
      erreur: 'MESSAGE_INVALIDE',
    });
    expect(
      analyserMessageServeur('{"v":1,"type":"accuse","accuse":{"id":"x","decision":"accepte"},"appareilId":3}'),
    ).toEqual({
      ok: false,
      erreur: 'MESSAGE_INVALIDE',
    });
  });
});

describe('appareils connectés (US-100)', () => {
  it('CA-1 : le serveur dit à la table combien de smartphones sont connectés', () => {
    expect(analyserMessageServeur(messageAppareils(7))).toEqual({
      ok: true,
      message: { v: 1, type: 'appareils', connectes: 7 },
    });
    expect(analyserMessageServeur('{"v":1,"type":"appareils","connectes":-1}')).toEqual({
      ok: false,
      erreur: 'MESSAGE_INVALIDE',
    });
  });
});

describe('correction (US-101)', () => {
  it('CA-2 : une correction porte le score qu’elle remplace, bien formé', () => {
    const correction = { ...telephone, remplace: [3, 5] };
    expect(analyserSaisieTelephone(correction)).toEqual(correction);
    expect(analyserSaisieTelephone({ ...telephone, remplace: [3] })).toBeNull();
    expect(analyserSaisieTelephone({ ...telephone, remplace: 'non' })).toBeNull();
    // US-104 : un tireur dit qui il est.
    expect(analyserSaisieTelephone({ ...telephone, tireurId: 'a' })).toEqual({ ...telephone, tireurId: 'a' });
    expect(analyserSaisieTelephone({ ...telephone, tireurId: '' })).toBeNull();
  });
});

describe('appareils connectés (US-105)', () => {
  const appareil = { id: 't4', role: 'arbitre', connecte: true, vuLe: 12, exclu: false };

  it('CA-1 : la liste des appareils accompagne le nombre ; une liste mal formée est refusée', () => {
    expect(analyserMessageServeur(messageAppareils(1, [appareil as never]))).toEqual({
      ok: true,
      message: { v: 1, type: 'appareils', connectes: 1, liste: [appareil] },
    });
    const mal = (liste: unknown) =>
      analyserMessageServeur(JSON.stringify({ v: 1, type: 'appareils', connectes: 1, liste }));
    expect(mal([{ ...appareil, role: 'pirate' }]).ok).toBe(false);
    expect(mal([{ ...appareil, vuLe: 'hier' }]).ok).toBe(false);
    expect(mal([null]).ok).toBe(false);
    expect(mal('non').ok).toBe(false);
  });

  it('CA-2 et CA-4 : la table exclut ou réadmet un appareil', () => {
    expect(analyserMessageClient(messageExclure('t4', true))).toEqual({
      ok: true,
      message: { v: 1, type: 'exclure', appareilId: 't4', exclu: true },
    });
    const mal = (corps: object) => analyserMessageClient(JSON.stringify({ v: 1, type: 'exclure', ...corps })).ok;
    expect(mal({ appareilId: '', exclu: true })).toBe(false);
    expect(mal({ appareilId: 't4', exclu: 'oui' })).toBe(false);
  });
});

describe('US-106 : saisie d’un match du tableau', () => {
  const tableau = {
    id: 's1',
    poule: 0,
    match: '16-5',
    tireurA: 'a',
    tireurB: 'b',
    touchesA: 9,
    touchesB: 9,
    auTemps: false,
    nom: 'Dupont',
    parPriorite: 'a',
  };
  it('CA-4 : le match et la priorité passent ; la poule vaut 0', () => {
    expect(analyserSaisieTelephone(tableau)).toEqual(tableau);
    expect(analyserSaisieTelephone({ ...tableau, poule: 1 })).toBeNull();
    expect(analyserSaisieTelephone({ ...tableau, match: '' })).toBeNull();
    expect(analyserSaisieTelephone({ ...tableau, parPriorite: 3 })).toBeNull();
    // La priorité sans match (saisie de poule) est refusée.
    expect(analyserSaisieTelephone({ ...tableau, match: undefined, poule: 1 })).toBeNull();
  });
});
