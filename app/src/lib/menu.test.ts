import { describe, expect, it } from 'vitest';
import { entreeVisee } from './menu';

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
