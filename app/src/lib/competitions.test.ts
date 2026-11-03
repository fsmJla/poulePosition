import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { ouvrirJournal } from './journal';
import type { Epreuve, Manifestation } from '@poule-position/protocole';
import { cadreDe, creerCompetition, rattacher, saisieVide, versDonnees, type SaisieCompetition } from './competitions';

const saisie = (champs: Partial<SaisieCompetition> = {}): SaisieCompetition => ({
  ...saisieVide(),
  nom: 'Championnats NA sabre M13',
  arme: 'sabre',
  ...champs,
});

const nouveauJournal = () => ouvrirJournal(`test-${crypto.randomUUID()}`, async () => true);
const auteur = { clubId: 'pessac', auteur: 'orga@club.fr', maintenant: () => 1_800_000_000_000 };

describe('saisie d’une nouvelle compétition (US-025)', () => {
  it('CA-1 : le formulaire démarre vide, en individuelle, sans arme choisie', () => {
    expect(saisieVide()).toEqual({
      nom: '',
      arme: '',
      typeCompetition: 'individuelle',
      categorie: '',
      categorieLibre: '',
      sexe: '',
      date: '',
      appel: '',
      scratch: '',
      debutPoules: '',
      lieu: '',
      commentaire: '',
      manifestationId: '',
      epreuveId: '',
    });
  });

  it('CA-1 : un champ facultatif vide devient absent ; « Autre » prend la catégorie libre', () => {
    expect(versDonnees(saisie())).toEqual({
      nom: 'Championnats NA sabre M13',
      arme: 'sabre',
      typeCompetition: 'individuelle',
      categorie: null,
      sexe: null,
      date: null,
      horaires: { appel: null, scratch: null, debutPoules: null },
      lieu: null,
      commentaire: null,
      rattachement: null,
    });
    const complete = saisie({
      categorie: 'autre',
      categorieLibre: 'Challenge des petits',
      sexe: 'dames',
      date: '2027-03-14',
      appel: '08:30',
      scratch: '09:00',
      debutPoules: '09:30',
      lieu: 'Salle Bellegrave',
      commentaire: 'Buvette',
    });
    expect(versDonnees(complete)).toMatchObject({
      categorie: 'Challenge des petits',
      sexe: 'dames',
      date: '2027-03-14',
      horaires: { appel: '08:30', scratch: '09:00', debutPoules: '09:30' },
      lieu: 'Salle Bellegrave',
      commentaire: 'Buvette',
    });
    expect(versDonnees(saisie({ categorie: 'M13', categorieLibre: 'ignorée' })).categorie).toBe('M13');
  });

  it('CA-1 : l’arme est obligatoire', async () => {
    const resultat = await creerCompetition(nouveauJournal(), saisie({ arme: '' }), auteur);
    expect(resultat).toEqual({ ok: false, erreurs: { arme: 'ARME_INVALIDE' } });
  });

  it('CA-2 : la compétition est écrite dans le journal local, ce PC en devient le pilote', async () => {
    const journal = nouveauJournal();
    const resultat = await creerCompetition(journal, saisie(), auteur);
    expect(resultat).toEqual({ ok: true, competitionId: expect.stringMatching(/^[0-9a-f-]{36}$/) });
    const competitionId = (resultat as { competitionId: string }).competitionId;
    expect(await journal.lire(competitionId)).toMatchObject({
      competition: { nom: 'Championnats NA sabre M13', statut: 'preparation', publiee: false, clubId: 'pessac' },
    });
    expect(await journal.etat(competitionId)).toMatchObject({ pilote: true, confirme: 0 });
  });

  it('CA-5 : des horaires incohérents sont refusés sous le champ en cause, sans rien écrire', async () => {
    const journal = nouveauJournal();
    const resultat = await creerCompetition(journal, saisie({ appel: '09:00', scratch: '08:30' }), auteur);
    expect(resultat).toEqual({ ok: false, erreurs: { scratch: 'SCRATCH_AVANT_APPEL' } });
    expect(await journal.competitionsLocales()).toEqual([]);
  });

  it('cas limites : nom, commentaire et catégorie libre trop longs, chacun sous son champ', async () => {
    const trop = saisie({
      nom: 'x'.repeat(101),
      commentaire: 'x'.repeat(2001),
      categorie: 'autre',
      categorieLibre: 'x'.repeat(31),
    });
    expect(await creerCompetition(nouveauJournal(), trop, auteur)).toEqual({
      ok: false,
      erreurs: { nom: 'NOM_TROP_LONG', commentaire: 'COMMENTAIRE_TROP_LONG', categorie: 'CATEGORIE_TROP_LONGUE' },
    });
  });

  it('cas limite : sans club connu (session d’avant US-025), la création est refusée', async () => {
    const resultat = await creerCompetition(nouveauJournal(), saisie(), { ...auteur, clubId: undefined });
    expect(resultat).toEqual({ ok: false, erreur: 'CLUB_INCONNU' });
  });

  it('cas limite : un échec d’écriture d’IndexedDB est signalé (ECRITURE_IMPOSSIBLE)', async () => {
    const journal = nouveauJournal();
    vi.spyOn(journal, 'enregistrer').mockResolvedValue({ erreur: 'ECRITURE_IMPOSSIBLE' });
    expect(await creerCompetition(journal, saisie(), auteur)).toEqual({ ok: false, erreur: 'ECRITURE_IMPOSSIBLE' });
  });
});

const manifestation: Manifestation = {
  id: 'm1',
  nom: 'Week-end des Championnats NA',
  debut: '2027-03-14',
  fin: '2027-03-15',
  lieu: 'Salle Bellegrave',
  commentaire: null,
  version: 1,
  modifieeLe: 1,
  modifieePar: 'Orga',
};
const epreuve: Epreuve = {
  id: 'e1',
  manifestationId: 'm1',
  nom: 'Championnats NA de sabre',
  arme: 'sabre',
  commentaire: null,
  version: 1,
  modifieeLe: 1,
  modifieePar: 'Orga',
};

describe('rattachement d’une nouvelle compétition (US-025 CA-3 et CA-4, US-024 CA-4)', () => {
  it('CA-3 (US-025) : sans choix, la compétition est isolée', () => {
    expect(versDonnees(saisie()).rattachement).toBeNull();
    expect(cadreDe(saisie(), [manifestation], [epreuve])).toBeNull();
  });

  it('CA-3 (US-025) : une manifestation seule, ou une épreuve de la manifestation, se rattache', () => {
    expect(versDonnees(saisie({ manifestationId: 'm1' })).rattachement).toEqual({
      manifestationId: 'm1',
      epreuveId: null,
    });
    expect(versDonnees(saisie({ manifestationId: 'm1', epreuveId: 'e1' })).rattachement).toEqual({
      manifestationId: 'm1',
      epreuveId: 'e1',
    });
  });

  it('CA-3 (US-025) : le cadre donne les dates et le lieu de la manifestation et l’arme de l’épreuve', () => {
    expect(cadreDe(saisie({ manifestationId: 'm1' }), [manifestation], [epreuve])).toEqual({
      manifestation: { debut: '2027-03-14', fin: '2027-03-15', lieu: 'Salle Bellegrave' },
      epreuve: null,
    });
    expect(cadreDe(saisie({ manifestationId: 'm1', epreuveId: 'e1' }), [manifestation], [epreuve])).toEqual({
      manifestation: { debut: '2027-03-14', fin: '2027-03-15', lieu: 'Salle Bellegrave' },
      epreuve: { arme: 'sabre' },
    });
    expect(cadreDe(saisie({ manifestationId: 'inconnue' }), [manifestation], [epreuve])).toBeNull();
  });

  it('CA-3 (US-025) : choisir un rattachement préremplit le lieu et l’arme sans écraser une saisie', () => {
    const choisie = rattacher(saisieVide(), 'm1', 'e1', [manifestation], [epreuve]);
    expect(choisie).toMatchObject({ manifestationId: 'm1', epreuveId: 'e1', lieu: 'Salle Bellegrave', arme: 'sabre' });
    const saisie2 = { ...saisieVide(), lieu: 'Ailleurs', arme: 'epee' as const };
    expect(rattacher(saisie2, 'm1', '', [manifestation], [epreuve])).toMatchObject({ lieu: 'Ailleurs', arme: 'epee' });
    expect(rattacher(saisie2, 'm1', 'e1', [manifestation], [epreuve])).toMatchObject({ arme: 'sabre' });
  });

  it('CA-3 (US-025) : quitter le rattachement ou changer de manifestation retire l’épreuve et la date', () => {
    const rattachee = { ...saisieVide(), manifestationId: 'm1', epreuveId: 'e1', date: '2027-03-15' };
    expect(rattacher(rattachee, '', '', [manifestation], [epreuve])).toMatchObject({
      manifestationId: '',
      epreuveId: '',
      date: '',
    });
  });

  it('CA-4 (US-025) : la date doit être comprise entre les dates de la manifestation', async () => {
    const dans = await creerCompetition(
      nouveauJournal(),
      saisie({ manifestationId: 'm1', date: '2027-03-15' }),
      auteur,
      [manifestation],
      [epreuve],
    );
    expect(dans.ok).toBe(true);
    const hors = await creerCompetition(
      nouveauJournal(),
      saisie({ manifestationId: 'm1', date: '2027-03-20' }),
      auteur,
      [manifestation],
      [epreuve],
    );
    expect(hors).toEqual({ ok: false, erreurs: { date: 'DATE_HORS_MANIFESTATION' } });
    const sans = await creerCompetition(
      nouveauJournal(),
      saisie({ manifestationId: 'm1' }),
      auteur,
      [manifestation],
      [],
    );
    expect(sans).toEqual({ ok: false, erreurs: { date: 'DATE_OBLIGATOIRE' } });
  });

  it('CA-4 (US-024) : une arme différente de celle de l’épreuve est refusée', async () => {
    const resultat = await creerCompetition(
      nouveauJournal(),
      saisie({ manifestationId: 'm1', epreuveId: 'e1', arme: 'epee', date: '2027-03-15' }),
      auteur,
      [manifestation],
      [epreuve],
    );
    expect(resultat).toEqual({ ok: false, erreurs: { arme: 'ARME_DIFFERENTE_EPREUVE' } });
  });

  it('CA-4 (US-024) : une épreuve sans arme accepte toutes les armes', async () => {
    const libre = { ...epreuve, arme: null };
    const resultat = await creerCompetition(
      nouveauJournal(),
      saisie({ manifestationId: 'm1', epreuveId: 'e1', arme: 'epee', date: '2027-03-15' }),
      auteur,
      [manifestation],
      [libre],
    );
    expect(resultat.ok).toBe(true);
  });

  it('CA-3 (US-025) : une compétition rattachée garde son rattachement dans le journal', async () => {
    const journal = nouveauJournal();
    const resultat = await creerCompetition(
      journal,
      saisie({ manifestationId: 'm1', epreuveId: 'e1', date: '2027-03-14' }),
      auteur,
      [manifestation],
      [epreuve],
    );
    const competitionId = (resultat as { competitionId: string }).competitionId;
    expect(await journal.lire(competitionId)).toMatchObject({
      competition: { rattachement: { manifestationId: 'm1', epreuveId: 'e1' } },
    });
  });

  it('cas limite : une manifestation ou une épreuve inconnue de l’appareil est refusée (RATTACHEMENT_INVALIDE)', async () => {
    const resultat = await creerCompetition(
      nouveauJournal(),
      saisie({ manifestationId: 'inconnue', date: '2027-03-15' }),
      auteur,
      [manifestation],
      [epreuve],
    );
    expect(resultat).toEqual({ ok: false, erreurs: { rattachement: 'RATTACHEMENT_INVALIDE' } });
    const autre = await creerCompetition(
      nouveauJournal(),
      saisie({ manifestationId: 'm1', epreuveId: 'inconnue', date: '2027-03-15' }),
      auteur,
      [manifestation],
      [epreuve],
    );
    expect(autre).toEqual({ ok: false, erreurs: { rattachement: 'RATTACHEMENT_INVALIDE' } });
  });
});
