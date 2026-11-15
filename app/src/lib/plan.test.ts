import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import type { DonneesEpreuve } from '@poule-position/domaine';
import type { Competition, Manifestation } from '@poule-position/protocole';
import { ouvrirJournal } from './journal';
import { changerJour, detailsDesTuiles, horairesConnus, type DetailEpreuve } from './plan';

const nouveauJournal = () => ouvrirJournal(`test-${crypto.randomUUID()}`, async () => true);
const auteur = { clubId: 'pessac', auteur: 'orga@club.fr', maintenant: () => 1_800_000_000_000 };

const manifestation = {
  id: 'm1',
  clubId: 'pessac',
  nom: 'Week-end',
  debut: '2027-03-13',
  fin: '2027-03-14',
  lieu: 'Salle Bellegrave',
  commentaire: null,
  version: 1,
  modifieeLe: 0,
  modifieePar: 'orga@club.fr',
} as Manifestation;
const competition = {
  id: 'c1',
  clubId: 'pessac',
  manifestationId: 'm1',
  nom: 'Sabre',
  arme: 'sabre',
  commentaire: null,
  version: 1,
  modifieeLe: 0,
  modifieePar: 'orga@club.fr',
} as Competition;

const donnees = (champs: Partial<DonneesEpreuve> = {}): DonneesEpreuve => ({
  nom: 'M13 Hommes',
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
});

describe('plan de la manifestation (US-049)', () => {
  it('CA-4 : changer de jour n’écrit que la date, le reste de l’épreuve est inchangé', async () => {
    const journal = nouveauJournal();
    const epreuveId = crypto.randomUUID();
    await journal.enregistrer(epreuveId, { type: 'EpreuveCreee', donnees: donnees() }, auteur);
    const resultat = await changerJour(journal, epreuveId, '2027-03-14', auteur, [manifestation], [competition]);
    expect(resultat).toEqual({ ok: true, modifiee: true });
    const evenements = await journal.evenements(epreuveId);
    expect(evenements.at(-1)).toMatchObject({ type: 'EpreuveModifiee', donnees: { date: '2027-03-14' } });
    expect(Object.keys((evenements.at(-1) as { donnees: object }).donnees)).toEqual(['date']);
    const { epreuve } = await journal.lire(epreuveId);
    expect(epreuve).toMatchObject({ date: '2027-03-14', horaires: { appel: '08:30' }, lieu: 'Salle Bellegrave' });
  });

  it('CA-4 : dans une manifestation, le jour est obligatoire : on ne remet pas une épreuve « à fixer »', async () => {
    const journal = nouveauJournal();
    const epreuveId = crypto.randomUUID();
    await journal.enregistrer(epreuveId, { type: 'EpreuveCreee', donnees: donnees() }, auteur);
    const resultat = await changerJour(journal, epreuveId, null, auteur, [manifestation], [competition]);
    expect(resultat).toMatchObject({ ok: false, erreurs: { date: expect.any(String) } });
    expect((await journal.lire(epreuveId)).epreuve?.date).toBe('2027-03-13');
  });

  it('CA-4 : un jour hors de la manifestation est refusé', async () => {
    const journal = nouveauJournal();
    const epreuveId = crypto.randomUUID();
    await journal.enregistrer(epreuveId, { type: 'EpreuveCreee', donnees: donnees() }, auteur);
    const resultat = await changerJour(journal, epreuveId, '2030-01-01', auteur, [manifestation], [competition]);
    expect(resultat).toMatchObject({ ok: false, erreurs: { date: 'DATE_HORS_MANIFESTATION' } });
  });

  it('CA-4 : une épreuve inconnue de l’appareil ne change pas de jour', async () => {
    const resultat = await changerJour(
      nouveauJournal(),
      'absente',
      '2027-03-14',
      auteur,
      [manifestation],
      [competition],
    );
    expect(resultat).toEqual({ ok: false, erreur: 'INTROUVABLE' });
  });

  it('CA-1 : l’heure d’appel des tuiles vient du journal de l’appareil, sans rien pour une épreuve inconnue', async () => {
    const journal = nouveauJournal();
    const epreuveId = crypto.randomUUID();
    await journal.enregistrer(epreuveId, { type: 'EpreuveCreee', donnees: donnees() }, auteur);
    const details = await detailsDesTuiles(journal, [epreuveId, 'absente']);
    expect(details).toEqual({
      [epreuveId]: {
        appel: '08:30',
        scratch: null,
        debutPoules: null,
        lieu: 'Salle Bellegrave',
        typeEpreuve: 'individuelle',
        formuleModifiee: false,
      },
    });
  });

  it('US-050 CA-4 : le détail garde l’appel, le scratch et le début des poules de l’épreuve', async () => {
    const journal = nouveauJournal();
    const epreuveId = crypto.randomUUID();
    const horaires = { appel: '08:30', scratch: '09:00', debutPoules: '09:30' };
    await journal.enregistrer(epreuveId, { type: 'EpreuveCreee', donnees: donnees({ horaires }) }, auteur);
    const details = await detailsDesTuiles(journal, [epreuveId]);
    expect(details[epreuveId]).toMatchObject(horaires);
  });
});

describe('horaires du panneau (US-050 CA-4)', () => {
  const detail = (horaires: Partial<Pick<DetailEpreuve, 'appel' | 'scratch' | 'debutPoules'>>): DetailEpreuve => ({
    appel: null,
    scratch: null,
    debutPoules: null,
    lieu: null,
    typeEpreuve: 'individuelle',
    formuleModifiee: false,
    ...horaires,
  });

  it('US-050 CA-4 : les trois horaires renseignés, dans l’ordre appel, scratch, poules', () => {
    expect(horairesConnus(detail({ appel: '08:30', scratch: '09:00', debutPoules: '09:30' }))).toEqual([
      { champ: 'appel', heure: '08:30' },
      { champ: 'scratch', heure: '09:00' },
      { champ: 'debutPoules', heure: '09:30' },
    ]);
  });

  it('US-050 cas limite : les horaires non renseignés ne sont pas montrés', () => {
    expect(horairesConnus(detail({ appel: '08:30', debutPoules: '09:30' }))).toEqual([
      { champ: 'appel', heure: '08:30' },
      { champ: 'debutPoules', heure: '09:30' },
    ]);
    expect(horairesConnus(detail({}))).toEqual([]);
  });

  it('US-050 cas limite : une épreuve inconnue de l’appareil n’a aucun horaire', () => {
    expect(horairesConnus(undefined)).toEqual([]);
  });
});
