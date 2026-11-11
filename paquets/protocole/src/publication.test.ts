import { describe, expect, it } from 'vitest';
import { analyserFichierPublic } from './fichiers';
import { analyserEpreuvePublique, analyserReponseEpreuvePublique, analyserReponsePublique } from './publication';

const epreuve = (champs: Record<string, unknown> = {}) => ({
  id: 'e1',
  nom: 'Orpi',
  arme: 'sabre',
  categorie: 'M13',
  sexe: 'dames',
  date: '2027-03-14',
  horaires: { appel: '08:30', scratch: null, debutPoules: null },
  lieu: 'Salle Bellegrave',
  competitionId: 'c1',
  ...champs,
});
const fichier = {
  proprietaire: 'manifestation',
  proprietaireId: 'm1',
  sorte: 'affiche',
  nom: `${'a'.repeat(64)}.webp`,
  type: 'webp',
  taille: 1200,
  ajouteLe: 1,
};
const reponse = (champs: Record<string, unknown> = {}) => ({
  ok: true,
  manifestations: [{ id: 'm1', nom: 'Open', debut: '2027-03-14', fin: '2027-03-15', lieu: null }],
  competitions: [{ id: 'c1', manifestationId: 'm1', nom: 'Sabre', arme: 'sabre' }],
  epreuves: [epreuve()],
  fichiers: [fichier],
  ...champs,
});

describe('page publique (US-031, §16)', () => {
  it('CA-3 : lit la page publique : manifestations, compétitions, épreuves et fichiers', () => {
    expect(analyserReponsePublique(reponse())).toEqual(reponse());
  });

  it('CA-3 : accepte une compétition seule et une épreuve sans catégorie, sexe ni date', () => {
    const lue = analyserReponsePublique(
      reponse({
        competitions: [{ id: 'c1', manifestationId: null, nom: 'Seule', arme: null }],
        epreuves: [epreuve({ categorie: null, sexe: null, date: null, lieu: null })],
      }),
    );
    expect(lue).toMatchObject({ ok: true });
  });

  it('CA-5 : refuse une épreuve qui porte un champ en plus (donnée de tireur, de compte ou d’appareil)', () => {
    expect(analyserEpreuvePublique(epreuve({ piloteNom: 'Julien' }))).toBeNull();
    expect(analyserEpreuvePublique(epreuve({ tireurs: [] }))).toBeNull();
    expect(analyserReponsePublique(reponse({ epreuves: [epreuve({ piloteAppareil: 'a1' })] }))).toEqual({
      ok: false,
      erreur: 'REPONSE_INVALIDE',
    });
  });

  it('CA-5 : refuse un fichier qui porte le nom du compte, et ne laisse passer aucun champ en trop', () => {
    expect(analyserReponsePublique(reponse({ fichiers: [{ ...fichier, ajoutePar: 'Orga' }] }))).toEqual({
      ok: false,
      erreur: 'REPONSE_INVALIDE',
    });
    expect(analyserReponsePublique(reponse({ fichiers: [{ ...fichier, enTrop: 1 }] }))).toMatchObject({ ok: false });
    expect(analyserFichierPublic(null)).toBeNull();
    expect(analyserFichierPublic(fichier)).toEqual(fichier);
  });

  it('refuse une épreuve mal formée', () => {
    for (const champs of [
      { id: '' },
      { nom: '' },
      { arme: 'pistolet' },
      { sexe: 'x' },
      { horaires: null },
      { horaires: { appel: 3, scratch: null, debutPoules: null } },
      { lieu: 2 },
      { competitionId: '' },
    ]) {
      expect(analyserEpreuvePublique(epreuve(champs))).toBeNull();
    }
    expect(analyserEpreuvePublique(null)).toBeNull();
  });

  it('refuse une réponse dont une liste est absente ou illisible', () => {
    const invalide = { ok: false, erreur: 'REPONSE_INVALIDE' };
    expect(analyserReponsePublique(reponse({ manifestations: 'x' }))).toEqual(invalide);
    expect(analyserReponsePublique(reponse({ manifestations: [{ id: 'm1' }] }))).toEqual(invalide);
    expect(analyserReponsePublique(reponse({ competitions: [{ id: 'c1', nom: 'x' }] }))).toEqual(invalide);
    expect(
      analyserReponsePublique(reponse({ competitions: [{ id: 'c1', manifestationId: null, nom: 'x', arme: 'z' }] })),
    ).toEqual(invalide);
    expect(analyserReponsePublique(reponse({ fichiers: [{ nom: 'x' }] }))).toEqual(invalide);
    expect(analyserReponsePublique('n’importe quoi')).toEqual(invalide);
  });

  it('rend l’erreur connue d’un refus, REPONSE_INVALIDE sinon', () => {
    expect(analyserReponsePublique({ ok: false, erreur: 'SERVEUR_NON_CONFIGURE' })).toEqual({
      ok: false,
      erreur: 'SERVEUR_NON_CONFIGURE',
    });
    expect(analyserReponsePublique({ ok: false, erreur: 'inconnue' })).toEqual({
      ok: false,
      erreur: 'REPONSE_INVALIDE',
    });
  });

  it('CA-4 : lit l’épreuve publiée, ou EPREUVE_NON_PUBLIEE', () => {
    expect(analyserReponseEpreuvePublique({ ok: true, epreuve: epreuve() })).toEqual({ ok: true, epreuve: epreuve() });
    expect(analyserReponseEpreuvePublique({ ok: false, erreur: 'EPREUVE_NON_PUBLIEE' })).toEqual({
      ok: false,
      erreur: 'EPREUVE_NON_PUBLIEE',
    });
    expect(analyserReponseEpreuvePublique({ ok: true, epreuve: { id: 'e1' } })).toEqual({
      ok: false,
      erreur: 'REPONSE_INVALIDE',
    });
    expect(analyserReponseEpreuvePublique(null)).toEqual({ ok: false, erreur: 'REPONSE_INVALIDE' });
  });
});
