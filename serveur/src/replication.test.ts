import { describe, expect, it } from 'vitest';
import type { Evenement } from '@poule-position/domaine';
import type { DemandeEnvoi, ResumeCompetition } from '@poule-position/protocole';
import { deciderAjout, ligneIndex } from './replication';

const RESUME: ResumeCompetition = {
  nom: 'Orpi',
  arme: 'sabre',
  categorie: 'M13',
  sexe: null,
  date: '2027-03-14',
  statut: 'preparation',
  publiee: false,
  rattachement: null,
};

const evenement = (seq: number, champs: Partial<Extract<Evenement, { type: 'CompetitionCreee' }>> = {}): Evenement => ({
  competitionId: 'c1',
  clubId: 'pessac',
  seq,
  version: 1,
  date: 1_800_000_000_000 + seq,
  auteur: 'orga@club.fr',
  source: 'clavier',
  type: 'CompetitionCreee',
  donnees: {
    nom: 'Orpi',
    arme: 'sabre',
    typeCompetition: 'individuelle',
    categorie: 'M13',
    sexe: null,
    date: '2027-03-14',
    horaires: { appel: null, scratch: null, debutPoules: null },
    lieu: null,
    commentaire: null,
    rattachement: null,
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
const lieu = { clubId: 'pessac', competitionId: 'c1' };

describe('ajout d’un lot au journal du serveur (ADR-0016)', () => {
  it('US-022 CA-1 : accepte le premier lot d’une compétition, qui fixe son pilote', () => {
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

  it('US-022 CA-5 : refuse un événement d’un autre club ou d’une autre compétition', () => {
    const refus = { ok: false, statut: 403, erreur: 'ACCES_REFUSE' };
    expect(deciderAjout(vide, demande(0, [evenement(1, { clubId: 'autre' })]), lieu)).toEqual(refus);
    expect(deciderAjout(vide, demande(0, [evenement(1, { competitionId: 'c2' })]), lieu)).toEqual(refus);
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

describe('index des compétitions du club', () => {
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
