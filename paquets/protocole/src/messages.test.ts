import { describe, expect, it } from 'vitest';
import {
  analyserEnveloppe,
  analyserMessageServeur,
  messageBienvenue,
  messageErreur,
  ERREURS,
  MESSAGE_PING,
  MESSAGE_PONG,
  TAILLE_MAX_MESSAGE,
  VERSION_PROTOCOLE,
} from './messages';

describe('construction des messages', () => {
  it('bienvenue porte la version, le type et la compétition', () => {
    expect(JSON.parse(messageBienvenue('demo'))).toEqual({
      v: VERSION_PROTOCOLE,
      type: 'bienvenue',
      competitionId: 'demo',
    });
  });

  it('erreur porte le code et son message lisible en français', () => {
    expect(JSON.parse(messageErreur('TYPE_INTERDIT'))).toEqual({
      v: 1,
      type: 'erreur',
      code: 'TYPE_INTERDIT',
      message: ERREURS.TYPE_INTERDIT,
    });
  });

  it('ping et pong ont une écriture exacte, sans espace (réponse automatique du serveur)', () => {
    expect(MESSAGE_PING).toBe('{"v":1,"type":"ping"}');
    expect(MESSAGE_PONG).toBe('{"v":1,"type":"pong"}');
  });
});

describe('analyserEnveloppe', () => {
  it('accepte un objet JSON en version 1 avec un type', () => {
    expect(analyserEnveloppe('{"v":1,"type":"saisie","x":2}')).toEqual({
      ok: true,
      contenu: { v: 1, type: 'saisie', x: 2 },
    });
  });

  it.each([
    ['un message binaire', new ArrayBuffer(4)],
    ['du JSON invalide', '{v:1'],
    ['un tableau', '[1,2]'],
    ['null', 'null'],
    ['un nombre', '42'],
  ])('refuse %s (MESSAGE_INVALIDE)', (_cas, brut) => {
    expect(analyserEnveloppe(brut)).toEqual({ ok: false, erreur: 'MESSAGE_INVALIDE' });
  });

  it('refuse un message de plus de 256 Ko (MESSAGE_TROP_GROS), en comptant les octets UTF-8', () => {
    const remplissage = 'é'.repeat(TAILLE_MAX_MESSAGE / 2);
    expect(analyserEnveloppe(JSON.stringify({ v: 1, type: 'x', remplissage }))).toEqual({
      ok: false,
      erreur: 'MESSAGE_TROP_GROS',
    });
  });

  it('refuse une version absente ou différente de 1 (VERSION_INCONNUE)', () => {
    expect(analyserEnveloppe('{"type":"ping"}')).toEqual({ ok: false, erreur: 'VERSION_INCONNUE' });
    expect(analyserEnveloppe('{"v":2,"type":"ping"}')).toEqual({ ok: false, erreur: 'VERSION_INCONNUE' });
  });

  it('refuse un type absent ou vide (TYPE_INTERDIT)', () => {
    expect(analyserEnveloppe('{"v":1}')).toEqual({ ok: false, erreur: 'TYPE_INTERDIT' });
    expect(analyserEnveloppe('{"v":1,"type":""}')).toEqual({ ok: false, erreur: 'TYPE_INTERDIT' });
  });
});

describe('analyserMessageServeur', () => {
  it('reconnaît bienvenue, erreur et pong', () => {
    expect(analyserMessageServeur(messageBienvenue('demo'))).toEqual({
      ok: true,
      message: { v: 1, type: 'bienvenue', competitionId: 'demo' },
    });
    expect(analyserMessageServeur(messageErreur('MESSAGE_INVALIDE'))).toMatchObject({
      ok: true,
      message: { type: 'erreur', code: 'MESSAGE_INVALIDE' },
    });
    expect(analyserMessageServeur(MESSAGE_PONG)).toEqual({ ok: true, message: { v: 1, type: 'pong' } });
  });

  it('refuse un type inconnu ou des champs manquants', () => {
    expect(analyserMessageServeur('{"v":1,"type":"inconnu"}')).toEqual({ ok: false, erreur: 'TYPE_INTERDIT' });
    expect(analyserMessageServeur('{"v":1,"type":"bienvenue"}')).toEqual({ ok: false, erreur: 'MESSAGE_INVALIDE' });
    expect(analyserMessageServeur('{"v":1,"type":"erreur","code":"PAS_UN_CODE"}')).toEqual({
      ok: false,
      erreur: 'MESSAGE_INVALIDE',
    });
  });

  it('transmet l’erreur d’enveloppe', () => {
    expect(analyserMessageServeur('pas du json')).toEqual({ ok: false, erreur: 'MESSAGE_INVALIDE' });
  });
});
