import { describe, expect, it } from 'vitest';
import { NOMS_ICONES } from './icones';
import { cheminEtape, ETAPES_EPREUVE } from './etapes-epreuve';

const id = '11111111-2222-3333-4444-555555555555';

describe('étapes de l’épreuve (US-058)', () => {
  it('CA-1 : dans l’ordre du déroulement, puis les réglages', () => {
    expect(ETAPES_EPREUVE.map((etape) => etape.id)).toEqual([
      'resume',
      'inscriptions',
      'emargement',
      'poules',
      'classement',
      'tableau',
      'impressions',
      'formule',
      'parametres',
    ]);
    expect(ETAPES_EPREUVE.filter((etape) => etape.groupe === 'reglages').map((etape) => etape.id)).toEqual([
      'formule',
      'parametres',
    ]);
  });

  it('CA-1 : chaque étape a une icône du vocabulaire', () => {
    for (const etape of ETAPES_EPREUVE) expect(NOMS_ICONES).toContain(etape.icone);
  });

  it('CA-2 et US-082 CA-1 : Résumé, Inscriptions, Émargement (US-084), Poules (US-086), Classement (US-092), Formule et Paramètres sont livrées', () => {
    expect(ETAPES_EPREUVE.filter((etape) => etape.livree).map((etape) => etape.id)).toEqual([
      'resume',
      'inscriptions',
      'emargement',
      'poules',
      'classement',
      'formule',
      'parametres',
    ]);
  });

  it('CA-2 : une étape à venir n’a pas d’adresse ; une étape livrée garde l’adresse actuelle', () => {
    const par = Object.fromEntries(ETAPES_EPREUVE.map((etape) => [etape.id, cheminEtape(etape, id)]));
    expect(par.poules).toBe(`/epreuves/${id}/poules`);
    expect(par.emargement).toBe(`/epreuves/${id}/emargement`);
    expect(par.classement).toBe(`/epreuves/${id}/classement`);
    expect(par.inscriptions).toBe(`/epreuves/${id}/inscriptions`);
    expect(par.tableau).toBeNull();
    expect(par.resume).toBe(`/epreuves/${id}`);
    expect(par.formule).toBe(`/epreuves/${id}/formule`);
    expect(par.parametres).toBe(`/epreuves/${id}/parametres`);
  });
});
