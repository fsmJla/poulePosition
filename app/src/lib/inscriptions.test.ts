import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { tireursDe } from '@poule-position/domaine';
import { ouvrirJournal } from './journal';
import { importerTireurs, inscrireTireur, modifierTireur, pointerTireur, retirerTireur } from './inscriptions';

const contexte = { clubId: 'pessac', auteur: 'orga@club.fr' };

/** Un journal neuf, avec une épreuve en préparation pilotée ici. */
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
  return { journal, epreuveId };
}

describe('écrire les inscriptions dans le journal local (US-082, US-084)', () => {
  it('US-082 CA-2, CA-6, CA-7 : inscrire, modifier puis retirer un tireur', async () => {
    const { journal, epreuveId } = await epreuve();
    expect(
      await inscrireTireur(
        journal,
        epreuveId,
        { nom: 'DUBOIS', prenom: 'Chloé', club: 'Pessac', classement: 5 },
        contexte,
        't1',
      ),
    ).toEqual({ ok: true });
    await inscrireTireur(
      journal,
      epreuveId,
      { nom: 'MARTIN', prenom: 'Léa', club: 'Talence', licence: ' ' },
      contexte,
      't2',
    );
    expect(tireursDe((await journal.lire(epreuveId)).epreuve!).map(({ id, licence }) => [id, licence])).toEqual([
      ['t1', null],
      ['t2', null],
    ]);

    expect(await modifierTireur(journal, epreuveId, { tireurId: 't1', club: 'Mérignac' }, contexte)).toEqual({
      ok: true,
    });
    expect(await retirerTireur(journal, epreuveId, 't2', contexte)).toEqual({ ok: true });
    const tireurs = tireursDe((await journal.lire(epreuveId)).epreuve!);
    expect(tireurs.map(({ id, club }) => [id, club])).toEqual([['t1', 'Mérignac']]);
  });

  it('US-084 CA-2 : pointer présent avec l’heure, puis absent', async () => {
    const { journal, epreuveId } = await epreuve();
    await inscrireTireur(journal, epreuveId, { nom: 'DUBOIS', prenom: 'Chloé', club: 'Pessac' }, contexte, 't1');
    expect(await pointerTireur(journal, epreuveId, 't1', true, contexte, '08:41')).toEqual({ ok: true });
    expect(tireursDe((await journal.lire(epreuveId)).epreuve!)[0]).toMatchObject({ present: true, heure: '08:41' });
    await pointerTireur(journal, epreuveId, 't1', false, contexte);
    expect(tireursDe((await journal.lire(epreuveId)).epreuve!)[0]).toMatchObject({ present: false, heure: null });
  });

  it('cas limites : nom vide refusé ; épreuve inconnue', async () => {
    const { journal, epreuveId } = await epreuve();
    expect(await inscrireTireur(journal, epreuveId, { nom: ' ', prenom: 'Chloé', club: '' }, contexte)).toEqual({
      ok: false,
      erreur: 'TIREUR_NOM_VIDE',
    });
    expect(await retirerTireur(journal, crypto.randomUUID(), 't1', contexte)).toEqual({
      ok: false,
      erreur: 'EPREUVE_INCONNUE',
    });
  });
});

describe('importer les tireurs du fichier de la Fédération (US-083)', () => {
  it('CA-3 : inscrit les nouveaux et les homonymes cochés, met à jour les déjà inscrits qui ont changé', async () => {
    const { journal, epreuveId } = await epreuve();
    await inscrireTireur(
      journal,
      epreuveId,
      { nom: 'DUBOIS', prenom: 'Chloé', club: 'Pessac', licence: '111' },
      contexte,
      't1',
    );
    await inscrireTireur(journal, epreuveId, { nom: 'MARTIN', prenom: 'Léa', club: 'Talence' }, contexte, 't2');
    const avant = tireursDe((await journal.lire(epreuveId)).epreuve!);
    const importe = (nom: string, prenom: string, licence: string | null = null) => ({
      nom,
      prenom,
      club: 'Bayonne',
      classement: 7,
      licence,
    });
    const rendu = await importerTireurs(
      journal,
      epreuveId,
      {
        nouveaux: [importe('PETIT', 'Louise', '333')],
        dejaInscrits: [{ inscrit: avant[0]!, importe: importe('DUBOIS', 'Chloé', '111'), changes: { classement: 7 } }],
        homonymes: [
          { inscrit: avant[1]!, importe: importe('MARTIN', 'Léa') },
          { inscrit: avant[1]!, importe: importe('MARTIN', 'Léa') },
        ],
      },
      new Set([0]),
      contexte,
    );
    expect(rendu).toEqual({ inscrits: 2, misAJour: 1, echecs: 0 });
    const apres = tireursDe((await journal.lire(epreuveId)).epreuve!);
    expect(apres).toHaveLength(4);
    expect(apres.find(({ id }) => id === 't1')?.classement).toBe(7);
    expect(apres.find(({ nom }) => nom === 'PETIT')?.licence).toBe('333');
  });
});
