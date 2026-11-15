// Reprise d'une épreuve depuis un fichier (US-035 CA-2, CA-3, CA-5, CA-6 et cas limites).
import { describe, expect, it } from 'vitest';
import type { Evenement } from './journal';
import { planifierImport, prefixeCommun, reconcilier, renumeroterEpreuve } from './reprise';

const evenement = (seq: number, publiee = true, epreuveId = 'e1'): Evenement => ({
  epreuveId,
  clubId: 'pessac',
  seq,
  version: 1,
  date: 1_800_000_000_000 + seq,
  auteur: 'orga@club.fr',
  source: 'clavier',
  type: 'PublicationModifiee',
  donnees: { publiee },
});

const journal = (n: number) => Array.from({ length: n }, (_, i) => evenement(i + 1));

describe('prefixeCommun', () => {
  it('compte les événements de tête identiques', () => {
    expect(prefixeCommun(journal(3), journal(5))).toBe(3);
    expect(prefixeCommun([], journal(2))).toBe(0);
    expect(prefixeCommun([evenement(1), evenement(2, false)], journal(2))).toBe(1);
  });
});

describe('ordre des champs', () => {
  it('ne compte pas : un serveur peut renvoyer les champs dans un autre ordre', () => {
    const { donnees, type, ...tete } = evenement(1);
    const autreOrdre = { type, donnees: { publiee: true }, ...tete } as Evenement;
    expect(prefixeCommun([evenement(1)], [autreOrdre])).toBe(1);
    expect(donnees).toEqual({ publiee: true });
  });

  it('compare aussi les valeurs nulles, les listes et les objets imbriqués', () => {
    const a = { ...evenement(1), donnees: { x: [1, { y: null }], z: undefined } } as unknown as Evenement;
    const b = { ...evenement(1), donnees: { z: undefined, x: [1, { y: null }] } } as unknown as Evenement;
    const c = { ...evenement(1), donnees: { x: [1, { y: 0 }] } } as unknown as Evenement;
    expect(prefixeCommun([a], [b])).toBe(1);
    expect(prefixeCommun([a], [c])).toBe(0);
  });
});

describe('planifierImport', () => {
  it('CA-2 : épreuve inconnue de l’appareil', () => {
    expect(planifierImport([], journal(3))).toEqual({ mode: 'nouvelle' });
  });

  it('CA-3 : la copie locale est le début du fichier, les événements manquants sont ajoutés', () => {
    expect(planifierImport(journal(2), journal(4))).toEqual({ mode: 'prolonge', ajouts: [evenement(3), evenement(4)] });
  });

  it('un fichier identique ou plus court n’apporte rien', () => {
    expect(planifierImport(journal(3), journal(3))).toEqual({ mode: 'a-jour' });
    expect(planifierImport(journal(4), journal(2))).toEqual({ mode: 'a-jour' });
  });

  it('cas limite : au même seq, des événements différents sont refusés', () => {
    const autre = [evenement(1), evenement(2, false), evenement(3)];
    expect(planifierImport(journal(2), autre)).toEqual({ mode: 'divergent' });
    expect(planifierImport(autre, journal(2))).toEqual({ mode: 'divergent' });
  });
});

describe('renumeroterEpreuve', () => {
  it('donne un nouvel identifiant à chaque événement, sans toucher au reste ni à l’original', () => {
    const original = journal(2);
    const copie = renumeroterEpreuve(original, 'e2');
    expect(copie.map(({ epreuveId }) => epreuveId)).toEqual(['e2', 'e2']);
    expect(copie[1]).toEqual({ ...original[1], epreuveId: 'e2' });
    expect(original[0]!.epreuveId).toBe('e1');
  });
});

describe('reconcilier', () => {
  it('CA-5 : le serveur n’a pas avancé, les événements locaux seront envoyés', () => {
    expect(reconcilier(journal(5), journal(3))).toEqual({ resultat: 'prolonge', confirme: 3 });
    expect(reconcilier(journal(3), journal(3))).toEqual({ resultat: 'prolonge', confirme: 3 });
    expect(reconcilier(journal(3), [])).toEqual({ resultat: 'prolonge', confirme: 0 });
  });

  it('CA-6 : le serveur a continué ailleurs, les événements locaux qu’il n’a pas sont mis de côté', () => {
    const serveur = [evenement(1), evenement(2), evenement(3, false)];
    expect(reconcilier(journal(5), serveur)).toEqual({
      resultat: 'diverge',
      ecartes: [evenement(3), evenement(4), evenement(5)],
    });
  });

  it('CA-6 : le serveur a plus d’événements que l’appareil, rien n’est écarté mais le journal du serveur est repris', () => {
    expect(reconcilier(journal(2), [...journal(2), evenement(3, false)])).toEqual({ resultat: 'diverge', ecartes: [] });
  });
});
