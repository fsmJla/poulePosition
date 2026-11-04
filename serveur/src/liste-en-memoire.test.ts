import { describe, expect, it, vi } from 'vitest';
import { ListeEnMemoire } from './liste-en-memoire';

/** Source simulée : compte ses lectures et le nombre de lignes qu'elle parcourt. */
function source(lignes: string[]) {
  const lire = vi.fn(() => ({ valeurs: [...lignes], lignesLues: lignes.length }));
  return { lire, lignes };
}

describe('liste gardée en mémoire (US-038)', () => {
  it('CA-1 : la base n’est lue qu’une fois pour plusieurs demandes sans écriture', () => {
    const { lire } = source(['a', 'b', 'c']);
    const liste = new ListeEnMemoire(lire);
    expect(liste.obtenir()).toEqual(['a', 'b', 'c']);
    expect(liste.obtenir()).toEqual(['a', 'b', 'c']);
    expect(liste.obtenir()).toEqual(['a', 'b', 'c']);
    expect(lire).toHaveBeenCalledTimes(1);
  });

  it('CA-2 : après une invalidation (écriture), la lecture suivante relit la base et voit le changement', () => {
    const { lire, lignes } = source(['a']);
    const liste = new ListeEnMemoire(lire);
    expect(liste.obtenir()).toEqual(['a']);
    lignes.push('b');
    liste.invalider();
    expect(liste.obtenir()).toEqual(['a', 'b']);
    expect(lire).toHaveBeenCalledTimes(2);
    liste.obtenir();
    expect(lire).toHaveBeenCalledTimes(2);
  });

  it('CA-2 : modifier met la liste gardée à jour sans relire la base', () => {
    const { lire } = source(['a', 'b']);
    const liste = new ListeEnMemoire(lire);
    liste.obtenir();
    liste.modifier((valeurs) => [...valeurs.filter((valeur) => valeur !== 'a'), 'c']);
    expect(liste.obtenir()).toEqual(['b', 'c']);
    expect(lire).toHaveBeenCalledTimes(1);
  });

  it('CA-2 : modifier une liste pas encore lue ne lit rien et ne la fige pas (la prochaine lecture lira la base)', () => {
    const { lire } = source(['a']);
    const liste = new ListeEnMemoire(lire);
    liste.modifier((valeurs) => [...valeurs, 'x']);
    expect(lire).not.toHaveBeenCalled();
    expect(liste.obtenir()).toEqual(['a']);
    expect(lire).toHaveBeenCalledTimes(1);
  });

  it('CA-2 : une lecture qui échoue ne laisse rien en mémoire, la suivante réessaie', () => {
    let echec = true;
    const lire = vi.fn(() => {
      if (echec) throw new Error('base indisponible');
      return { valeurs: ['a'], lignesLues: 1 };
    });
    const liste = new ListeEnMemoire(lire);
    expect(() => liste.obtenir()).toThrow('base indisponible');
    echec = false;
    expect(liste.obtenir()).toEqual(['a']);
    expect(lire).toHaveBeenCalledTimes(2);
  });

  it('CA-4 : chaque remplissage signale le nombre de lignes lues, et lui seul', () => {
    const { lire } = source(['a', 'b', 'c', 'd']);
    const signaler = vi.fn();
    const liste = new ListeEnMemoire(lire, signaler);
    liste.obtenir();
    liste.obtenir();
    expect(signaler).toHaveBeenCalledTimes(1);
    expect(signaler).toHaveBeenCalledWith(4);
    liste.invalider();
    liste.obtenir();
    expect(signaler).toHaveBeenCalledTimes(2);
  });
});
