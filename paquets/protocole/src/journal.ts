// Format du journal d'une compétition (docs/protocole.md, US-021) : enveloppe versionnée des événements, partagée par
// le PC pilote (IndexedDB) et le serveur (réplication, US-022). Un ancien format est migré à la lecture, sans réécrire
// le journal (ADR-0001).
import type { Evenement } from '@poule-position/domaine';
import { aExactementLesChamps, estRattachement, estTexteOuNull } from './validation';

/** Version courante du format des événements. */
export const VERSION_JOURNAL = 1;

/** Passage d'un événement de la version `n` (la clé) à la version `n + 1`. */
export type Migrations = Readonly<Record<number, (ancien: Record<string, unknown>) => Record<string, unknown>>>;

/** Aucune migration tant que le format n'a pas changé. */
export const MIGRATIONS: Migrations = {};

const CHAMPS = ['competitionId', 'clubId', 'seq', 'version', 'date', 'auteur', 'source', 'type', 'donnees'];

/** Événement lu depuis le stockage ou le réseau, migré vers la version courante ; null s'il est illisible. */
export function lireEvenement(brut: unknown, migrations: Migrations = MIGRATIONS): Evenement | null {
  let objet = aExactementLesChamps(brut, CHAMPS);
  while (objet && typeof objet.version === 'number' && objet.version < VERSION_JOURNAL) {
    const migrer = migrations[objet.version];
    objet = migrer ? aExactementLesChamps(migrer(objet), CHAMPS) : null;
  }
  return objet && estEvenement(objet) ? objet : null;
}

function estEvenement(objet: Record<string, unknown>): objet is Evenement {
  const { competitionId, clubId, seq, version, date, auteur, source } = objet;
  return (
    [competitionId, clubId, auteur].every((texte) => typeof texte === 'string' && texte !== '') &&
    Number.isInteger(seq) &&
    (seq as number) >= 1 &&
    version === VERSION_JOURNAL &&
    Number.isFinite(date) &&
    source === 'clavier' &&
    donneesValides(objet.type, objet.donnees)
  );
}

const CHAMPS_COMPETITION = [
  'nom',
  'arme',
  'typeCompetition',
  'categorie',
  'sexe',
  'date',
  'horaires',
  'lieu',
  'commentaire',
  'rattachement',
];

const estTexte = (valeur: unknown) => typeof valeur === 'string';

/** Forme de chaque champ (US-025) ; les valeurs (arme connue, horaires cohérents…) sont des règles du domaine. */
const FORMES: Record<string, (valeur: unknown) => boolean> = {
  nom: estTexte,
  arme: estTexte,
  typeCompetition: estTexte,
  categorie: estTexteOuNull,
  sexe: estTexteOuNull,
  date: estTexteOuNull,
  lieu: estTexteOuNull,
  commentaire: estTexteOuNull,
  horaires: (valeur) => {
    const horaires = aExactementLesChamps(valeur, ['appel', 'scratch', 'debutPoules']);
    return horaires !== null && Object.values(horaires).every(estTexteOuNull);
  },
  rattachement: estRattachement,
};

/** Forme de chaque réglage de `FormuleModifiee` (US-028) ; les bornes sont des règles du domaine. */
const FORMES_FORMULE: Record<string, (valeur: unknown) => boolean> = {
  touchesPoules: Number.isInteger,
  touchesTableau: Number.isInteger,
  matchTroisieme: (valeur) => typeof valeur === 'boolean',
};

/**
 * Forme des données : tous les champs pour `CompetitionCreee` ; pour `CompetitionModifiee` (US-027) et
 * `FormuleModifiee` (US-028), un ou plusieurs champs parmi les leurs, ceux qui ont changé.
 */
function donneesValides(type: unknown, donnees: unknown): boolean {
  if (type === 'PiloteChange') {
    const pilote = aExactementLesChamps(donnees, ['ancienAppareil', 'nouvelAppareil']);
    return pilote !== null && Object.values(pilote).every(estTexte);
  }
  if (type !== 'CompetitionCreee' && type !== 'CompetitionModifiee' && type !== 'FormuleModifiee') return false;
  if (donnees === null || typeof donnees !== 'object' || Array.isArray(donnees)) return false;
  const noms = Object.keys(donnees);
  const attendus = type === 'CompetitionCreee' ? noms.length === CHAMPS_COMPETITION.length : noms.length > 0;
  const formes = type === 'FormuleModifiee' ? FORMES_FORMULE : FORMES;
  return (
    attendus &&
    noms.every((nom) => Object.hasOwn(formes, nom) && formes[nom]!((donnees as Record<string, unknown>)[nom]))
  );
}
