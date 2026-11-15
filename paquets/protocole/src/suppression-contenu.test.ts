import { describe, expect, it } from 'vitest';
import { analyserReponseSuppressionContenu } from './suppression-contenu';

describe('réponse d’une suppression avec contenu (US-041, docs/protocole.md §14)', () => {
  it('US-041 CA-5 : lit un morceau terminé ou non, avec ce qui est supprimé et ce qui reste', () => {
    expect(analyserReponseSuppressionContenu({ ok: true, termine: false, supprimees: 30, restantes: 5 })).toEqual({
      ok: true,
      termine: false,
      supprimees: 30,
      restantes: 5,
    });
    expect(analyserReponseSuppressionContenu({ ok: true, termine: true, supprimees: 5, restantes: 0 })).toEqual({
      ok: true,
      termine: true,
      supprimees: 5,
      restantes: 0,
    });
  });

  it('US-041 CA-3 : lit le refus avec les noms des épreuves en cours', () => {
    expect(
      analyserReponseSuppressionContenu({ ok: false, erreur: 'EPREUVE_EN_COURS', enCours: ['Sabre M13', 'Épée'] }),
    ).toEqual({ ok: false, erreur: 'EPREUVE_EN_COURS', enCours: ['Sabre M13', 'Épée'] });
  });

  it('US-041 CA-2 : lit un refus sans liste', () => {
    expect(analyserReponseSuppressionContenu({ ok: false, erreur: 'ACCES_REFUSE' })).toEqual({
      ok: false,
      erreur: 'ACCES_REFUSE',
      enCours: [],
    });
  });

  it('US-041 : une réponse illisible est rejetée', () => {
    expect(analyserReponseSuppressionContenu({ ok: true, termine: 'oui', supprimees: 1, restantes: 0 })).toEqual({
      ok: false,
      erreur: 'REPONSE_INVALIDE',
      enCours: [],
    });
    expect(analyserReponseSuppressionContenu({ ok: true, termine: true, supprimees: -1, restantes: 0 })).toEqual({
      ok: false,
      erreur: 'REPONSE_INVALIDE',
      enCours: [],
    });
    expect(analyserReponseSuppressionContenu('n’importe quoi')).toEqual({
      ok: false,
      erreur: 'REPONSE_INVALIDE',
      enCours: [],
    });
  });
});
