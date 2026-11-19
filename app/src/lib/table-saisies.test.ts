import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { poulesDe, type Proposition, type SaisieScore } from '@poule-position/domaine';
import { ouvrirJournal } from './journal';
import { traiterSaisie } from './table-saisies';

const contexte = { clubId: 'pessac', auteur: 'orga@club.fr' };
const creation: Proposition = {
  type: 'EpreuveCreee',
  donnees: {
    nom: 'M13 Dames',
    arme: 'sabre',
    typeEpreuve: 'individuelle',
    categorie: 'M13',
    sexe: 'dames',
    date: null,
    horaires: { appel: null, scratch: null, debutPoules: null },
    lieu: null,
    commentaire: null,
    rattachement: { competitionId: 'c' },
  },
};
const saisie: SaisieScore = {
  id: 's-1',
  poule: 1,
  tireurA: 'a',
  tireurB: 'b',
  touchesA: 5,
  touchesB: 2,
  auTemps: false,
  role: 'arbitre',
  nom: 'Dupont',
  appareilId: 't4',
};

async function epreuveLancee() {
  const journal = ouvrirJournal(`test-${crypto.randomUUID()}`, async () => true);
  await journal.enregistrer('e1', creation, contexte);
  for (const id of ['a', 'b', 'c']) {
    await journal.enregistrer(
      'e1',
      { type: 'TireurInscrit', donnees: { tireurId: id, nom: id, prenom: 'P', club: '' } },
      contexte,
    );
    await journal.enregistrer('e1', { type: 'PresenceModifiee', donnees: { tireurId: id, present: true } }, contexte);
  }
  await journal.enregistrer(
    'e1',
    { type: 'PoulesComposees', donnees: { poules: [{ numero: 1, piste: 1, tireurIds: ['a', 'b', 'c'] }] } },
    contexte,
  );
  await journal.enregistrer('e1', { type: 'PoulesLancees', donnees: {} }, contexte);
  return journal;
}

describe('la table traite une saisie (US-099)', () => {
  it('CA-5 : une saisie permise est écrite au journal, signée ; renvoyée, c’est un doublon (CA-7)', async () => {
    const journal = await epreuveLancee();
    expect(await traiterSaisie(journal, 'e1', saisie, contexte)).toEqual({ id: 's-1', decision: 'accepte' });
    const { epreuve } = await journal.lire('e1');
    expect(poulesDe(epreuve!).scores[0]).toMatchObject({
      touchesA: 5,
      saisie: { id: 's-1', par: 'arbitre Dupont (t4)' },
    });
    expect(await traiterSaisie(journal, 'e1', saisie, contexte)).toEqual({ id: 's-1', decision: 'doublon' });
  });

  it('CA-6 : une saisie non permise est refusée avec son motif ; une épreuve inconnue aussi', async () => {
    const journal = await epreuveLancee();
    await traiterSaisie(journal, 'e1', saisie, contexte);
    expect(await traiterSaisie(journal, 'e1', { ...saisie, id: 's-2' }, contexte)).toEqual({
      id: 's-2',
      decision: 'refuse',
      motif: 'MATCH_DEJA_SAISI',
    });
    expect(await traiterSaisie(journal, 'inconnue', saisie, contexte)).toMatchObject({ decision: 'refuse' });
  });
});
