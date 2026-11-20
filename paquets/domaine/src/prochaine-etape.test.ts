import { describe, expect, it } from 'vitest';
import { STATUTS } from './epreuve';
import { prochaineEtape } from './prochaine-etape';

describe('prochaineEtape (US-064)', () => {
  it('US-064 CA-2 : une épreuve en préparation non publiée se publie', () => {
    expect(prochaineEtape({ statut: 'preparation', publiee: false })).toBe('publier');
  });

  it('US-064 CA-3 : une épreuve en préparation publiée se partage, tant qu’aucune étape suivante n’est livrée', () => {
    expect(prochaineEtape({ statut: 'preparation', publiee: true })).toBe('partager');
  });

  it('US-064 CA-1 : une épreuve en cours propose aussi une étape selon sa publication', () => {
    expect(prochaineEtape({ statut: 'enCours', publiee: false })).toBe('publier');
    expect(prochaineEtape({ statut: 'enCours', publiee: true })).toBe('partager');
  });

  it('US-109 CA-6 : des poules terminées sans tableau proposent de créer le tableau', () => {
    expect(prochaineEtape({ statut: 'enCours', publiee: true, tableau: 'aCreer' })).toBe('creerTableau');
    expect(prochaineEtape({ statut: 'enCours', publiee: false, tableau: 'aCreer' })).toBe('creerTableau');
  });

  it('US-115 CA-6 : tous les matchs réglés proposent de terminer l’épreuve', () => {
    expect(prochaineEtape({ statut: 'enCours', publiee: true, tableau: 'aTerminer' })).toBe('terminer');
    expect(prochaineEtape({ statut: 'terminee', publiee: true, tableau: 'aTerminer' })).toBeNull();
  });

  it('US-064 CA-5 : une épreuve terminée ou archivée n’a pas de prochaine étape', () => {
    for (const publiee of [false, true]) {
      expect(prochaineEtape({ statut: 'terminee', publiee })).toBeNull();
      expect(prochaineEtape({ statut: 'archivee', publiee })).toBeNull();
    }
  });

  it('US-064 CA-1 : une seule étape est proposée pour chaque combinaison', () => {
    for (const statut of STATUTS) {
      for (const publiee of [false, true]) {
        const etape = prochaineEtape({ statut, publiee });
        expect(etape === null || typeof etape === 'string').toBe(true);
      }
    }
  });
});
