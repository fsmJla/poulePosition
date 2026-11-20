import { describe, expect, it } from 'vitest';
import type { VueSaisie } from '@poule-position/domaine';
import { analyserMessageClient, analyserMessageServeur, messageVue, TAILLE_MAX_MESSAGE } from './messages';
import { analyserVueSaisie } from './vue-saisie';

const vue = (): VueSaisie => ({
  epreuveId: 'e1',
  nom: 'M13 Dames',
  arme: 'sabre',
  categorie: 'M13',
  sexe: 'dames',
  date: '2026-11-11',
  competition: 'Championnats de Nouvelle Aquitaine',
  touches: 5,
  droits: {
    arbitreSaisitScores: true,
    tireurSaisitPoule: true,
    tireurSaisitTableau: false,
    correctionScore: 'arbitre',
  },
  lancees: true,
  poules: [
    {
      numero: 2,
      piste: 2,
      tireurs: [
        { id: 'a', nom: 'DUBOIS', prenom: 'Chloé', club: 'SPUC' },
        { id: 'b', nom: 'VINCENT', prenom: 'Sarah', club: 'Bayonne' },
      ],
      matchs: [{ numero: 1, tireurA: 'a', tireurB: 'b', touches: [5, 2], auTemps: false, forfait: false }],
      regles: 1,
      total: 1,
      classement: [
        { tireurId: 'a', rang: 1, victoires: 1, matchs: 1, indice: 3, retrait: null },
        { tireurId: 'b', rang: 2, victoires: 0, matchs: 1, indice: -3, retrait: 'abandon' },
      ],
    },
  ],
});

describe('vue de saisie dans le protocole (US-095)', () => {
  it('CA-4 : une vue bien formée est lue à l’identique', () => {
    expect(analyserVueSaisie(vue())).toEqual(vue());
    expect(analyserVueSaisie({ ...vue(), lancees: false, poules: [], sexe: null, competition: null })).not.toBeNull();
  });

  it('US-112 CA-6 : une vue avec son tableau (ou un tableau null) est lue à l’identique', () => {
    const place = (tireurId: string | null, rang: number | null, provenance: string | null = null) => ({
      tireurId,
      rang,
      provenance,
    });
    const tableau = {
      touches: 15,
      taille: 2,
      matchs: [
        {
          id: '2-1',
          tour: 2,
          numero: 1,
          haut: place('a', 1),
          bas: place('b', 2),
          etat: 'aTirer' as const,
          touches: null,
          vainqueur: null,
          parPriorite: false,
          piste: 3,
          enPiste: true,
          appeleA: 1_800_000_000_000,
        },
      ],
    };
    expect(analyserVueSaisie({ ...vue(), tableau })).toEqual({ ...vue(), tableau });
    expect(analyserVueSaisie({ ...vue(), tableau: null })).toEqual({ ...vue(), tableau: null });
    const match = tableau.matchs[0]!;
    expect(analyserVueSaisie({ ...vue(), tableau: { ...tableau, matchs: [{ ...match, etat: 'joue' }] } })).toBeNull();
    expect(analyserVueSaisie({ ...vue(), tableau: { ...tableau, matchs: [{ ...match, piste: 0 }] } })).toBeNull();
    expect(
      analyserVueSaisie({ ...vue(), tableau: { ...tableau, matchs: [{ ...match, haut: place('a', 0) }] } }),
    ).toBeNull();
    expect(analyserVueSaisie({ ...vue(), tableau: { ...tableau, matchs: [{ ...match, touches: [1] }] } })).toBeNull();
    expect(analyserVueSaisie({ ...vue(), tableau: { ...tableau, taille: 1 } })).toBeNull();
    expect(analyserVueSaisie({ ...vue(), tableau: { ...tableau, matchs: 'x' } })).toBeNull();
    expect(analyserVueSaisie({ ...vue(), tableau: { ...tableau, matchs: [{ ...match, enPiste: 1 }] } })).toBeNull();
  });

  it('CA-4 : une vue mal formée est refusée', () => {
    const casses: unknown[] = [
      null,
      { ...vue(), enTrop: 1 },
      { ...vue(), arme: 'lance' },
      { ...vue(), touches: 0 },
      { ...vue(), droits: { ...vue().droits, correctionScore: 'tout le monde' } },
      { ...vue(), poules: 'non' },
      { ...vue(), poules: [{ ...vue().poules[0], piste: 0 }] },
      { ...vue(), poules: [{ ...vue().poules[0], tireurs: [{ id: 'a' }] }] },
      { ...vue(), poules: [{ ...vue().poules[0], matchs: [{ ...vue().poules[0]!.matchs[0], touches: [5] }] }] },
      {
        ...vue(),
        poules: [{ ...vue().poules[0], classement: [{ ...vue().poules[0]!.classement[0], retrait: 'blessure' }] }],
      },
    ];
    for (const cas of casses) expect(analyserVueSaisie(cas)).toBeNull();
  });

  it('CA-1 et CA-2 : le message vue circule du pilote au serveur, puis du serveur aux smartphones', () => {
    const texte = messageVue(vue());
    expect(analyserMessageClient(texte)).toEqual({ ok: true, message: { v: 1, type: 'vue', vue: vue() } });
    expect(analyserMessageServeur(texte)).toEqual({ ok: true, message: { v: 1, type: 'vue', vue: vue() } });
  });

  it('CA-4 : un message client inconnu, mal formé ou trop gros est refusé', () => {
    expect(analyserMessageClient('{"v":1,"type":"inconnu"}')).toEqual({ ok: false, erreur: 'TYPE_INTERDIT' });
    expect(analyserMessageClient('{"v":1,"type":"vue","vue":{}}')).toEqual({ ok: false, erreur: 'MESSAGE_INVALIDE' });
    expect(analyserMessageClient('pas du json')).toEqual({ ok: false, erreur: 'MESSAGE_INVALIDE' });
    const enorme = messageVue({ ...vue(), nom: 'x'.repeat(TAILLE_MAX_MESSAGE) });
    expect(analyserMessageClient(enorme)).toEqual({ ok: false, erreur: 'MESSAGE_TROP_GROS' });
    expect(analyserMessageServeur('{"v":1,"type":"vue","vue":null}')).toEqual({
      ok: false,
      erreur: 'MESSAGE_INVALIDE',
    });
  });

  it('CA-4 : une épreuve de 60 tireurs (10 poules de 6) tient largement dans un message', () => {
    const poule = (numero: number) => ({
      ...vue().poules[0]!,
      numero,
      tireurs: Array.from({ length: 6 }, () => ({
        id: crypto.randomUUID(),
        nom: 'NOMDEFAMILLE-LONG',
        prenom: 'Prénom-Composé',
        club: 'Cercle d’escrime de la ville',
      })),
      matchs: Array.from({ length: 15 }, (_, i) => ({
        numero: i + 1,
        tireurA: crypto.randomUUID(),
        tireurB: crypto.randomUUID(),
        touches: [5, 3] as [number, number],
        auTemps: false,
        forfait: false,
      })),
    });
    const grande = { ...vue(), poules: Array.from({ length: 10 }, (_, i) => poule(i + 1)) };
    expect(new TextEncoder().encode(messageVue(grande)).length).toBeLessThan(TAILLE_MAX_MESSAGE / 4);
  });
});
