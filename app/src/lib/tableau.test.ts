import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { structureTableau, matchDuTableau, tableauDe } from '@poule-position/domaine';
import { ouvrirJournal } from './journal';
import { inscrireTireur, pointerTireur } from './inscriptions';
import { composerPoules, lancerPoules, saisirScore } from './poules';
import { appelerMatch, creerTableau, retirerDuTableau, saisirScoreTableau, terminerEpreuve } from './tableau';

const contexte = { clubId: 'pessac', auteur: 'orga@club.fr' };

/** Un journal neuf, avec une épreuve pilotée ici et une poule de trois terminée (a, puis b, puis c). */
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
  await composerPoules(journal, epreuveId, [{ numero: 1, piste: 1, tireurIds: ['a', 'b', 'c'] }], contexte);
  await lancerPoules(journal, epreuveId, contexte);
  await saisirScore(journal, epreuveId, { poule: 1, tireurA: 'a', tireurB: 'b', touchesA: 5, touchesB: 1 }, contexte);
  await saisirScore(journal, epreuveId, { poule: 1, tireurA: 'b', tireurB: 'c', touchesA: 5, touchesB: 1 }, contexte);
  await saisirScore(journal, epreuveId, { poule: 1, tireurA: 'a', tireurB: 'c', touchesA: 5, touchesB: 1 }, contexte);
  return { journal, epreuveId };
}

describe('écrire le tableau dans le journal local (US-109 à US-115)', () => {
  it('US-109 CA-5 : créer le tableau, puis appeler, saisir, retirer, annuler et terminer', async () => {
    const { journal, epreuveId } = await epreuve();
    expect(await creerTableau(journal, epreuveId, ['a', 'b', 'c'], contexte)).toEqual({ ok: true });
    // Tableau de 4 : a exempt, b contre c (match 4-2), puis la finale.
    expect(await appelerMatch(journal, epreuveId, '4-2', 2, contexte)).toEqual({ ok: true });
    expect(await retirerDuTableau(journal, epreuveId, '4-2', { tireurId: 'c', motif: 'forfait' }, contexte)).toEqual({
      ok: true,
    });
    expect(await retirerDuTableau(journal, epreuveId, '4-2', null, contexte)).toEqual({ ok: true });
    const score = { match: '4-2', tireurA: 'b', tireurB: 'c', touchesA: 9, touchesB: 9 };
    expect(await saisirScoreTableau(journal, epreuveId, { ...score, parPriorite: 'c' }, contexte)).toEqual({
      ok: true,
    });
    expect(
      await saisirScoreTableau(
        journal,
        epreuveId,
        { match: '2-1', tireurA: 'a', tireurB: 'c', touchesA: 15, touchesB: 2 },
        contexte,
      ),
    ).toEqual({ ok: true });
    expect(await terminerEpreuve(journal, epreuveId, contexte)).toEqual({ ok: true });
    const epreuveLue = (await journal.lire(epreuveId)).epreuve!;
    expect(epreuveLue.statut).toBe('terminee');
    const tableau = structureTableau(tableauDe(epreuveLue), false)!;
    expect(matchDuTableau(tableau, '4-2')).toMatchObject({ vainqueur: 'c', parPriorite: true, piste: 2 });
  });

  it('refus du domaine : tableau en double, score sans priorité', async () => {
    const { journal, epreuveId } = await epreuve();
    await creerTableau(journal, epreuveId, ['a', 'b', 'c'], contexte);
    expect(await creerTableau(journal, epreuveId, ['a', 'b', 'c'], contexte)).toEqual({
      ok: false,
      erreur: 'TABLEAU_EXISTE',
    });
    expect(
      await saisirScoreTableau(
        journal,
        epreuveId,
        { match: '4-2', tireurA: 'b', tireurB: 'c', touchesA: 9, touchesB: 9 },
        contexte,
      ),
    ).toEqual({ ok: false, erreur: 'SCORE_INVALIDE' });
  });
});
