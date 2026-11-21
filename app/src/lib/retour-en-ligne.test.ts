import { describe, expect, it } from 'vitest';
import { creerSuiviRetour, type EtatRetour } from './retour-en-ligne';
import { textes } from './textes';

/** Faux minuteur : chaque attente avance l'horloge, sans attendre réellement. */
function fauxMinuteur() {
  let maintenant = 0;
  const pendant: Array<() => void> = [];
  return {
    maintenant: () => maintenant,
    attendre: async (ms: number) => {
      maintenant += ms;
      pendant.forEach((action) => action());
      await Promise.resolve();
    },
    pendant,
  };
}

/** Épreuves pilotées : seq confirmés et nombre en attente, modifiables par le test. */
function fausseSource(confirmes: Record<string, number>, enAttente = 0) {
  const etat = { confirmes: new Map(Object.entries(confirmes)), enAttente };
  return {
    etat,
    source: {
      confirmes: async () => new Map(etat.confirmes),
      enAttente: async () => etat.enAttente,
    },
  };
}

function suivre(suivi: ReturnType<typeof creerSuiviRetour>) {
  const etats: EtatRetour[] = [];
  suivi.surEtat((etat) => etats.push(etat));
  return etats;
}

describe('US-130 : résumé au retour du réseau', () => {
  it('CA-1 et CA-4 : envoi en cours, puis résumé des modifications et des saisies, effacé après 8 s', async () => {
    const minuteur = fauxMinuteur();
    const { etat, source } = fausseSource({ e1: 10, e2: 4 });
    const suivi = creerSuiviRetour({ source, minuteur });
    const etats = suivre(suivi);

    await suivi.surHorsLigne(true);
    // Pendant la coupure : 42 modifications ; au retour, elles partent puis sont confirmées.
    etat.enAttente = 42;
    let lectures = 0;
    minuteur.pendant.push(() => {
      lectures++;
      if (lectures === 1) {
        suivi.saisieTraitee({ id: 's1', decision: 'accepte' });
        suivi.saisieTraitee({ id: 's2', decision: 'accepte' });
        suivi.saisieTraitee({ id: 's3', decision: 'accepte' });
        suivi.saisieTraitee({ id: 's4', decision: 'doublon' });
      }
      if (lectures === 3) {
        etat.enAttente = 0;
        etat.confirmes = new Map([
          ['e1', 40],
          ['e2', 16],
        ]);
      }
    });
    await suivi.surHorsLigne(false);

    expect(etats[1]).toEqual({ etape: 'envoi' });
    expect(etats).toContainEqual({ etape: 'resume', envoyees: 42, recuperees: 3, ecartees: 0 });
    expect(etats.at(-1)).toEqual({ etape: 'aucun' });
    expect(textes.epreuves.retourResume(42, 3, 0)).toBe(
      'De retour en ligne : 42 modifications envoyées, 3 saisies smartphone récupérées',
    );
    expect(textes.epreuves.retourEnvoi).toBe('De retour en ligne : envoi en cours…');
  });

  it('CA-2 : les saisies écartées sont comptées à part', async () => {
    const minuteur = fauxMinuteur();
    const { source } = fausseSource({ e1: 3 });
    const suivi = creerSuiviRetour({ source, minuteur });
    const etats = suivre(suivi);
    await suivi.surHorsLigne(true);
    minuteur.pendant.push(() => {
      suivi.saisieTraitee({ id: 'a', decision: 'refuse', motif: 'MATCH_DEJA_SAISI' });
      minuteur.pendant.length = 0;
    });
    await suivi.surHorsLigne(false);
    expect(etats).toContainEqual({ etape: 'resume', envoyees: 0, recuperees: 0, ecartees: 1 });
    expect(textes.epreuves.retourResume(1, 1, 1)).toBe(
      'De retour en ligne : 1 modification envoyée, 1 saisie smartphone récupérée, 1 écartée',
    );
  });

  it('CA-3 : rien à envoyer, simplement « De retour en ligne »', async () => {
    const minuteur = fauxMinuteur();
    const suivi = creerSuiviRetour({ source: fausseSource({ e1: 3 }).source, minuteur });
    const etats = suivre(suivi);
    await suivi.surHorsLigne(true);
    await suivi.surHorsLigne(false);
    expect(etats).toContainEqual({ etape: 'resume', envoyees: 0, recuperees: 0, ecartees: 0 });
    expect(textes.epreuves.retourResume(0, 0, 0)).toBe('De retour en ligne');
  });

  it('CA-4 : une nouvelle coupure pendant l’envoi annule le résumé', async () => {
    const minuteur = fauxMinuteur();
    const { etat, source } = fausseSource({ e1: 3 }, 5);
    const suivi = creerSuiviRetour({ source, minuteur });
    const etats = suivre(suivi);
    await suivi.surHorsLigne(true);
    let recoupe: Promise<void> | null = null;
    minuteur.pendant.push(() => {
      if (!recoupe) recoupe = suivi.surHorsLigne(true);
    });
    await suivi.surHorsLigne(false);
    await recoupe;
    expect(etats.some((e) => e.etape === 'resume')).toBe(false);
    expect(suivi.etat()).toEqual({ etape: 'aucun' });
    // Le retour suivant compte depuis la première coupure.
    minuteur.pendant.length = 0;
    etat.enAttente = 0;
    etat.confirmes = new Map([['e1', 8]]);
    await suivi.surHorsLigne(false);
    expect(etats).toContainEqual({ etape: 'resume', envoyees: 5, recuperees: 0, ecartees: 0 });
  });

  it('envoi bloqué (session expirée) : on renonce au résumé après le délai maximal', async () => {
    const minuteur = fauxMinuteur();
    const suivi = creerSuiviRetour({ source: fausseSource({ e1: 3 }, 2).source, minuteur, delaiMax: 5_000 });
    const etats = suivre(suivi);
    await suivi.surHorsLigne(true);
    await suivi.surHorsLigne(false);
    expect(etats.some((e) => e.etape === 'resume')).toBe(false);
    expect(suivi.etat()).toEqual({ etape: 'aucun' });
  });

  it('prise de main pendant la coupure : pas de résumé, le message de la perte de main suffit', async () => {
    const minuteur = fauxMinuteur();
    const { etat, source } = fausseSource({ e1: 3, e2: 1 });
    const suivi = creerSuiviRetour({ source, minuteur });
    const etats = suivre(suivi);
    await suivi.surHorsLigne(true);
    etat.confirmes = new Map([['e1', 3]]);
    await suivi.surHorsLigne(false);
    expect(etats.some((e) => e.etape === 'resume')).toBe(false);
  });

  it('un retour sans coupure notée ne montre rien, et les saisies hors retour ne comptent pas', async () => {
    const minuteur = fauxMinuteur();
    const suivi = creerSuiviRetour({ source: fausseSource({}).source, minuteur });
    const etats = suivre(suivi);
    suivi.saisieTraitee({ id: 'x', decision: 'accepte' });
    await suivi.surHorsLigne(false);
    expect(etats).toEqual([]);
  });

  it('une lecture en échec n’empêche pas le résumé', async () => {
    const minuteur = fauxMinuteur();
    let echec = true;
    const suivi = creerSuiviRetour({
      source: {
        confirmes: () => Promise.reject(new Error('IndexedDB')),
        enAttente: async () => {
          if (echec) {
            echec = false;
            throw new Error('IndexedDB');
          }
          return 0;
        },
      },
      minuteur,
    });
    const etats = suivre(suivi);
    await suivi.surHorsLigne(true);
    await suivi.surHorsLigne(false);
    expect(etats).toContainEqual({ etape: 'resume', envoyees: 0, recuperees: 0, ecartees: 0 });
  });
});
