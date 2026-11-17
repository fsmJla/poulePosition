import { describe, expect, it } from 'vitest';
import {
  appliquer,
  projeter,
  tireursDe,
  verifierEvenement,
  type Epreuve,
  type Evenement,
  type Proposition,
} from './journal';
import { comparerTireur, inscriptionsOuvertes, trierTireurs, validerTireur, type Tireur } from './tireurs';

const enTete = (seq: number) => ({
  epreuveId: 'e1',
  clubId: 'c1',
  seq,
  version: 1,
  date: 1,
  auteur: 'a@b.fr',
  source: 'clavier' as const,
});
const creation: Evenement = {
  ...enTete(1),
  type: 'EpreuveCreee',
  donnees: {
    nom: 'M13 Dames',
    arme: 'sabre',
    typeEpreuve: 'individuelle',
    categorie: 'M13',
    sexe: 'dames',
    date: null,
    horaires: { appel: null, scratch: null, debutPoules: null },
    lieu: null,
    commentaire: null,
    rattachement: { competitionId: 'comp' },
  },
};
/** Le journal : la création, puis les propositions données, numérotées à la suite. */
const journal = (...propositions: Proposition[]): Evenement[] => [
  creation,
  ...propositions.map((proposition, rang) => ({ ...enTete(rang + 2), ...proposition }) as Evenement),
];
const inscrire = (tireurId: string, nom: string, prenom: string, autres: object = {}): Proposition => ({
  type: 'TireurInscrit',
  donnees: { tireurId, nom, prenom, club: 'Pessac', ...autres },
});

describe('les inscrits dans le journal d’une épreuve (US-081)', () => {
  it('CA-1 : inscrire un tireur, absent par défaut, champs nettoyés', () => {
    const { epreuve, anomalie } = projeter(
      journal(
        inscrire('t1', '  DUBOIS ', 'Chloé', { classement: 5, licence: ' 123 ' }),
        inscrire('t2', 'MARTIN', 'Léa'),
      ),
    );
    expect(anomalie).toBeNull();
    expect(tireursDe(epreuve!)).toEqual([
      {
        id: 't1',
        nom: 'DUBOIS',
        prenom: 'Chloé',
        club: 'Pessac',
        classement: 5,
        licence: '123',
        present: false,
        heure: null,
      },
      {
        id: 't2',
        nom: 'MARTIN',
        prenom: 'Léa',
        club: 'Pessac',
        classement: null,
        licence: null,
        present: false,
        heure: null,
      },
    ]);
  });

  it('CA-1 : nom ou prénom vide, champ trop long, classement hors bornes et tireur déjà inscrit sont refusés', () => {
    const base = projeter(journal(inscrire('t1', 'DUBOIS', 'Chloé')));
    expect(verifierEvenement(base, inscrire('t2', ' ', 'Léa'))).toBe('TIREUR_NOM_VIDE');
    expect(verifierEvenement(base, inscrire('t2', 'MARTIN', ''))).toBe('TIREUR_PRENOM_VIDE');
    expect(verifierEvenement(base, inscrire('t2', 'X'.repeat(61), 'Léa'))).toBe('TIREUR_CHAMP_TROP_LONG');
    expect(verifierEvenement(base, inscrire('t2', 'MARTIN', 'Léa', { classement: 0 }))).toBe('CLASSEMENT_INVALIDE');
    expect(verifierEvenement(base, inscrire('t2', 'MARTIN', 'Léa', { classement: 2.5 }))).toBe('CLASSEMENT_INVALIDE');
    expect(verifierEvenement(base, inscrire('t2', 'MARTIN', 'Léa', { classement: 100_000 }))).toBe(
      'CLASSEMENT_INVALIDE',
    );
    expect(verifierEvenement(base, inscrire('t1', 'MARTIN', 'Léa'))).toBe('TIREUR_DEJA_INSCRIT');
  });

  it('CA-2 : modifier les seuls champs changés ; effacer le classement ; tireur inconnu refusé', () => {
    const { epreuve } = projeter(
      journal(inscrire('t1', 'DUBOIS', 'Chloé', { classement: 5 }), {
        type: 'TireurModifie',
        donnees: { tireurId: 't1', club: 'Talence', classement: null },
      }),
    );
    expect(tireursDe(epreuve!)[0]).toMatchObject({ nom: 'DUBOIS', club: 'Talence', classement: null });
    const base = projeter(journal(inscrire('t1', 'DUBOIS', 'Chloé')));
    expect(verifierEvenement(base, { type: 'TireurModifie', donnees: { tireurId: 'x', club: 'A' } })).toBe(
      'TIREUR_INCONNU',
    );
    expect(verifierEvenement(base, { type: 'TireurModifie', donnees: { tireurId: 't1' } })).toBe('AUCUNE_MODIFICATION');
    expect(verifierEvenement(base, { type: 'TireurModifie', donnees: { tireurId: 't1', nom: '' } })).toBe(
      'TIREUR_NOM_VIDE',
    );
  });

  it('CA-3 : retirer un tireur ; tireur inconnu refusé', () => {
    const { epreuve } = projeter(
      journal(inscrire('t1', 'DUBOIS', 'Chloé'), inscrire('t2', 'MARTIN', 'Léa'), {
        type: 'TireurRetire',
        donnees: { tireurId: 't1' },
      }),
    );
    expect(tireursDe(epreuve!).map(({ id }) => id)).toEqual(['t2']);
    expect(verifierEvenement(projeter(journal()), { type: 'TireurRetire', donnees: { tireurId: 't1' } })).toBe(
      'TIREUR_INCONNU',
    );
  });

  it('CA-4 : pointer présent avec l’heure, puis remettre absent ; heure invalide refusée', () => {
    const pointe = projeter(
      journal(inscrire('t1', 'DUBOIS', 'Chloé'), {
        type: 'PresenceModifiee',
        donnees: { tireurId: 't1', present: true, heure: '08:41' },
      }),
    );
    expect(tireursDe(pointe.epreuve!)[0]).toMatchObject({ present: true, heure: '08:41' });
    const absent = appliquer(pointe, {
      ...enTete(4),
      type: 'PresenceModifiee',
      donnees: { tireurId: 't1', present: false },
    });
    expect(tireursDe(absent.epreuve!)[0]).toMatchObject({ present: false, heure: null });
    expect(verifierEvenement(pointe, { type: 'PresenceModifiee', donnees: { tireurId: 't1', present: true } })).toBe(
      'AUCUNE_MODIFICATION',
    );
    const base = projeter(journal(inscrire('t1', 'DUBOIS', 'Chloé')));
    expect(
      verifierEvenement(base, { type: 'PresenceModifiee', donnees: { tireurId: 't1', present: true, heure: '25:00' } }),
    ).toBe('HEURE_INVALIDE');
    expect(
      verifierEvenement(base, {
        type: 'PresenceModifiee',
        donnees: { tireurId: 't1', present: false, heure: '08:00' },
      }),
    ).toBe('HEURE_INVALIDE');
  });

  it('CA-5 : classement croissant, sans classement à la fin, puis nom et prénom sans accents ni casse', () => {
    const t = (nom: string, prenom: string, classement: number | null) => ({ nom, prenom, classement });
    expect(
      trierTireurs([t('ÉLIE', 'b', null), t('Zoé', 'a', 3), t('andré', 'a', null), t('MARTIN', 'a', 1)]).map(
        ({ nom }) => nom,
      ),
    ).toEqual(['MARTIN', 'Zoé', 'andré', 'ÉLIE']);
  });

  it('CA-6 : même licence = même tireur ; même nom et prénom = homonyme ; sinon nouveau', () => {
    const inscrits: Pick<Tireur, 'nom' | 'prenom' | 'licence'>[] = [
      { nom: 'MARTIN', prenom: 'Léa', licence: '111' },
      { nom: 'DUBOIS', prenom: 'Chloé', licence: null },
    ];
    expect(comparerTireur({ nom: 'Autre', prenom: 'Nom', licence: '111' }, inscrits).nature).toBe('meme');
    expect(comparerTireur({ nom: 'dubois', prenom: 'CHLOE' }, inscrits).nature).toBe('homonyme');
    expect(comparerTireur({ nom: 'MARTIN', prenom: 'Léa', licence: '222' }, inscrits).nature).toBe('homonyme');
    expect(comparerTireur({ nom: 'PETIT', prenom: 'Louise' }, inscrits).nature).toBe('nouveau');
  });

  it('CA-7 : inscriptions closes hors préparation ; archivée ; épreuve inconnue', () => {
    expect(inscriptionsOuvertes('preparation')).toBe(true);
    expect(inscriptionsOuvertes('enCours')).toBe(false);
    const enCours = projeter(journal());
    const fermee = { ...enCours, epreuve: { ...enCours.epreuve!, statut: 'enCours' as const } };
    expect(verifierEvenement(fermee, inscrire('t1', 'DUBOIS', 'Chloé'))).toBe('INSCRIPTIONS_CLOSES');
    const archivee = { ...enCours, epreuve: { ...enCours.epreuve!, statut: 'archivee' as const } };
    expect(verifierEvenement(archivee, inscrire('t1', 'DUBOIS', 'Chloé'))).toBe('EPREUVE_ARCHIVEE');
    expect(verifierEvenement({ epreuve: null, dernierSeq: 0, anomalie: null }, inscrire('t1', 'A', 'B'))).toBe(
      'EPREUVE_INCONNUE',
    );
  });

  it('cas limite : une projection gardée avant US-081 n’a pas de liste et vaut aucun inscrit', () => {
    const { epreuve } = projeter(journal());
    const ancienne: Partial<Epreuve> = { ...epreuve! };
    delete ancienne.tireurs;
    expect(tireursDe(ancienne as Epreuve)).toEqual([]);
    expect(validerTireur({ club: 'X'.repeat(61) })).toBe('TIREUR_CHAMP_TROP_LONG');
  });
});
