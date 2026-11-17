import { describe, expect, it } from 'vitest';
import { alertesGraves, verdictAudit, type ExceptionAudit, type RapportAudit } from './audit-exceptions';

const alerte = (id: string, paquet: string, severity: string) => ({
  name: paquet,
  title: `Alerte ${paquet}`,
  url: `https://github.com/advisories/${id}`,
  severity,
});

/** Un rapport proche de celui de npm : une alerte haute remonte par plusieurs paquets, plus une modérée. */
const rapport: RapportAudit = {
  vulnerabilities: {
    picomatch: { via: [alerte('GHSA-fc5q-39xc-vjpf', 'picomatch', 'high')] },
    vite: { via: ['picomatch'] },
    tinyglobby: { via: ['picomatch', alerte('GHSA-fc5q-39xc-vjpf', 'picomatch', 'high')] },
    glob: { via: [alerte('GHSA-3g3m-2fjr-6pw4', 'glob', 'moderate')] },
  },
};

const exception = (id: string, jusquAu: string): ExceptionAudit => ({
  id,
  paquet: 'picomatch',
  motif: 'test',
  jusquAu,
});

describe('audit des dépendances avec exceptions datées (ADR-0027)', () => {
  it('ne retient que les alertes hautes ou critiques, une fois chacune', () => {
    expect(alertesGraves(rapport).map(({ id }) => id)).toEqual(['GHSA-fc5q-39xc-vjpf']);
    expect(alertesGraves({})).toEqual([]);
  });

  it('une exception valable excuse son alerte, et seulement elle', () => {
    const avecCritique: RapportAudit = {
      vulnerabilities: {
        ...rapport.vulnerabilities,
        autre: { via: [alerte('GHSA-aaaa-bbbb-cccc', 'autre', 'critical')] },
      },
    };
    const verdict = verdictAudit(avecCritique, [exception('GHSA-fc5q-39xc-vjpf', '2026-12-01')], '2026-11-17');
    expect(verdict.excusees.map(({ id }) => id)).toEqual(['GHSA-fc5q-39xc-vjpf']);
    expect(verdict.bloquantes.map(({ id }) => id)).toEqual(['GHSA-aaaa-bbbb-cccc']);
    expect(verdict.expirees).toEqual([]);
  });

  it('l’exception vaut jusqu’à sa date incluse, puis l’alerte bloque de nouveau', () => {
    const exceptions = [exception('GHSA-fc5q-39xc-vjpf', '2026-12-01')];
    expect(verdictAudit(rapport, exceptions, '2026-12-01').bloquantes).toEqual([]);
    const apres = verdictAudit(rapport, exceptions, '2026-12-02');
    expect(apres.bloquantes.map(({ id }) => id)).toEqual(['GHSA-fc5q-39xc-vjpf']);
    expect(apres.expirees.map(({ id }) => id)).toEqual(['GHSA-fc5q-39xc-vjpf']);
  });

  it('sans exception, toute alerte haute bloque', () => {
    expect(verdictAudit(rapport, [], '2026-11-17').bloquantes).toHaveLength(1);
  });
});
