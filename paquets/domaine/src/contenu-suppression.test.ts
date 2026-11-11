import { describe, expect, it } from 'vitest';
import type { DonneesListe, EpreuveListee } from './liste';
import { contenuASupprimer, contenusASupprimer, disponibiliteSuppression } from './selection-suppression';

const epreuve = (
  id: string,
  competitionId: string,
  statut: EpreuveListee['statut'] = 'preparation',
): EpreuveListee => ({
  id,
  nom: `Épreuve ${id}`,
  arme: 'sabre',
  categorie: null,
  sexe: null,
  date: null,
  statut,
  publiee: false,
  rattachement: { competitionId },
  pilote: true,
  nonEnvoyee: false,
});
const manifestation = (id: string) => ({
  id,
  nom: `Manifestation ${id}`,
  debut: '2027-03-14',
  fin: '2027-03-15',
  lieu: null,
});
const competition = (id: string, manifestationId: string | null) => ({
  id,
  manifestationId,
  nom: `Compétition ${id}`,
  arme: null,
});

/** M1 : c1 (e1, e2 archivée) et c2 (e3). M2 : vide. M3 : c3 vide. M4 : c4 avec une épreuve en cours. c5 seule (e6). */
const donnees: DonneesListe = {
  manifestations: [manifestation('M1'), manifestation('M2'), manifestation('M3'), manifestation('M4')],
  competitions: [
    competition('c1', 'M1'),
    competition('c2', 'M1'),
    competition('c3', 'M3'),
    competition('c4', 'M4'),
    competition('c5', null),
  ],
  epreuves: [
    epreuve('e1', 'c1'),
    epreuve('e2', 'c1', 'archivee'),
    epreuve('e3', 'c2'),
    epreuve('e5', 'c4', 'enCours'),
    epreuve('e6', 'c5'),
  ],
  horsLigne: false,
  copieLe: null,
} as DonneesListe;

describe('contenu à supprimer (US-057 CA-2 et CA-3)', () => {
  it('CA-3 : une manifestation annonce ses compétitions et ses épreuves, archivées comprises, avec leurs noms', () => {
    const contenu = contenuASupprimer(donnees, 'M1');
    expect(contenu).toMatchObject({
      type: 'manifestation',
      nom: 'Manifestation M1',
      competitions: 2,
      epreuves: 3,
      vide: false,
    });
    expect(contenu?.nomsEpreuves).toEqual(['Épreuve e1', 'Épreuve e2', 'Épreuve e3']);
  });

  it('CA-3 : une compétition annonce ses épreuves', () => {
    expect(contenuASupprimer(donnees, 'c1')).toMatchObject({
      type: 'competition',
      competitions: 0,
      epreuves: 2,
      vide: false,
    });
  });

  it('CA-2 : une manifestation sans compétition, ou une compétition sans épreuve, est vide', () => {
    expect(contenuASupprimer(donnees, 'M2')).toMatchObject({ vide: true, competitions: 0, epreuves: 0 });
    expect(contenuASupprimer(donnees, 'c3')).toMatchObject({ vide: true });
  });

  it('CA-2 : une manifestation dont la seule compétition est vide n’est pas vide (elle emporte la compétition)', () => {
    expect(contenuASupprimer(donnees, 'M3')).toMatchObject({ vide: false, competitions: 1, epreuves: 0 });
  });

  it('une épreuve n’a pas de contenu : elle n’est jamais « vide »', () => {
    expect(contenuASupprimer(donnees, 'e1')).toMatchObject({
      type: 'epreuve',
      nom: 'Épreuve e1',
      vide: false,
      epreuves: 0,
    });
  });

  it('CA-5 : une épreuve en cours, ou un parent qui en contient une, est signalé', () => {
    expect(contenuASupprimer(donnees, 'e5')?.enCours).toBe(true);
    expect(contenuASupprimer(donnees, 'c4')?.enCours).toBe(true);
    expect(contenuASupprimer(donnees, 'M4')?.enCours).toBe(true);
    expect(contenuASupprimer(donnees, 'M1')?.enCours).toBe(false);
  });

  it('un identifiant inconnu ne donne rien', () => {
    expect(contenuASupprimer(donnees, 'inconnu')).toBeNull();
  });
});

it('le contenu de tous les éléments se calcule d’un coup, comme un par un', () => {
  const tous = contenusASupprimer(donnees);
  expect(tous.size).toBe(4 + 5 + 5);
  for (const id of ['M1', 'M2', 'c1', 'c4', 'e1', 'e5']) expect(tous.get(id)).toEqual(contenuASupprimer(donnees, id));
});

describe('disponibilité de « Supprimer… » (US-057 CA-5)', () => {
  const vide = contenuASupprimer(donnees, 'M2')!;
  const plein = contenuASupprimer(donnees, 'M1')!;
  const enCours = contenuASupprimer(donnees, 'M4')!;
  const uneEpreuve = contenuASupprimer(donnees, 'e1')!;

  it('CA-5 : l’administrateur en ligne peut supprimer', () => {
    expect(disponibiliteSuppression({ role: 'administrateur', enLigne: true, contenu: plein })).toEqual({
      etat: 'disponible',
    });
    expect(disponibiliteSuppression({ role: 'administrateur', enLigne: true, contenu: uneEpreuve })).toEqual({
      etat: 'disponible',
    });
  });

  it('CA-5 : un organisateur ne voit « Supprimer… » que pour un objet vide ; jamais pour un objet plein ni une épreuve', () => {
    expect(disponibiliteSuppression({ role: 'organisateur', enLigne: true, contenu: vide })).toEqual({
      etat: 'disponible',
    });
    expect(disponibiliteSuppression({ role: 'organisateur', enLigne: true, contenu: plein })).toEqual({
      etat: 'absent',
    });
    expect(disponibiliteSuppression({ role: 'organisateur', enLigne: true, contenu: uneEpreuve })).toEqual({
      etat: 'absent',
    });
  });

  it('CA-5 : hors ligne, l’action est grisée avec son motif', () => {
    expect(disponibiliteSuppression({ role: 'administrateur', enLigne: false, contenu: plein })).toEqual({
      etat: 'indisponible',
      motif: 'HORS_LIGNE',
    });
    expect(disponibiliteSuppression({ role: 'organisateur', enLigne: false, contenu: vide })).toEqual({
      etat: 'indisponible',
      motif: 'HORS_LIGNE',
    });
  });

  it('CA-5 : une épreuve en cours dans le contenu grise l’action avec son motif', () => {
    expect(disponibiliteSuppression({ role: 'administrateur', enLigne: true, contenu: enCours })).toEqual({
      etat: 'indisponible',
      motif: 'EN_COURS',
    });
  });

  it('CA-5 : le non-administrateur ne voit rien, même hors ligne', () => {
    expect(disponibiliteSuppression({ role: 'organisateur', enLigne: false, contenu: plein })).toEqual({
      etat: 'absent',
    });
  });
});
