import { describe, expect, it } from 'vitest';
import { lienOpenStreetMap, lieuAEcrire, lieuCommun, villeDeLieu } from './lieu-public';

describe('le lieu sur l’accueil public (US-079)', () => {
  it('CA-6 : la ville est le texte qui suit le code postal', () => {
    expect(villeDeLieu('Avenue Colonel Robert Jacqui 33600 Pessac')).toBe('Pessac');
    expect(villeDeLieu('12 rue des Lilas, 33000 Bordeaux')).toBe('Bordeaux');
    expect(villeDeLieu('Salle Bellegrave 33600   Pessac  ')).toBe('Pessac');
    expect(villeDeLieu('Place du Marché 64100 Bayonne Centre')).toBe('Bayonne Centre');
  });

  it('cas limite : un lieu libre sans code postal, ou aucun lieu, n’a pas de ville', () => {
    expect(villeDeLieu('Salle Bellegrave')).toBeNull();
    expect(villeDeLieu('Gymnase 3360 Pessac')).toBeNull();
    expect(villeDeLieu('Salle 33600')).toBeNull();
    expect(villeDeLieu(null)).toBeNull();
    expect(villeDeLieu(undefined)).toBeNull();
  });

  it('CA-5 et CA-9 : un lieu identique à celui du parent n’est pas répété ; un lieu différent l’est', () => {
    const parent = 'Avenue Colonel Robert Jacqui 33600 Pessac';
    expect(lieuAEcrire(parent, parent)).toBeNull();
    expect(lieuAEcrire('  avenue colonel  Robert Jacqui 33600 Pessac ', parent)).toBeNull();
    expect(lieuAEcrire('Salle Bellegrave 33600 Pessac', parent)).toBe('Salle Bellegrave 33600 Pessac');
    expect(lieuAEcrire('Salle Bellegrave', null)).toBe('Salle Bellegrave');
    expect(lieuAEcrire(null, parent)).toBeNull();
    expect(lieuAEcrire('   ', parent)).toBeNull();
  });

  it('cas limite : le lieu commun aux épreuves d’une compétition seule', () => {
    expect(lieuCommun(['Salle A', 'salle a', ' Salle A '])).toBe('Salle A');
    expect(lieuCommun(['Salle A', 'Salle B'])).toBeNull();
    expect(lieuCommun(['Salle A', null])).toBeNull();
    expect(lieuCommun([null])).toBeNull();
    expect(lieuCommun([])).toBeNull();
  });

  it('CA-10 : OpenStreetMap centré sur les coordonnées, sinon une recherche de l’adresse', () => {
    expect(lienOpenStreetMap('Pessac', { latitude: 44.8, longitude: -0.63 })).toBe(
      'https://www.openstreetmap.org/?mlat=44.8&mlon=-0.63#map=17/44.8/-0.63',
    );
    expect(lienOpenStreetMap(' Avenue Colonel Robert Jacqui 33600 Pessac ')).toBe(
      'https://www.openstreetmap.org/search?query=Avenue%20Colonel%20Robert%20Jacqui%2033600%20Pessac',
    );
  });
});
