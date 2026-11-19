import { describe, expect, it } from 'vitest';
import type { Evenement } from '@poule-position/domaine';
import type { DemandeEnvoi, ResumeEpreuve } from '@poule-position/protocole';
import {
  deciderAjout,
  deciderTicket,
  deciderPriseDeMain,
  deciderSuppression,
  DELAI_PRESENCE_MS,
  ligneIndex,
  piloteConnecte,
} from './replication';

const RESUME: ResumeEpreuve = {
  nom: 'Orpi',
  arme: 'sabre',
  categorie: 'M13',
  sexe: null,
  date: '2027-03-14',
  statut: 'preparation',
  horaires: { appel: null, scratch: null, debutPoules: null },
  lieu: null,
  publiee: false,
  rattachement: { competitionId: 'c-test' },
};

const evenement = (seq: number, champs: Partial<Extract<Evenement, { type: 'EpreuveCreee' }>> = {}): Evenement => ({
  epreuveId: 'c1',
  clubId: 'pessac',
  seq,
  version: 1,
  date: 1_800_000_000_000 + seq,
  auteur: 'orga@club.fr',
  source: 'clavier',
  type: 'EpreuveCreee',
  donnees: {
    nom: 'Orpi',
    arme: 'sabre',
    typeEpreuve: 'individuelle',
    categorie: 'M13',
    sexe: null,
    date: '2027-03-14',
    horaires: { appel: null, scratch: null, debutPoules: null },
    lieu: null,
    commentaire: null,
    rattachement: { competitionId: 'c-test' },
  },
  ...champs,
});

const demande = (depuis: number, evenements: Evenement[], appareilId = 'pc-a'): DemandeEnvoi => ({
  appareilId,
  depuis,
  evenements,
  resume: RESUME,
});

const vide = { dernierSeq: 0, piloteAppareil: null };
const lieu = { clubId: 'pessac', epreuveId: 'c1' };

describe('ajout d’un lot au journal du serveur (ADR-0016)', () => {
  it('US-022 CA-1 : accepte le premier lot d’une épreuve, qui fixe son pilote', () => {
    expect(deciderAjout(vide, demande(0, [evenement(1)]), lieu)).toEqual({ ok: true });
  });

  it('US-022 CA-1 : accepte un lot du pilote qui suit exactement le dernier seq', () => {
    expect(deciderAjout({ dernierSeq: 2, piloteAppareil: 'pc-a' }, demande(2, [evenement(3)]), lieu)).toEqual({
      ok: true,
    });
  });

  it('US-022 CA-1 : un lot décalé reçoit SEQ_INATTENDU avec le dernier seq du serveur', () => {
    const etat = { dernierSeq: 2, piloteAppareil: 'pc-a' };
    const attendu = { ok: false, statut: 409, erreur: 'SEQ_INATTENDU', dernierSeq: 2 };
    expect(deciderAjout(etat, demande(1, [evenement(2)]), lieu)).toEqual(attendu);
    expect(deciderAjout(etat, demande(4, [evenement(5)]), lieu)).toEqual(attendu);
    expect(deciderAjout(vide, demande(1, [evenement(2)]), lieu)).toMatchObject({ erreur: 'SEQ_INATTENDU' });
  });

  it('US-022 CA-5 : refuse un événement d’un autre club ou d’une autre épreuve', () => {
    const refus = { ok: false, statut: 403, erreur: 'ACCES_REFUSE' };
    expect(deciderAjout(vide, demande(0, [evenement(1, { clubId: 'autre' })]), lieu)).toEqual(refus);
    expect(deciderAjout(vide, demande(0, [evenement(1, { epreuveId: 'c2' })]), lieu)).toEqual(refus);
  });

  it('US-022 CA-6 : refuse le lot d’un appareil qui n’est pas le pilote, même bien numéroté', () => {
    const etat = { dernierSeq: 1, piloteAppareil: 'pc-a' };
    expect(deciderAjout(etat, demande(1, [evenement(2)], 'pc-b'), lieu)).toEqual({
      ok: false,
      statut: 409,
      erreur: 'PAS_PILOTE',
    });
  });
});

describe('index des épreuves du club', () => {
  it('US-022 CA-3 : la ligne reprend le résumé du pilote, son appareil, son compte et le dernier événement', () => {
    expect(ligneIndex('c1', demande(0, [evenement(1), evenement(2)]), 'Orga')).toEqual({
      id: 'c1',
      ...RESUME,
      piloteAppareil: 'pc-a',
      piloteNom: 'Orga',
      dernierSeq: 2,
      modifieeLe: 1_800_000_000_002,
    });
  });
});

describe('prise de main et présence du pilote (US-029)', () => {
  const etat = { dernierSeq: 3, piloteAppareil: 'pc-a' };

  it('CA-1 : un autre appareil prend la main s’il vise le pilote en place', () => {
    expect(deciderPriseDeMain(etat, { appareilId: 'pc-b', piloteAttendu: 'pc-a' })).toEqual({
      ok: true,
      ancienAppareil: 'pc-a',
    });
  });

  it('cas limite : deux demandes simultanées, la seconde vise un pilote qui a changé (MAIN_DEJA_PRISE)', () => {
    const apres = { dernierSeq: 3, piloteAppareil: 'pc-b' };
    expect(deciderPriseDeMain(apres, { appareilId: 'pc-c', piloteAttendu: 'pc-a' })).toEqual({
      ok: false,
      statut: 409,
      erreur: 'MAIN_DEJA_PRISE',
      piloteAppareil: 'pc-b',
    });
  });

  it('CA-1 : une épreuve sans journal ne peut pas être reprise', () => {
    expect(
      deciderPriseDeMain({ dernierSeq: 0, piloteAppareil: null }, { appareilId: 'pc-b', piloteAttendu: 'pc-a' }),
    ).toEqual({ ok: false, statut: 404, erreur: 'EPREUVE_INCONNUE' });
  });

  it('US-094 CA-1 : le pilote obtient un ticket, un ancien pilote reçoit PAS_PILOTE', () => {
    expect(deciderTicket(etat, 'pc-a')).toEqual({ ok: true });
    expect(deciderTicket(etat, 'pc-b')).toEqual({ ok: false, statut: 409, erreur: 'PAS_PILOTE' });
    expect(deciderTicket({ dernierSeq: 0, piloteAppareil: null }, 'pc-a')).toEqual({
      ok: false,
      statut: 404,
      erreur: 'EPREUVE_INCONNUE',
    });
  });

  it('US-094 CA-2 : le pilote est connecté tant qu’une socket a donné signe de vie depuis moins de 30 s', () => {
    const maintenant = 1_800_000_000_000;
    const ouverte = maintenant - 120_000;
    expect(DELAI_PRESENCE_MS).toBe(30_000);
    expect(piloteConnecte([{ ouverteLe: ouverte, dernierPing: maintenant - 1_000 }], maintenant)).toBe(true);
    expect(piloteConnecte([{ ouverteLe: ouverte, dernierPing: maintenant - DELAI_PRESENCE_MS + 1 }], maintenant)).toBe(
      true,
    );
    // Deux pings manqués : la socket encore ouverte ne compte plus.
    expect(piloteConnecte([{ ouverteLe: ouverte, dernierPing: maintenant - DELAI_PRESENCE_MS }], maintenant)).toBe(
      false,
    );
    // Socket qui vient de s'ouvrir, sans ping encore.
    expect(piloteConnecte([{ ouverteLe: maintenant - 5_000, dernierPing: null }], maintenant)).toBe(true);
    expect(piloteConnecte([{ ouverteLe: ouverte, dernierPing: null }], maintenant)).toBe(false);
    // Sans socket : absent.
    expect(piloteConnecte([], maintenant)).toBe(false);
  });
});

describe('décision de suppression définitive (US-039)', () => {
  it('US-039 CA-1 : une épreuve qui n’est pas en cours se supprime', () => {
    for (const statut of ['preparation', 'terminee', 'archivee'] as const) {
      expect(deciderSuppression(statut)).toEqual({ ok: true });
    }
  });

  it('US-039 CA-3 : une épreuve en cours ne se supprime pas', () => {
    expect(deciderSuppression('enCours')).toEqual({ ok: false, statut: 409, erreur: 'EPREUVE_EN_COURS' });
  });

  it('US-039 CA-7 : une épreuve inconnue de l’index se supprime sans effet', () => {
    expect(deciderSuppression(null)).toEqual({ ok: true });
  });
});
