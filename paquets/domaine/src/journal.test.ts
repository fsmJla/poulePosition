import { describe, expect, it } from 'vitest';
import { parametresParDefaut, type DonneesEpreuve } from './epreuve';
import { appliquer, projectionVide, projeter, verifierEvenement, type Evenement, type Proposition } from './journal';

const donnees = (champs: Partial<DonneesEpreuve> = {}): DonneesEpreuve => ({
  nom: 'Challenge Orpi 2027',
  arme: 'sabre',
  typeEpreuve: 'individuelle',
  categorie: 'M13',
  sexe: 'mixte',
  date: '2027-03-14',
  horaires: { appel: '08:30', scratch: '09:00', debutPoules: '09:30' },
  lieu: 'Salle Bellegrave',
  commentaire: null,
  rattachement: { competitionId: 'c1' },
  ...champs,
});

const creation = (champs: Partial<DonneesEpreuve> = {}): Proposition => ({
  type: 'EpreuveCreee',
  donnees: donnees(champs),
});
const evenement = (seq: number, proposition: Proposition = creation()): Evenement => ({
  epreuveId: 'c1',
  clubId: 'pessac',
  seq,
  version: 1,
  date: 1_800_000_000_000 + seq,
  auteur: 'orga@club.fr',
  source: 'clavier',
  ...proposition,
});

describe('journal d’une épreuve (ADR-0001)', () => {
  it('US-021 CA-2 : la création donne une épreuve, avec son nom, son club, sa date et son auteur', () => {
    expect(projeter([evenement(1)])).toEqual({
      epreuve: {
        id: 'c1',
        clubId: 'pessac',
        ...donnees(),
        creeeLe: 1_800_000_000_001,
        creeePar: 'orga@club.fr',
        statut: 'preparation',
        avantArchivage: null,
        publiee: false,
        formule: { touchesPoules: 5, touchesTableau: 15, touchesRelais: null, matchTroisieme: false },
        parametres: parametresParDefaut(),
      },
      dernierSeq: 1,
      anomalie: null,
    });
  });

  it('US-025 CA-2 : l’épreuve créée est en préparation, non publiée, avec la formule par défaut', () => {
    const { epreuve } = projeter([evenement(1, creation({ typeEpreuve: 'equipes2' }))]);
    expect(epreuve).toMatchObject({ statut: 'preparation', publiee: false, formule: { touchesRelais: 20 } });
  });

  it('US-025 CA-5 : refuse des horaires incohérents dans le journal', () => {
    const horaires = { appel: '09:00', scratch: '08:00', debutPoules: null };
    expect(verifierEvenement(projectionVide(), creation({ horaires }))).toBe('SCRATCH_AVANT_APPEL');
  });

  it('US-025 cas limite : les textes facultatifs sont enregistrés sans les espaces autour', () => {
    const { epreuve } = projeter([evenement(1, creation({ lieu: '  ', commentaire: ' Buvette ' }))]);
    expect(epreuve).toMatchObject({ lieu: null, commentaire: 'Buvette' });
  });

  it('US-021 CA-2 : le même journal donne toujours la même projection', () => {
    const journal = [evenement(1)];
    expect(projeter(journal)).toEqual(projeter(journal));
    expect(projeter([])).toEqual(projectionVide());
  });

  it('US-021 CA-2 : la projection ne modifie pas le journal reçu', () => {
    const journal = Object.freeze([Object.freeze(evenement(1))]);
    expect(() => projeter(journal)).not.toThrow();
  });

  it('US-021 CA-4 : refuse un nom vide ou trop long', () => {
    expect(verifierEvenement(projectionVide(), creation({ nom: '   ' }))).toBe('NOM_VIDE');
    expect(verifierEvenement(projectionVide(), creation({ nom: 'x'.repeat(101) }))).toBe('NOM_TROP_LONG');
    expect(verifierEvenement(projectionVide(), creation({ nom: 'x'.repeat(100) }))).toBeNull();
  });

  it('US-021 CA-4 : refuse une deuxième création de la même épreuve', () => {
    expect(verifierEvenement(projeter([evenement(1)]), creation())).toBe('EPREUVE_DEJA_CREEE');
  });

  it('US-021 CA-4 : le nom est enregistré sans les espaces autour', () => {
    expect(appliquer(projectionVide(), evenement(1, creation({ nom: '  Orpi  ' }))).epreuve?.nom).toBe('Orpi');
  });

  it('US-021 cas limite : un trou de seq arrête la projection au dernier événement cohérent', () => {
    expect(projeter([evenement(1), evenement(3)])).toMatchObject({
      dernierSeq: 1,
      anomalie: { seq: 3, nature: 'TROU' },
    });
    expect(projeter([evenement(2)])).toMatchObject({ epreuve: null, anomalie: { seq: 2, nature: 'TROU' } });
  });

  it('US-021 cas limite : un doublon de seq arrête la projection et le signale', () => {
    expect(projeter([evenement(1), evenement(1)])).toMatchObject({
      dernierSeq: 1,
      anomalie: { seq: 1, nature: 'DOUBLON' },
    });
  });

  it('US-021 cas limite : un événement que les règles refusent arrête la projection', () => {
    expect(projeter([evenement(1), evenement(2)])).toMatchObject({
      dernierSeq: 1,
      anomalie: { seq: 2, nature: 'INVALIDE' },
    });
  });
});

describe('modification d’une épreuve (US-027)', () => {
  const modifiee = (champs: Partial<DonneesEpreuve>): Proposition => ({
    type: 'EpreuveModifiee',
    donnees: champs,
  });
  const creee = () => projeter([evenement(1)]);
  const enStatut = (statut: 'enCours' | 'terminee' | 'archivee') => {
    const p = creee();
    return { ...p, epreuve: { ...p.epreuve!, statut } };
  };

  it('CA-1 : appliquer fusionne une EpreuveModifiee et garde le reste', () => {
    const { epreuve, dernierSeq } = projeter([evenement(1), evenement(2, modifiee({ nom: ' Nouveau ', lieu: null }))]);
    expect(dernierSeq).toBe(2);
    expect(epreuve).toMatchObject({
      nom: 'Nouveau',
      lieu: null,
      arme: 'sabre',
      categorie: 'M13',
      creeePar: 'orga@club.fr',
    });
  });

  it('CA-1 : la projection s’arrête sur une modification invalide', () => {
    expect(projeter([evenement(1), evenement(2, modifiee({ nom: '   ' }))])).toMatchObject({
      dernierSeq: 1,
      anomalie: { seq: 2, nature: 'INVALIDE' },
    });
  });

  it('CA-1 : changer le type recalcule les touches de relais de la formule', () => {
    const { epreuve } = projeter([evenement(1), evenement(2, modifiee({ typeEpreuve: 'equipes3' }))]);
    expect(epreuve?.formule.touchesRelais).toBe(45);
    expect(epreuve?.formule.touchesPoules).toBe(5);
  });

  it('CA-1 : refuse une modification sans épreuve créée', () => {
    expect(verifierEvenement(projectionVide(), modifiee({ nom: 'x' }))).toBe('EPREUVE_INCONNUE');
  });

  it('CA-2 : en cours, arme et type sont figés, les autres champs restent modifiables', () => {
    expect(verifierEvenement(enStatut('enCours'), modifiee({ arme: 'epee' }))).toBe('CHAMP_FIGE');
    expect(verifierEvenement(enStatut('enCours'), modifiee({ typeEpreuve: 'equipes2' }))).toBe('CHAMP_FIGE');
    expect(verifierEvenement(enStatut('enCours'), modifiee({ nom: 'Autre', lieu: 'Ailleurs' }))).toBeNull();
  });

  it('CA-4 : mêmes erreurs qu’à la création', () => {
    const horaires = { appel: '09:00', scratch: '08:00', debutPoules: null };
    expect(verifierEvenement(creee(), modifiee({ horaires }))).toBe('SCRATCH_AVANT_APPEL');
    expect(verifierEvenement(creee(), modifiee({ nom: 'x'.repeat(101) }))).toBe('NOM_TROP_LONG');
    expect(verifierEvenement(creee(), modifiee({ date: '2027-02-30' }))).toBe('DATE_INVALIDE');
  });

  it('CA-5 : une modification qui ne change rien est refusée', () => {
    expect(verifierEvenement(creee(), modifiee({}))).toBe('AUCUNE_MODIFICATION');
    expect(verifierEvenement(creee(), modifiee({ nom: ' Challenge Orpi 2027 ' }))).toBe('AUCUNE_MODIFICATION');
  });

  it('cas limite : terminée, seul le commentaire se modifie ; archivée, tout est refusé', () => {
    expect(verifierEvenement(enStatut('terminee'), modifiee({ commentaire: 'Bravo' }))).toBeNull();
    expect(verifierEvenement(enStatut('terminee'), modifiee({ nom: 'Autre' }))).toBe('CHAMP_FIGE');
    expect(verifierEvenement(enStatut('archivee'), modifiee({ commentaire: 'Bravo' }))).toBe('EPREUVE_ARCHIVEE');
  });
});

describe('formule d’une épreuve (US-028)', () => {
  type DonneesFormule = Extract<Proposition, { type: 'FormuleModifiee' }>['donnees'];
  const formuleModifiee = (donneesFormule: DonneesFormule): Proposition => ({
    type: 'FormuleModifiee',
    donnees: donneesFormule,
  });
  const creee = () => projeter([evenement(1)]);
  const enStatut = (statut: 'enCours' | 'terminee' | 'archivee') => {
    const p = creee();
    return { ...p, epreuve: { ...p.epreuve!, statut } };
  };

  it('CA-2 : appliquer fusionne une FormuleModifiee et garde le reste de l’épreuve', () => {
    const { epreuve, dernierSeq, anomalie } = projeter([
      evenement(1),
      evenement(2, formuleModifiee({ touchesTableau: 10, matchTroisieme: true })),
    ]);
    expect(anomalie).toBeNull();
    expect(dernierSeq).toBe(2);
    expect(epreuve?.formule).toEqual({
      touchesPoules: 5,
      touchesTableau: 10,
      touchesRelais: null,
      matchTroisieme: true,
    });
    expect(epreuve?.nom).toBe('Challenge Orpi 2027');
  });

  it('CA-2 : refuse des touches hors bornes', () => {
    expect(verifierEvenement(creee(), formuleModifiee({ touchesPoules: 11 }))).toBe('TOUCHES_POULES_INVALIDES');
    expect(verifierEvenement(creee(), formuleModifiee({ touchesTableau: 12 }))).toBe('TOUCHES_TABLEAU_INVALIDES');
  });

  it('CA-2 : refuse une formule sans épreuve créée', () => {
    expect(verifierEvenement(projectionVide(), formuleModifiee({ touchesPoules: 4 }))).toBe('EPREUVE_INCONNUE');
  });

  it('CA-2 : une formule qui ne change rien est refusée', () => {
    expect(verifierEvenement(creee(), formuleModifiee({}))).toBe('AUCUNE_MODIFICATION');
    expect(verifierEvenement(creee(), formuleModifiee({ touchesPoules: 5, matchTroisieme: false }))).toBe(
      'AUCUNE_MODIFICATION',
    );
  });

  it('CA-3 : les touches de relais ne se modifient pas, elles suivent le type de l’épreuve', () => {
    const relais = { touchesRelais: 45 } as unknown as DonneesFormule;
    expect(verifierEvenement(creee(), formuleModifiee(relais))).toBe('CHAMP_FIGE');
    const { epreuve } = projeter([
      evenement(1, creation({ typeEpreuve: 'equipes2' })),
      evenement(2, formuleModifiee({ touchesPoules: 4 })),
    ]);
    expect(epreuve?.formule).toMatchObject({ touchesRelais: 20, touchesPoules: 4 });
  });

  it('CA-4 : en cours, la formule peut changer', () => {
    expect(verifierEvenement(enStatut('enCours'), formuleModifiee({ touchesTableau: 10 }))).toBeNull();
  });

  it('CA-5 : le match pour la 3e place s’active tant que l’épreuve n’est pas terminée', () => {
    expect(verifierEvenement(creee(), formuleModifiee({ matchTroisieme: true }))).toBeNull();
    expect(verifierEvenement(enStatut('enCours'), formuleModifiee({ matchTroisieme: true }))).toBeNull();
    expect(verifierEvenement(enStatut('terminee'), formuleModifiee({ matchTroisieme: true }))).toBe('FORMULE_FIGEE');
  });

  it('cas limite : terminée, la formule est figée ; archivée, l’épreuve est refusée', () => {
    expect(verifierEvenement(enStatut('terminee'), formuleModifiee({ touchesPoules: 4 }))).toBe('FORMULE_FIGEE');
    expect(verifierEvenement(enStatut('archivee'), formuleModifiee({ touchesPoules: 4 }))).toBe('EPREUVE_ARCHIVEE');
  });

  it('cas limite : une modification de l’épreuve garde la formule réglée', () => {
    const { epreuve } = projeter([
      evenement(1),
      evenement(2, formuleModifiee({ touchesPoules: 8 })),
      evenement(3, { type: 'EpreuveModifiee', donnees: { nom: 'Autre' } }),
    ]);
    expect(epreuve?.formule.touchesPoules).toBe(8);
  });

  it('cas limite : appliquer ignore une formule sans épreuve créée', () => {
    const vide = projectionVide();
    expect(appliquer(vide, evenement(1, formuleModifiee({ touchesPoules: 4 })))).toBe(vide);
  });
});

describe('changement de pilote (US-029)', () => {
  type DonneesPilote = Extract<Proposition, { type: 'PiloteChange' }>['donnees'];
  const pilote = (donneesPilote: DonneesPilote): Proposition => ({ type: 'PiloteChange', donnees: donneesPilote });
  const creee = () => projeter([evenement(1)]);

  it('CA-1 : PiloteChange s’applique sans rien changer à l’épreuve', () => {
    const avant = creee();
    const apres = projeter([evenement(1), evenement(2, pilote({ ancienAppareil: 'a1', nouvelAppareil: 'a2' }))]);
    expect(apres.anomalie).toBeNull();
    expect(apres.dernierSeq).toBe(2);
    expect(apres.epreuve).toEqual(avant.epreuve);
  });

  it('CA-1 : refuse un changement sans épreuve créée', () => {
    expect(verifierEvenement(projectionVide(), pilote({ ancienAppareil: 'a1', nouvelAppareil: 'a2' }))).toBe(
      'EPREUVE_INCONNUE',
    );
  });

  it('CA-1 : refuse des appareils vides ou identiques', () => {
    expect(verifierEvenement(creee(), pilote({ ancienAppareil: '', nouvelAppareil: 'a2' }))).toBe('PILOTE_INVALIDE');
    expect(verifierEvenement(creee(), pilote({ ancienAppareil: 'a1', nouvelAppareil: '' }))).toBe('PILOTE_INVALIDE');
    expect(verifierEvenement(creee(), pilote({ ancienAppareil: 'a1', nouvelAppareil: 'a1' }))).toBe('PILOTE_INVALIDE');
  });

  it('cas limite : une épreuve terminée ou archivée peut changer de pilote', () => {
    for (const statut of ['terminee', 'archivee'] as const) {
      const p = creee();
      const projection = { ...p, epreuve: { ...p.epreuve!, statut } };
      expect(verifierEvenement(projection, pilote({ ancienAppareil: 'a1', nouvelAppareil: 'a2' }))).toBeNull();
    }
  });
});

describe('paramètres d’une épreuve (US-032)', () => {
  type DonneesParametres = Extract<Proposition, { type: 'ParametresModifies' }>['donnees'];
  const parametres = (donneesParametres: DonneesParametres): Proposition => ({
    type: 'ParametresModifies',
    donnees: donneesParametres,
  });
  const creee = () => projeter([evenement(1)]);
  const enStatut = (statut: 'enCours' | 'terminee' | 'archivee') => {
    const p = creee();
    return { ...p, epreuve: { ...p.epreuve!, statut } };
  };

  it('CA-1 : une épreuve créée a les paramètres par défaut', () => {
    expect(creee().epreuve?.parametres).toEqual({
      arbitreSaisitScores: true,
      arbitreDeplace: true,
      tireurSaisitPoule: true,
      tireurSaisitTableau: true,
      correctionScore: 'arbitre',
      prenomInitiale: false,
    });
  });

  it('CA-2 et CA-3 : appliquer fusionne les paramètres, la projection porte la valeur en vigueur', () => {
    const { epreuve, dernierSeq, anomalie } = projeter([
      evenement(1),
      evenement(2, parametres({ tireurSaisitTableau: false })),
      evenement(3, parametres({ correctionScore: 'personne', prenomInitiale: true })),
    ]);
    expect(anomalie).toBeNull();
    expect(dernierSeq).toBe(3);
    expect(epreuve?.parametres).toEqual({
      arbitreSaisitScores: true,
      arbitreDeplace: true,
      tireurSaisitPoule: true,
      tireurSaisitTableau: false,
      correctionScore: 'personne',
      prenomInitiale: true,
    });
    expect(epreuve?.nom).toBe('Challenge Orpi 2027');
  });

  it('CA-3 : modifier l’épreuve ou sa formule garde les paramètres réglés', () => {
    const { epreuve } = projeter([
      evenement(1),
      evenement(2, parametres({ prenomInitiale: true })),
      evenement(3, { type: 'EpreuveModifiee', donnees: { nom: 'Autre' } }),
      evenement(4, { type: 'FormuleModifiee', donnees: { touchesPoules: 4 } }),
    ]);
    expect(epreuve?.parametres.prenomInitiale).toBe(true);
  });

  it('CA-2 : refuse un paramètre sans épreuve créée', () => {
    expect(verifierEvenement(projectionVide(), parametres({ prenomInitiale: true }))).toBe('EPREUVE_INCONNUE');
  });

  it('CA-2 : refuse un réglage inconnu et une valeur invalide', () => {
    const inconnu = { touchesPoules: 4 } as unknown as DonneesParametres;
    expect(verifierEvenement(creee(), parametres(inconnu))).toBe('CHAMP_FIGE');
    expect(verifierEvenement(creee(), parametres({ correctionScore: 'tireur' as 'arbitre' }))).toBe(
      'CORRECTION_SCORE_INVALIDE',
    );
    expect(verifierEvenement(creee(), parametres({ prenomInitiale: 'oui' as unknown as boolean }))).toBe(
      'PARAMETRE_INVALIDE',
    );
  });

  it('CA-2 : des paramètres qui ne changent rien sont refusés', () => {
    expect(verifierEvenement(creee(), parametres({}))).toBe('AUCUNE_MODIFICATION');
    expect(verifierEvenement(creee(), parametres({ arbitreSaisitScores: true, prenomInitiale: false }))).toBe(
      'AUCUNE_MODIFICATION',
    );
  });

  it('CA-2 : modifiables à tout moment, y compris en cours et une fois terminée', () => {
    for (const statut of ['enCours', 'terminee'] as const) {
      expect(verifierEvenement(enStatut(statut), parametres({ arbitreDeplace: false }))).toBeNull();
    }
  });

  it('cas limite : archivée, les paramètres sont en lecture seule', () => {
    expect(verifierEvenement(enStatut('archivee'), parametres({ arbitreDeplace: false }))).toBe('EPREUVE_ARCHIVEE');
  });

  it('cas limite : appliquer ignore des paramètres sans épreuve créée', () => {
    const vide = projectionVide();
    expect(appliquer(vide, evenement(1, parametres({ prenomInitiale: true })))).toBe(vide);
  });
});

describe('publication d’une épreuve (US-031)', () => {
  const publication = (publiee: boolean): Proposition => ({ type: 'PublicationModifiee', donnees: { publiee } });
  const creee = () => projeter([evenement(1)]);
  const enStatut = (statut: 'preparation' | 'enCours' | 'terminee' | 'archivee') => {
    const p = creee();
    return { ...p, epreuve: { ...p.epreuve!, statut } };
  };

  it('CA-1 : une épreuve créée n’est pas publiée', () => {
    expect(creee().epreuve?.publiee).toBe(false);
  });

  it('CA-2 : publier, puis dépublier (CA-4), change la publication et fait avancer le journal', () => {
    const publiee = projeter([evenement(1), evenement(2, publication(true))]);
    expect(publiee.epreuve?.publiee).toBe(true);
    expect(publiee.dernierSeq).toBe(2);
    const depubliee = projeter([evenement(1), evenement(2, publication(true)), evenement(3, publication(false))]);
    expect(depubliee.epreuve?.publiee).toBe(false);
    expect(depubliee.anomalie).toBeNull();
  });

  it('CA-2 : on publie à tout moment, quel que soit le statut', () => {
    for (const statut of ['preparation', 'enCours', 'terminee'] as const) {
      expect(verifierEvenement(enStatut(statut), publication(true))).toBeNull();
    }
  });

  it('une publication qui ne change rien est refusée', () => {
    expect(verifierEvenement(creee(), publication(false))).toBe('AUCUNE_MODIFICATION');
    const publiee = projeter([evenement(1), evenement(2, publication(true))]);
    expect(verifierEvenement(publiee, publication(true))).toBe('AUCUNE_MODIFICATION');
  });

  it('cas limite : une épreuve archivée ne se publie ni ne se dépublie', () => {
    expect(verifierEvenement(enStatut('archivee'), publication(true))).toBe('EPREUVE_ARCHIVEE');
    expect(verifierEvenement(enStatut('archivee'), publication(false))).toBe('EPREUVE_ARCHIVEE');
  });

  it('refuse de publier une épreuve inconnue, et appliquer l’ignore', () => {
    const vide = projectionVide();
    expect(verifierEvenement(vide, publication(true))).toBe('EPREUVE_INCONNUE');
    expect(appliquer(vide, evenement(1, publication(true)))).toBe(vide);
  });

  it('les autres modifications ne changent pas la publication', () => {
    const publiee = projeter([evenement(1), evenement(2, publication(true))]);
    const modifiee = appliquer(publiee, evenement(3, { type: 'EpreuveModifiee', donnees: { nom: 'Autre' } }));
    expect(modifiee.epreuve?.publiee).toBe(true);
  });
});

describe('archivage d’une épreuve (US-033)', () => {
  const archivage: Proposition = { type: 'EpreuveArchivee', donnees: {} };
  const desarchivage: Proposition = { type: 'EpreuveDesarchivee', donnees: {} };
  const publication: Proposition = { type: 'PublicationModifiee', donnees: { publiee: true } };
  const creee = () => projeter([evenement(1)]);
  const enStatut = (statut: 'preparation' | 'enCours' | 'terminee' | 'archivee') => {
    const p = creee();
    return { ...p, epreuve: { ...p.epreuve!, statut } };
  };

  it('CA-1 : archiver passe l’épreuve au statut « Archivée » et fait avancer le journal', () => {
    const archivee = projeter([evenement(1), evenement(2, archivage)]);
    expect(archivee.epreuve?.statut).toBe('archivee');
    expect(archivee.epreuve?.avantArchivage).toBe('preparation');
    expect(archivee.dernierSeq).toBe(2);
    expect(archivee.anomalie).toBeNull();
  });

  it('CA-1 : une épreuve archivée est en lecture seule (modification, publication, déjà archivée)', () => {
    const archivee = projeter([evenement(1), evenement(2, archivage)]);
    expect(verifierEvenement(archivee, publication)).toBe('EPREUVE_ARCHIVEE');
    expect(verifierEvenement(archivee, { type: 'EpreuveModifiee', donnees: { nom: 'Autre' } })).toBe(
      'EPREUVE_ARCHIVEE',
    );
    expect(verifierEvenement(archivee, archivage)).toBe('EPREUVE_ARCHIVEE');
  });

  it('CA-2 : une épreuve en cours ne s’archive pas', () => {
    expect(verifierEvenement(enStatut('enCours'), archivage)).toBe('EPREUVE_EN_COURS');
    expect(verifierEvenement(enStatut('terminee'), archivage)).toBeNull();
    expect(verifierEvenement(enStatut('preparation'), archivage)).toBeNull();
  });

  it('CA-3 : désarchiver rend le statut d’avant l’archivage, non publiée', () => {
    const terminee = enStatut('terminee');
    const archivee = appliquer(terminee, evenement(2, archivage));
    expect(archivee.epreuve?.avantArchivage).toBe('terminee');
    const rendue = appliquer(archivee, evenement(3, desarchivage));
    expect(rendue.epreuve).toMatchObject({ statut: 'terminee', avantArchivage: null, publiee: false });
    const publiee = appliquer(creee(), evenement(2, publication));
    const roundTrip = appliquer(appliquer(publiee, evenement(3, archivage)), evenement(4, desarchivage));
    expect(roundTrip.epreuve).toMatchObject({ statut: 'preparation', publiee: false });
  });

  it('CA-3 : on ne désarchive qu’une épreuve archivée', () => {
    expect(verifierEvenement(creee(), desarchivage)).toBe('EPREUVE_NON_ARCHIVEE');
    expect(verifierEvenement(enStatut('archivee'), desarchivage)).toBeNull();
  });

  it('une épreuve inconnue ne s’archive ni ne se désarchive', () => {
    expect(verifierEvenement(projectionVide(), archivage)).toBe('EPREUVE_INCONNUE');
    expect(verifierEvenement(projectionVide(), desarchivage)).toBe('EPREUVE_INCONNUE');
    expect(appliquer(projectionVide(), evenement(1, archivage)).epreuve).toBeNull();
    expect(appliquer(projectionVide(), evenement(1, desarchivage)).epreuve).toBeNull();
  });

  it('une archive sans statut mémorisé (journal incomplet) revient en préparation', () => {
    const p = enStatut('archivee');
    expect(appliquer(p, evenement(2, desarchivage)).epreuve?.statut).toBe('preparation');
  });
});
