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

/** Forme des données (US-025) ; les valeurs (arme connue, horaires cohérents…) sont des règles du domaine. */
function donneesValides(type: unknown, donnees: unknown): boolean {
  if (type !== 'CompetitionCreee') return false;
  const champs = aExactementLesChamps(donnees, CHAMPS_COMPETITION);
  if (!champs) return false;
  const { nom, arme, typeCompetition, categorie, sexe, date, lieu, commentaire } = champs;
  const horaires = aExactementLesChamps(champs.horaires, ['appel', 'scratch', 'debutPoules']);
  return (
    [nom, arme, typeCompetition].every((texte) => typeof texte === 'string') &&
    [categorie, sexe, date, lieu, commentaire].every(estTexteOuNull) &&
    horaires !== null &&
    Object.values(horaires).every(estTexteOuNull) &&
    estRattachement(champs.rattachement)
  );
}
