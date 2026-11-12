import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  creerEpreuve,
  saisieVide,
  type CompetitionConnue,
  type ManifestationConnue,
  type SaisieEpreuve,
} from './epreuves';
import { ouvrirJournal } from './journal';
import { rattacherEpreuves } from './rattachement-lot';

const auteur = { clubId: 'pessac', auteur: 'orga@club.fr', maintenant: () => 1_800_000_000_000 };
const nouveauJournal = () => ouvrirJournal(`test-${crypto.randomUUID()}`, async () => true);

const manifestations: ManifestationConnue[] = [{ id: 'm1', debut: '2027-03-14', fin: '2027-03-15', lieu: 'Salle A' }];
const competitions: CompetitionConnue[] = [
  { id: 'seule', manifestationId: null, arme: null },
  { id: 'sabre', manifestationId: 'm1', arme: 'sabre' },
  { id: 'epee', manifestationId: 'm1', arme: 'epee' },
  { id: 'libre', manifestationId: null, arme: null },
];

const saisie = (champs: Partial<SaisieEpreuve> = {}): SaisieEpreuve => ({
  ...saisieVide(),
  nom: 'M13 Dames',
  arme: 'sabre',
  competitionId: 'seule',
  ...champs,
});

/** Crée une épreuve dans la compétition seule « seule », dont ce journal est le pilote. */
async function creer(journal: Awaited<ReturnType<typeof nouveauJournal>>, champs: Partial<SaisieEpreuve> = {}) {
  const resultat = await creerEpreuve(journal, saisie(champs), auteur, [], competitions);
  if (!resultat.ok) throw new Error(`création impossible : ${JSON.stringify(resultat)}`);
  return resultat.epreuveId;
}

const rattachement = async (journal: Awaited<ReturnType<typeof nouveauJournal>>, id: string) =>
  (await journal.lire(id)).epreuve?.rattachement.competitionId;

describe('rattacherEpreuves (US-060)', () => {
  it('US-060 CA-3 : une épreuve est rattachée à la compétition choisie', async () => {
    const journal = await nouveauJournal();
    const id = await creer(journal);
    const compte = await rattacherEpreuves(journal, [id], 'libre', auteur, manifestations, competitions);
    expect(compte).toEqual({ rattachees: [id], restantes: [] });
    expect(await rattachement(journal, id)).toBe('libre');
    expect((await journal.aEnvoyer(id)).at(-1)).toMatchObject({
      type: 'EpreuveModifiee',
      donnees: { rattachement: { competitionId: 'libre' } },
    });
  });

  it('US-060 CA-4 : plusieurs épreuves sont toutes rattachées à la même compétition', async () => {
    const journal = await nouveauJournal();
    const ids = [await creer(journal, { nom: 'M13 Dames' }), await creer(journal, { nom: 'M13 Hommes' })];
    const compte = await rattacherEpreuves(journal, ids, 'libre', auteur, manifestations, competitions);
    expect(compte.rattachees).toEqual(ids);
    expect(compte.restantes).toEqual([]);
    for (const id of ids) expect(await rattachement(journal, id)).toBe('libre');
  });

  it('US-060 CA-4 : la date est gardée quand elle tombe dans la manifestation de la compétition', async () => {
    const journal = await nouveauJournal();
    const id = await creer(journal, { date: '2027-03-15' });
    const compte = await rattacherEpreuves(journal, [id], 'sabre', auteur, manifestations, competitions);
    expect(compte.rattachees).toEqual([id]);
    expect((await journal.lire(id)).epreuve).toMatchObject({ date: '2027-03-15' });
    expect(await rattachement(journal, id)).toBe('sabre');
  });

  it('US-060 cas limite : une date hors de la manifestation n’est pas rattachée, et le motif est donné', async () => {
    const journal = await nouveauJournal();
    const id = await creer(journal, { date: '2027-05-01' });
    const compte = await rattacherEpreuves(journal, [id], 'sabre', auteur, manifestations, competitions);
    expect(compte).toEqual({ rattachees: [], restantes: [{ id, raison: 'DATE_HORS_MANIFESTATION' }] });
    expect(await rattachement(journal, id)).toBe('seule');
  });

  it('US-060 cas limite : une épreuve sans date n’entre pas dans une manifestation (date obligatoire)', async () => {
    const journal = await nouveauJournal();
    const id = await creer(journal);
    const compte = await rattacherEpreuves(journal, [id], 'sabre', auteur, manifestations, competitions);
    expect(compte.restantes).toEqual([{ id, raison: 'DATE_OBLIGATOIRE' }]);
  });

  it('US-060 cas limite : une arme différente de celle de la compétition n’est pas rattachée', async () => {
    const journal = await nouveauJournal();
    const id = await creer(journal, { date: '2027-03-14' });
    const compte = await rattacherEpreuves(journal, [id], 'epee', auteur, manifestations, competitions);
    expect(compte.restantes).toEqual([{ id, raison: 'ARME_DIFFERENTE_COMPETITION' }]);
  });

  it('US-060 cas limite : une compétition inconnue de l’appareil n’est pas rattachée', async () => {
    const journal = await nouveauJournal();
    const id = await creer(journal);
    const compte = await rattacherEpreuves(journal, [id], 'fantome', auteur, manifestations, competitions);
    expect(compte.restantes).toEqual([{ id, raison: 'RATTACHEMENT_INVALIDE' }]);
  });

  it('US-060 cas limite : une épreuve pilotée par un autre PC ou inconnue de cet appareil est signalée, les autres sont rattachées', async () => {
    const pilote = await nouveauJournal();
    const ici = await creer(pilote);
    const ailleurs = await creer(pilote, { nom: 'M13 Hommes' });
    const copie = await nouveauJournal();
    await copie.remplacerCopie(ailleurs, await pilote.aEnvoyer(ailleurs), 1);
    await copie.remplacerCopie(ici, await pilote.aEnvoyer(ici), 1);
    // Sur ce PC, aucune des deux n'est pilotée ; une troisième est inconnue.
    const compte = await rattacherEpreuves(
      copie,
      [ici, ailleurs, 'inconnue'],
      'libre',
      auteur,
      manifestations,
      competitions,
    );
    expect(compte.rattachees).toEqual([]);
    expect(compte.restantes).toEqual([
      { id: ici, raison: 'PAS_PILOTE' },
      { id: ailleurs, raison: 'PAS_PILOTE' },
      { id: 'inconnue', raison: 'INTROUVABLE' },
    ]);
  });

  it('US-060 CA-4 : un échec n’empêche pas de rattacher les suivantes ; le compte rendu liste chaque cas', async () => {
    const journal = await nouveauJournal();
    const bonne = await creer(journal, { nom: 'M13 Dames' });
    const mauvaise = await creer(journal, { nom: 'M13 Hommes', date: '2027-05-01' });
    const compte = await rattacherEpreuves(journal, [mauvaise, bonne], 'sabre', auteur, manifestations, competitions);
    expect(compte.rattachees).toEqual([]);
    expect(compte.restantes.map(({ id }) => id)).toEqual([mauvaise, bonne]);
    const libre = await rattacherEpreuves(journal, [mauvaise, bonne], 'libre', auteur, manifestations, competitions);
    expect(libre.rattachees).toEqual([mauvaise, bonne]);
  });

  it('US-060 : sans épreuve à rattacher, le compte rendu est vide', async () => {
    const journal = await nouveauJournal();
    expect(await rattacherEpreuves(journal, [], 'libre', auteur, manifestations, competitions)).toEqual({
      rattachees: [],
      restantes: [],
    });
  });
});
