import { describe, expect, it } from 'vitest';
import { entreeVisee, ordonnerActions } from './menu';

describe('navigation au clavier dans le menu de compte (US-017)', () => {
  it('US-017 CA-4 : ↓ passe à l’entrée suivante, en boucle', () => {
    expect(entreeVisee('ArrowDown', 0, 3)).toBe(1);
    expect(entreeVisee('ArrowDown', 2, 3)).toBe(0);
  });

  it('US-017 CA-4 : ↑ passe à l’entrée précédente, en boucle', () => {
    expect(entreeVisee('ArrowUp', 1, 3)).toBe(0);
    expect(entreeVisee('ArrowUp', 0, 3)).toBe(2);
  });

  it('US-017 CA-4 : sans entrée active, ↓ vise la première et ↑ la dernière', () => {
    expect(entreeVisee('ArrowDown', -1, 3)).toBe(0);
    expect(entreeVisee('ArrowUp', -1, 3)).toBe(2);
  });

  it('US-017 CA-4 : Début et Fin visent la première et la dernière entrée', () => {
    expect(entreeVisee('Home', 1, 3)).toBe(0);
    expect(entreeVisee('End', 0, 3)).toBe(2);
  });

  it('les autres touches, ou un menu vide, ne visent rien', () => {
    expect(entreeVisee('Enter', 1, 3)).toBeNull();
    expect(entreeVisee('ArrowDown', 0, 0)).toBeNull();
  });
});

describe('ordonnerActions (US-054 CA-6)', () => {
  const modifier = { libelle: 'Modifier' };
  const ajouter = { libelle: 'Ajouter' };
  const supprimer = { libelle: 'Supprimer…', destructive: true };
  const grisee = { libelle: 'Publier', indisponible: 'Hors ligne' };

  it('CA-6 : l’action destructrice est la dernière, sous un séparateur, même donnée en premier', () => {
    const { actions, separateurAvant } = ordonnerActions([supprimer, modifier, ajouter]);
    expect(actions.map((a) => a.libelle)).toEqual(['Modifier', 'Ajouter', 'Supprimer…']);
    expect(separateurAvant).toBe(2);
  });

  it('CA-6 : sans action destructrice, ou si elle est seule, il n’y a pas de séparateur', () => {
    expect(ordonnerActions([modifier, ajouter]).separateurAvant).toBe(-1);
    expect(ordonnerActions([supprimer]).separateurAvant).toBe(-1);
  });

  it('CA-6 : une action indisponible reste dans la liste, à sa place', () => {
    const { actions } = ordonnerActions([modifier, grisee, supprimer]);
    expect(actions.map((a) => a.libelle)).toEqual(['Modifier', 'Publier', 'Supprimer…']);
  });
});
