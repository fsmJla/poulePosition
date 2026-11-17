import { describe, expect, it } from 'vitest';
import type { EpreuvePublication } from '@poule-position/domaine';
import type { Journal } from './journal';
import { actionsPublication, messagePublication, publierLot } from './publication-lot';

/** Un journal qui connaît des épreuves non publiées ; `refusees` répondent par une erreur d'écriture. */
function journalFactice(refusees: string[] = []) {
  const ecrites: string[] = [];
  const journal = {
    lire: async (id: string) => ({ epreuve: { id, clubId: 'club', publiee: false } }),
    enregistrer: async (id: string) => {
      if (refusees.includes(id)) return { erreur: 'ECRITURE_IMPOSSIBLE' };
      ecrites.push(id);
      return { projection: {} };
    },
  } as unknown as Journal;
  return { journal, ecrites };
}

const epr = (id: string, champs: Partial<EpreuvePublication> = {}): EpreuvePublication => ({
  id,
  statut: 'preparation',
  pilote: true,
  publiee: false,
  ...champs,
});
const contexte = { clubId: 'club', auteur: 'orga@club.fr' };

describe('publier toutes les épreuves d’une compétition (US-079)', () => {
  it('CA-3 : chaque épreuve pilotée ici est écrite puis envoyée ; les autres sont comptées à part', async () => {
    const { journal, ecrites } = journalFactice();
    const envoyees: string[] = [];
    const rendu = await publierLot(
      journal,
      [epr('a'), epr('b'), epr('autre', { pilote: false }), epr('arch', { statut: 'archivee' })],
      true,
      contexte,
      (id) => envoyees.push(id),
    );
    expect(ecrites).toEqual(['a', 'b']);
    expect(envoyees).toEqual(['a', 'b']);
    expect(rendu).toEqual({ publiee: true, faites: 2, autrePc: 1, archivees: 1, echecs: 0 });
  });

  it('cas limite : un échec au milieu du lot n’arrête pas les autres et se compte', async () => {
    const { journal, ecrites } = journalFactice(['b']);
    const rendu = await publierLot(journal, [epr('a'), epr('b'), epr('c')], true, contexte, () => undefined);
    expect(ecrites).toEqual(['a', 'c']);
    expect(rendu.echecs).toBe(1);
  });

  it('CA-3 et CA-4 : le message dit le résultat, ce qui reste à part et l’attente d’envoi hors ligne', () => {
    expect(messagePublication({ publiee: true, faites: 12, autrePc: 0, archivees: 0, echecs: 0 }, false)).toBe(
      '12 épreuves publiées.',
    );
    expect(messagePublication({ publiee: true, faites: 1, autrePc: 3, archivees: 0, echecs: 0 }, false)).toBe(
      '1 épreuve publiée. 3 épreuves n’ont pas été publiées : un autre PC est le pilote.',
    );
    expect(messagePublication({ publiee: false, faites: 2, autrePc: 0, archivees: 0, echecs: 1 }, true)).toBe(
      '2 épreuves dépubliées. 1 épreuve n’a pas pu être enregistrée sur cet appareil. Publication en attente d’envoi.',
    );
  });
});

describe('entrées du menu « ⋯ » d’une compétition (US-079)', () => {
  it('CA-3 et CA-4 : « Publier toutes » et « Dépublier toutes » n’apparaissent que si elles ont un effet', () => {
    const choix: boolean[] = [];
    const actions = actionsPublication([epr('a'), epr('b', { publiee: true })], (publiee) => choix.push(publiee));
    expect(actions.map(({ libelle }) => libelle)).toEqual([
      'Publier toutes les épreuves',
      'Dépublier toutes les épreuves',
    ]);
    actions[0]?.surChoix?.();
    actions[1]?.surChoix?.();
    expect(choix).toEqual([true, false]);
    expect(actionsPublication([epr('a', { publiee: true })], () => undefined).map(({ libelle }) => libelle)).toEqual([
      'Dépublier toutes les épreuves',
    ]);
    expect(actionsPublication([], () => undefined)).toEqual([]);
  });

  it('cas limite : sans épreuve pilotée ici à changer, l’entrée est grisée avec son motif', () => {
    const [publier] = actionsPublication([epr('a', { pilote: false })], () => undefined);
    expect(publier?.indisponible).toBe('Lecture seule : un autre PC est le pilote');
    const [ici] = actionsPublication([epr('a')], () => undefined);
    expect(ici?.indisponible).toBeUndefined();
  });
});
