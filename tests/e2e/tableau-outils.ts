// Outils des tests du tableau (US-109 à US-115) : une épreuve « M13 Dames » dont les poules sont jouées, importée d'un
// fichier `.poule.json` (US-035) fabriqué ici, pour ne pas saisir 60 matchs de poule par l'interface. Ce PC en devient
// le pilote. Les données suivent la planche 11 : 24 tireuses de 6 clubs, 4 poules de 6, puis un tableau de 32.
import { expect, type Page } from '@playwright/test';
import {
  ordreDesMatchs,
  qualifiesDesPoules,
  structureTableau,
  tirerAuSort,
  type EtatPoules,
  type Proposition,
} from '@poule-position/domaine';
import { FORMAT_SAUVEGARDE, VERSION_JOURNAL, VERSION_SAUVEGARDE } from '@poule-position/protocole';
import { TIREUSES } from './poules-outils';

export const ID = (i: number) => `t${i + 1}`;

/** Le nom affiché d'une tireuse d'identifiant `t<n>` (« MARTIN Léa »). */
export function nomDe(id: string): string {
  const [nom, prenom] = TIREUSES[Number(id.slice(1)) - 1]!;
  return `${nom} ${prenom}`;
}

export interface OptionsPoules {
  /** Nombre de tireuses (6 à 24, par poules de 6). */
  nombre?: number;
  /** Matchs de poule laissés à tirer (les derniers). */
  aTirer?: number;
  /**
   * `distincts` : aucun ex aequo (chaque poule donne aux perdants un nombre de touches différent) ; `exaequo` : les
   * poules sont identiques, d'où des ex aequo parfaits entre poules.
   */
  classement?: 'distincts' | 'exaequo';
}

/** Les propositions qui inscrivent, pointent, répartissent en poules de 6 (serpentin), lancent et jouent les poules. */
export function poulesJouees({ nombre = 24, aTirer = 0, classement = 'distincts' }: OptionsPoules = {}): Proposition[] {
  const ids = Array.from({ length: nombre }, (_, i) => ID(i));
  const nbPoules = nombre / 6;
  const poules = Array.from({ length: nbPoules }, () => [] as string[]);
  ids.forEach((id, i) => {
    const tour = Math.floor(i / nbPoules);
    const rang = i % nbPoules;
    poules[tour % 2 === 0 ? rang : nbPoules - 1 - rang]!.push(id);
  });
  const propositions: Proposition[] = [];
  ids.forEach((id, i) => {
    const [nom, prenom, club] = TIREUSES[i]!;
    propositions.push(
      { type: 'TireurInscrit', donnees: { tireurId: id, nom, prenom, club, classement: i + 1 } },
      { type: 'PresenceModifiee', donnees: { tireurId: id, present: true, heure: '08:30' } },
    );
  });
  propositions.push(
    {
      type: 'PoulesComposees',
      donnees: { poules: poules.map((tireurIds, p) => ({ numero: p + 1, piste: p + 1, tireurIds })) },
    },
    { type: 'PoulesLancees', donnees: {} },
  );
  const scores: Proposition[] = [];
  poules.forEach((tireurIds, p) => {
    // Le perdant marque c touches : 3 − p (poules différentes, aucun ex aequo) ou 2 (poules identiques).
    const c = classement === 'distincts' ? 3 - (p % 4) : 2;
    for (const [i, j] of ordreDesMatchs(tireurIds.length)) {
      const [a, b] = [tireurIds[i - 1]!, tireurIds[j - 1]!];
      const gagneA = i < j;
      scores.push({
        type: 'ScorePouleSaisi',
        donnees: { poule: p + 1, tireurA: a, tireurB: b, touchesA: gagneA ? 5 : c, touchesB: gagneA ? c : 5 },
      });
    }
  });
  return [...propositions, ...scores.slice(0, scores.length - aTirer)];
}

/** L'ordre des qualifiées après les poules (ex aequo pris dans l'ordre du classement). */
export function ordreDesQualifiees(propositions: Proposition[], touches = 5): string[] {
  const etat: EtatPoules = { poules: [], lancees: false, scores: [], retraits: [] };
  for (const p of propositions) {
    if (p.type === 'PoulesComposees') etat.poules = p.donnees.poules;
    if (p.type === 'PoulesLancees') etat.lancees = true;
    if (p.type === 'ScorePouleSaisi') etat.scores.push({ ...p.donnees, auTemps: false });
    if (p.type === 'TireurRetireDesPoules') etat.retraits.push(p.donnees);
  }
  return tirerAuSort(qualifiesDesPoules(etat, touches), () => 0.99);
}

/** Les rangs d'un match : `rangs(32, [9, 24])` → l'identifiant du match du tableau de 32 entre les rangs 9 et 24. */
export function matchEntre(qualifies: readonly string[], tour: number, rangs: readonly [number, number]): string {
  const structure = structureTableau({ qualifies: [...qualifies], resultats: [], appels: [] }, false)!;
  const premier = structure.tours[0]!.taille;
  if (tour !== premier) throw new Error('matchEntre ne sert qu’au premier tour');
  const match = structure.tours[0]!.matchs.find(
    (m) => [m.haut.rang, m.bas.rang].sort((x, y) => x! - y!).join('-') === [...rangs].sort((x, y) => x - y).join('-'),
  );
  return match!.id;
}

/** Les résultats du tableau de la planche 11 : tableau de 32 terminé, tableau de 16 à 4/8, quarts 1 à tirer. */
export function resultatsPlanche11(qualifies: readonly string[]): Proposition[] {
  const id = (rang: number) => qualifies[rang - 1]!;
  const score = (match: string, a: number, b: number, ta: number, tb: number): Proposition => ({
    type: 'ScoreTableauSaisi',
    donnees: { match, tireurA: id(a), tireurB: id(b), touchesA: ta, touchesB: tb },
  });
  const appel = (match: string, piste: number): Proposition => ({
    type: 'MatchTableauAppele',
    donnees: { match, piste },
  });
  // Tableau de 32 : 9 à 16 battent 17 à 24, 15-10.
  const t32 = [9, 10, 11, 12, 13, 14, 15, 16].map((r) =>
    score(matchEntre(qualifies, 32, [r, 33 - r]), r, 33 - r, 15, 10),
  );
  // Tableau de 16, dans l'ordre de la planche : 1-16, 8-9, 5-12, 4-13, 3-14, 6-11, 7-10, 2-15.
  return [
    ...t32,
    score('16-1', 1, 16, 15, 8),
    score('16-2', 8, 9, 15, 13),
    score('16-3', 12, 5, 15, 12),
    score('16-8', 2, 15, 15, 6),
    appel('16-4', 4),
    appel('16-5', 3),
    appel('16-6', 1),
    appel('16-7', 2),
  ];
}

/** Le club et le compte de la session courante (lus dans IndexedDB). */
async function session(page: Page): Promise<{ clubId: string; email: string }> {
  return page.evaluate(async () => {
    const base = await new Promise<IDBDatabase>((ok, ko) => {
      const ouverture = indexedDB.open('poulePosition');
      ouverture.onsuccess = () => ok(ouverture.result);
      ouverture.onerror = () => ko(ouverture.error);
    });
    const lue = await new Promise<{ compte: { clubId: string; email: string } }>((ok) => {
      const lecture = base.transaction('session').objectStore('session').get('courante');
      lecture.onsuccess = () => ok(lecture.result);
    });
    base.close();
    return { clubId: lue.compte.clubId, email: lue.compte.email };
  });
}

/**
 * Importe une épreuve « M13 Dames » de sabre dont le journal suit `propositions`, et renvoie son adresse. Ce PC en est
 * le pilote (US-035).
 */
export async function importerEpreuve(page: Page, propositions: Proposition[]): Promise<string> {
  await page.goto('/organisateur');
  const { clubId, email } = await session(page);
  const epreuveId = crypto.randomUUID();
  const nom = `E2E ${epreuveId.slice(0, 8)} M13 Dames`;
  const debut = Date.now() - 3_600_000;
  const creation: Proposition = {
    type: 'EpreuveCreee',
    donnees: {
      nom,
      arme: 'sabre',
      typeEpreuve: 'individuelle',
      categorie: 'M13',
      sexe: 'dames',
      date: null,
      horaires: { appel: null, scratch: null, debutPoules: null },
      lieu: null,
      commentaire: null,
      rattachement: { competitionId: 'e2e-tableau' },
    },
  };
  const journal = [creation, ...propositions].map((p, i) => ({
    epreuveId,
    clubId,
    seq: i + 1,
    version: VERSION_JOURNAL,
    date: debut + i * 1000,
    auteur: email,
    source: 'clavier',
    ...p,
  }));
  const sauvegarde = {
    format: FORMAT_SAUVEGARDE,
    version: VERSION_SAUVEGARDE,
    exporteLe: Date.now(),
    epreuveId,
    clubId,
    journal,
    competition: null,
    manifestation: null,
    fichiers: [],
  };
  await page.locator('input[data-import]').setInputFiles({
    name: 'tableau.poule.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(sauvegarde), 'utf-8'),
  });
  await page.getByRole('dialog').getByRole('button', { name: 'Importer', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/epreuves/${epreuveId}$`), { timeout: 20_000 });
  return page.url();
}

/** Ouvre l'étape « Tableau » par la navigation de l'épreuve. */
export async function ouvrirTableau(page: Page) {
  await page
    .getByRole('navigation', { name: 'Étapes de l’épreuve' })
    .getByRole('link', { name: /^Tableau/ })
    .click();
  await expect(page.getByRole('heading', { level: 2, name: 'Tableau' })).toBeVisible({ timeout: 20_000 });
}
