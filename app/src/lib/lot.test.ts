import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { formuleParDefaut, type EpreuveDuLot } from '@poule-position/domaine';
import { ouvrirJournal } from './journal';
import { creerLot } from './lot';

const nouveauJournal = () => ouvrirJournal(`test-${crypto.randomUUID()}`, async () => true);
const auteur = { clubId: 'pessac', auteur: 'orga@club.fr', maintenant: () => 1_800_000_000_000 };

const epreuve = (cle: string, nom: string, champs: Partial<EpreuveDuLot['donnees']> = {}): EpreuveDuLot => ({
  cle,
  donnees: {
    nom,
    arme: 'sabre',
    typeEpreuve: 'individuelle',
    categorie: 'M13',
    sexe: 'hommes',
    date: '2027-03-13',
    horaires: { appel: '08:30', scratch: null, debutPoules: null },
    lieu: 'Salle Bellegrave',
    commentaire: null,
    rattachement: { competitionId: 'c1' },
    ...champs,
  },
});

describe('création du lot (US-048 CA-5)', () => {
  it('CA-5 : crée un journal par épreuve, ce PC en est le pilote, avec les données du lot', async () => {
    const journal = nouveauJournal();
    const compteRendu = await creerLot(journal, [epreuve('a', 'M13 Hommes'), epreuve('b', 'M15 Dames')], null, auteur);
    expect(compteRendu.creees.map(({ cle }) => cle)).toEqual(['a', 'b']);
    expect(compteRendu.manquantes).toEqual([]);
    const locales = await journal.epreuvesLocales();
    expect(locales).toHaveLength(2);
    expect(locales.every(({ pilote }) => pilote)).toBe(true);
    const { epreuve: creee } = await journal.lire(compteRendu.creees[0]!.epreuveId);
    expect(creee).toMatchObject({
      nom: 'M13 Hommes',
      arme: 'sabre',
      categorie: 'M13',
      sexe: 'hommes',
      date: '2027-03-13',
      horaires: { appel: '08:30' },
      rattachement: { competitionId: 'c1' },
    });
  });

  it('CA-4 : la formule du lot s’applique à chaque épreuve, sans événement quand elle est celle par défaut', async () => {
    const journal = nouveauJournal();
    const formule = { ...formuleParDefaut('individuelle'), touchesPoules: 4, matchTroisieme: true };
    const avec = await creerLot(journal, [epreuve('a', 'A'), epreuve('b', 'B')], formule, auteur);
    for (const { epreuveId } of avec.creees) {
      const { epreuve: lue } = await journal.lire(epreuveId);
      expect(lue?.formule).toMatchObject({ touchesPoules: 4, matchTroisieme: true });
    }
    const sans = await creerLot(journal, [epreuve('c', 'C')], formuleParDefaut('individuelle'), auteur);
    const evenements = await journal.evenements(sans.creees[0]!.epreuveId);
    expect(evenements.map(({ type }) => type)).toEqual(['EpreuveCreee']);
  });

  it('cas limite : sans club connu, rien n’est créé et tout reste à créer', async () => {
    const journal = nouveauJournal();
    const compteRendu = await creerLot(journal, [epreuve('a', 'A')], null, { ...auteur, clubId: undefined });
    expect(compteRendu).toEqual({ creees: [], manquantes: ['a'], sansFormule: [] });
    expect(await journal.epreuvesLocales()).toEqual([]);
  });

  it('cas limite : un échec d’écriture au milieu du lot garde les épreuves créées et signale les manquantes', async () => {
    const journal = nouveauJournal();
    const reel = journal.enregistrer.bind(journal);
    let appels = 0;
    vi.spyOn(journal, 'enregistrer').mockImplementation(async (...args) => {
      appels += 1;
      return appels === 2 ? { erreur: 'ECRITURE_IMPOSSIBLE' } : reel(...args);
    });
    const compteRendu = await creerLot(
      journal,
      [epreuve('a', 'A'), epreuve('b', 'B'), epreuve('c', 'C')],
      null,
      auteur,
    );
    expect(compteRendu.creees.map(({ cle }) => cle)).toEqual(['a', 'c']);
    expect(compteRendu.manquantes).toEqual(['b']);
    expect(await journal.epreuvesLocales()).toHaveLength(2);
  });

  it('cas limite : un lot vide ne crée rien', async () => {
    const compteRendu = await creerLot(nouveauJournal(), [], null, auteur);
    expect(compteRendu).toEqual({ creees: [], manquantes: [], sansFormule: [] });
  });
});
