import { describe, expect, it } from 'vitest';
import type { PiloteEnPlace } from '@poule-position/domaine';
import { actionReprise, chercherPilotes, detailReprise, messageReprise, reprendreLot } from './reprise-lot';

type Reponse =
  { ok: true; piloteAppareil: string; piloteNom: string; connecte: boolean } | { ok: false; erreur: string };

/** Un serveur factice : le pilote de chaque épreuve, et les prises de main qui échouent. */
function pilotageFactice(
  pilotes: Record<string, Reponse>,
  refus: Record<string, string> = {},
): Parameters<typeof chercherPilotes>[0] & { prises: string[] } {
  const prises: string[] = [];
  return {
    prises,
    pilote: async (id: string) => pilotes[id] as never,
    prendreLaMain: async (id: string) => {
      if (refus[id]) return { ok: false, erreur: refus[id] } as never;
      prises.push(id);
      return { ok: true } as never;
    },
  } as never;
}

const enPlace = (epreuveId: string, appareil: string, nom: string, connecte: boolean): PiloteEnPlace => ({
  epreuveId,
  appareil,
  nom,
  connecte,
});

describe('reprendre en main toutes les épreuves d’une compétition (US-080)', () => {
  it('CA-4 : cherche le pilote de chaque épreuve ; une erreur arrête la recherche', async () => {
    const pilotage = pilotageFactice({
      a: { ok: true, piloteAppareil: 'pc-a-123', piloteNom: 'Léa', connecte: true },
      b: { ok: false, erreur: 'HORS_LIGNE' },
    });
    expect(await chercherPilotes(pilotage, ['a'])).toEqual({
      ok: true,
      pilotes: [enPlace('a', 'pc-a-123', 'Léa', true)],
    });
    expect(await chercherPilotes(pilotage, ['a', 'b'])).toEqual({ ok: false, erreur: 'HORS_LIGNE' });
  });

  it('CA-4 : la confirmation dit combien d’épreuves passent sur ce PC et quels pilotes sont connectés', () => {
    expect(
      detailReprise([
        enPlace('a', 'pc-a-123', 'Léa', true),
        enPlace('b', 'pc-a-123', 'Léa', true),
        enPlace('c', 'pc-b-456', 'Marc', false),
      ]),
    ).toBe(
      '3 épreuves pilotées par un autre PC passent sur ce PC. Le PC de Léa (appareil pc-a) est connecté et pilote 2 de ces épreuves.',
    );
    expect(detailReprise([enPlace('a', 'pc-b-456', 'Marc', false)])).toBe(
      '1 épreuve pilotée par un autre PC passe sur ce PC.',
    );
  });

  it('CA-5 : reprend chaque épreuve ; la main prise entre-temps et les échecs sont comptés à part', async () => {
    const pilotage = pilotageFactice({}, { b: 'MAIN_DEJA_PRISE', c: 'HORS_LIGNE' });
    const rendu = await reprendreLot(
      pilotage,
      [enPlace('a', 'x', 'Léa', true), enPlace('b', 'x', 'Léa', true), enPlace('c', 'y', 'Marc', false)],
      { clubId: 'club', auteur: 'orga@club.fr' },
    );
    expect(pilotage.prises).toEqual(['a']);
    expect(rendu).toEqual({ faites: 1, dejaPrises: 1, echecs: 1 });
    expect(messageReprise(rendu)).toBe(
      '1 épreuve reprise en main. 1 épreuve a été reprise entre-temps par un autre PC. 1 épreuve n’a pas pu être reprise.',
    );
    expect(messageReprise({ faites: 3, dejaPrises: 0, echecs: 0 })).toBe('3 épreuves reprises en main.');
  });

  it('CA-3 et hors ligne : l’entrée n’apparaît que si une épreuve est pilotée ailleurs, grisée sans réseau', () => {
    const ailleurs = [{ id: 'a', statut: 'preparation' as const, pilote: false }];
    let choisie = false;
    const [action] = actionReprise(ailleurs, false, () => (choisie = true));
    expect(action?.libelle).toBe('Tout reprendre en main');
    expect(action?.indisponible).toBeUndefined();
    action?.surChoix?.();
    expect(choisie).toBe(true);
    expect(actionReprise(ailleurs, true, () => undefined)[0]?.indisponible).toBe('Nécessite une connexion internet');
    expect(actionReprise([{ id: 'a', statut: 'preparation', pilote: true }], false, () => undefined)).toEqual([]);
  });
});
