// Audit des dépendances avec exceptions ciblées et datées (ADR-0027, complète l'ADR-0012). Logique pure : à partir du
// rapport `npm audit --json`, les alertes hautes ou critiques qui bloquent encore. Une exception ne vaut que pour UNE
// alerte (son identifiant GHSA) et jusqu'à sa date d'expiration incluse ; au-delà, l'alerte bloque de nouveau.

/** Une exception de `outils/exceptions-audit.json`. */
export interface ExceptionAudit {
  /** Identifiant de l'alerte, `GHSA-xxxx-xxxx-xxxx`. */
  id: string;
  paquet: string;
  motif: string;
  /** Dernier jour où l'exception vaut, `AAAA-MM-JJ`. */
  jusquAu: string;
}

/** Une alerte du rapport `npm audit --json` (objet de `via`). */
interface AlerteNpm {
  name: string;
  title: string;
  url: string;
  severity: string;
}

/** Ce que l'outil lit du rapport `npm audit --json`. */
export interface RapportAudit {
  vulnerabilities?: Record<string, { via: (AlerteNpm | string)[] }>;
}

export interface Alerte {
  id: string;
  paquet: string;
  titre: string;
  gravite: string;
}

export interface VerdictAudit {
  /** Alertes hautes ou critiques sans exception valable : l'audit échoue s'il y en a. */
  bloquantes: Alerte[];
  /** Alertes couvertes par une exception encore valable. */
  excusees: Alerte[];
  /** Exceptions dont la date est passée (elles ne couvrent plus rien). */
  expirees: ExceptionAudit[];
}

const GRAVES = new Set(['high', 'critical']);

/** L'identifiant GHSA d'une alerte, tiré de son adresse `https://github.com/advisories/GHSA-…`. */
const identifiant = (url: string) => url.split('/').pop() ?? url;

/** Les alertes hautes ou critiques du rapport, une fois chacune (une alerte remonte par plusieurs paquets). */
export function alertesGraves(rapport: RapportAudit): Alerte[] {
  const alertes = new Map<string, Alerte>();
  for (const { via } of Object.values(rapport.vulnerabilities ?? {})) {
    for (const source of via) {
      if (typeof source === 'string' || !GRAVES.has(source.severity)) continue;
      const id = identifiant(source.url);
      alertes.set(id, { id, paquet: source.name, titre: source.title, gravite: source.severity });
    }
  }
  return [...alertes.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Le verdict de l'audit au jour `aujourdhui` (`AAAA-MM-JJ`). */
export function verdictAudit(
  rapport: RapportAudit,
  exceptions: readonly ExceptionAudit[],
  aujourdhui: string,
): VerdictAudit {
  const valables = new Set(exceptions.filter(({ jusquAu }) => aujourdhui <= jusquAu).map(({ id }) => id));
  const verdict: VerdictAudit = {
    bloquantes: [],
    excusees: [],
    expirees: exceptions.filter(({ jusquAu }) => aujourdhui > jusquAu),
  };
  for (const alerte of alertesGraves(rapport)) {
    (valables.has(alerte.id) ? verdict.excusees : verdict.bloquantes).push(alerte);
  }
  return verdict;
}
