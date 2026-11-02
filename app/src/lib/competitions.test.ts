import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import { ouvrirJournal } from './journal';
import { creerCompetition, saisieVide, versDonnees, type SaisieCompetition } from './competitions';

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
