// Nom court d'une épreuve sous sa compétition (US-055 CA-3) : « catégorie + sexe » (« M13 Dames »). Le nom complet de
// l'épreuve n'est pas modifié : il reste celui du fil d'Ariane, des confirmations et de la page de l'épreuve.
import type { Sexe } from './epreuve';

export interface EpreuveNommable {
  id: string;
  nom: string;
  categorie: string | null;
  sexe: Sexe | null;
}

/**
 * Noms courts des épreuves **d'une même compétition**, par identifiant. Sans catégorie ou sans sexe, ou si deux épreuves
 * auraient le même nom court, l'épreuve garde son nom complet (le type, qui les distinguerait, n'est pas dans l'index).
 */
export function nomsCourts(
  epreuves: readonly EpreuveNommable[],
  libellesSexe: Readonly<Record<Sexe, string>>,
): Map<string, string> {
  const propositions = epreuves.map((epreuve) => {
    const categorie = epreuve.categorie?.trim();
    return { epreuve, court: categorie && epreuve.sexe ? `${categorie} ${libellesSexe[epreuve.sexe]}` : null };
  });
  const occurrences = new Map<string, number>();
  for (const { court } of propositions) if (court) occurrences.set(court, (occurrences.get(court) ?? 0) + 1);
  return new Map(
    propositions.map(({ epreuve, court }) => [epreuve.id, court && occurrences.get(court) === 1 ? court : epreuve.nom]),
  );
}
