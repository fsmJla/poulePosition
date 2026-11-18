import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { poulesDe } from '@poule-position/domaine';
import { ouvrirJournal } from './journal';
import { inscrireTireur, pointerTireur } from './inscriptions';
import { annulerRetrait, composerPoules, lancerPoules, retirerDesPoules, saisirScore } from './poules';

const contexte = { clubId: 'pessac', auteur: 'orga@club.fr' };

/** Un journal neuf, avec une épreuve pilotée ici et trois présents. */
async function epreuve() {
  const journal = ouvrirJournal(`test-${crypto.randomUUID()}`, async () => true);
  const epreuveId = crypto.randomUUID();
  await journal.enregistrer(
    epreuveId,
    {
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
        rattachement: { competitionId: 'comp' },
      },
    },
    contexte,
  );
  for (const id of ['a', 'b', 'c']) {
    await inscrireTireur(journal, epreuveId, { nom: id, prenom: 'P', club: '' }, contexte, id);
    await pointerTireur(journal, epreuveId, id, true, contexte, '08:00');
  }
  return { journal, epreuveId };
}

describe('écrire les poules dans le journal local (US-086 à US-089)', () => {
  it('composer, lancer, saisir un score, retirer puis annuler le retrait', async () => {
    const { journal, epreuveId } = await epreuve();
    const poules = [{ numero: 1, piste: 1, tireurIds: ['a', 'b', 'c'] }];
    expect(await composerPoules(journal, epreuveId, poules, contexte)).toEqual({ ok: true });
    expect(await lancerPoules(journal, epreuveId, contexte)).toEqual({ ok: true });
    const score = { poule: 1, tireurA: 'a', tireurB: 'b', touchesA: 4, touchesB: 3 };
    expect(await saisirScore(journal, epreuveId, { ...score, auTemps: true }, contexte)).toEqual({ ok: true });
    expect(await saisirScore(journal, epreuveId, { ...score, touchesA: 5, auTemps: false }, contexte)).toEqual({
      ok: true,
    });
    expect(await retirerDesPoules(journal, epreuveId, 'c', 'abandon', contexte)).toEqual({ ok: true });
    let etat = poulesDe((await journal.lire(epreuveId)).epreuve!);
    expect(etat).toMatchObject({ lancees: true, retraits: [{ tireurId: 'c', motif: 'abandon' }] });
    expect(etat.scores).toEqual([{ ...score, touchesA: 5, auTemps: false }]);
    expect(await annulerRetrait(journal, epreuveId, 'c', contexte)).toEqual({ ok: true });
    etat = poulesDe((await journal.lire(epreuveId)).epreuve!);
    expect(etat.retraits).toEqual([]);
  });

  it('refus du domaine : score invalide, lancement en double', async () => {
    const { journal, epreuveId } = await epreuve();
    expect(await lancerPoules(journal, epreuveId, contexte)).toEqual({ ok: false, erreur: 'POULES_INCOMPLETES' });
    await composerPoules(journal, epreuveId, [{ numero: 1, piste: 1, tireurIds: ['a', 'b', 'c'] }], contexte);
    await lancerPoules(journal, epreuveId, contexte);
    expect(
      await saisirScore(
        journal,
        epreuveId,
        { poule: 1, tireurA: 'a', tireurB: 'b', touchesA: 5, touchesB: 5 },
        contexte,
      ),
    ).toEqual({ ok: false, erreur: 'SCORE_INVALIDE' });
  });
});
