// Fichiers joints (US-030) : analyse des réponses du serveur.
import { describe, expect, it } from 'vitest';
import { analyserFichierJoint, analyserReponseFichier, analyserReponseFichiers, cheminFichier } from './fichiers';

const fichier = {
  proprietaire: 'competition',
  proprietaireId: 'c1',
  sorte: 'affiche',
  nom: `${'a'.repeat(64)}.webp`,
  type: 'webp',
  taille: 1234,
  ajouteLe: 1_700_000_000_000,
  ajoutePar: 'Organisatrice',
};

describe('cheminFichier', () => {
  it('compose le chemin d’un fichier, identifiant encodé', () => {
    expect(cheminFichier('epreuve', 'e1', 'feuilleDeRoute')).toBe('/fichiers/epreuve/e1/feuilleDeRoute');
    expect(cheminFichier('manifestation', 'a/b', 'affiche')).toBe('/fichiers/manifestation/a%2Fb/affiche');
  });
});

describe('analyserFichierJoint', () => {
  it('accepte une description complète', () => {
    expect(analyserFichierJoint(fichier)).toEqual(fichier);
  });

  it.each([
    ['un champ en trop', { ...fichier, secret: 1 }],
    ['un champ manquant', { ...fichier, ajoutePar: undefined }],
    ['un propriétaire inconnu', { ...fichier, proprietaire: 'club' }],
    ['une sorte inconnue', { ...fichier, sorte: 'logo' }],
    ['un type inconnu', { ...fichier, type: 'gif' }],
    ['un nom qui n’est pas une empreinte', { ...fichier, nom: '../secret.pdf' }],
    ['une taille non entière', { ...fichier, taille: 1.5 }],
    ['autre chose qu’un objet', 'texte'],
  ])('refuse %s', (_cas, brut) => {
    expect(analyserFichierJoint(brut)).toBeNull();
  });
});

describe('analyserReponseFichier', () => {
  it('renvoie le fichier décrit', () => {
    expect(analyserReponseFichier({ ok: true, fichier })).toEqual({ ok: true, fichier });
  });

  it('renvoie le refus avec sa raison', () => {
    expect(analyserReponseFichier({ ok: false, erreur: 'FICHIER_REFUSE', raison: 'TROP_GROS' })).toEqual({
      ok: false,
      erreur: 'FICHIER_REFUSE',
      raison: 'TROP_GROS',
    });
    expect(analyserReponseFichier({ ok: false, erreur: 'PROPRIETAIRE_INCONNU' })).toEqual({
      ok: false,
      erreur: 'PROPRIETAIRE_INCONNU',
    });
  });

  it('ignore une raison inconnue et refuse une réponse illisible', () => {
    expect(analyserReponseFichier({ ok: false, erreur: 'FICHIER_REFUSE', raison: 'AUTRE' })).toEqual({
      ok: false,
      erreur: 'FICHIER_REFUSE',
    });
    expect(analyserReponseFichier({ ok: true, fichier: { ...fichier, type: 'gif' } })).toEqual({
      ok: false,
      erreur: 'REPONSE_INVALIDE',
    });
    expect(analyserReponseFichier(null)).toEqual({ ok: false, erreur: 'REPONSE_INVALIDE' });
  });
});

describe('analyserReponseFichiers', () => {
  it('renvoie la liste des fichiers', () => {
    expect(analyserReponseFichiers({ ok: true, fichiers: [fichier] })).toEqual({ ok: true, fichiers: [fichier] });
    expect(analyserReponseFichiers({ ok: true, fichiers: [] })).toEqual({ ok: true, fichiers: [] });
  });

  it('refuse une liste dont une ligne est illisible, ou un refus du serveur', () => {
    expect(analyserReponseFichiers({ ok: true, fichiers: [fichier, { nom: 1 }] })).toEqual({
      ok: false,
      erreur: 'REPONSE_INVALIDE',
    });
    expect(analyserReponseFichiers({ ok: true })).toEqual({ ok: false, erreur: 'REPONSE_INVALIDE' });
    expect(analyserReponseFichiers({ ok: false, erreur: 'SESSION_INVALIDE' })).toEqual({
      ok: false,
      erreur: 'SESSION_INVALIDE',
    });
  });
});
