// Tests unitaires de tout le monorepo, avec les seuils de couverture bloquants de l'ADR-0012.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'paquets/domaine',
      'paquets/protocole',
      'serveur',
      'app',
      'outils',
      { test: { name: 'garde-fous', include: ['tests/garde-fous/**/*.test.ts'], environment: 'node' } },
    ],
    coverage: {
      provider: 'v8',
      // Code exécuté sous Node. Le Worker et ses Durable Objects (index.ts, competition.ts) tournent dans
      // workerd : ils sont couverts par les tests d'intégration du serveur, non mesurés ici.
      include: [
        'paquets/*/src/**/*.ts',
        'serveur/src/logique.ts',
        'serveur/src/courriel.ts',
        'serveur/src/gabarits.ts',
        'serveur/src/replication.ts',
        'app/src/lib/**/*.ts',
        'outils/**/*.ts',
      ],
      exclude: ['**/*.test.ts', '**/vitest.config.ts'],
      reporter: ['text', 'html'],
      thresholds: {
        lines: 70,
        branches: 70,
        functions: 70,
        statements: 70,
        'paquets/domaine/src/**': { lines: 90, branches: 90, functions: 90, statements: 90 },
        'paquets/protocole/src/**': { lines: 80, branches: 80, functions: 80, statements: 80 },
        'serveur/src/logique.ts': { lines: 80, branches: 80, functions: 80, statements: 80 },
        'serveur/src/courriel.ts': { lines: 80, branches: 80, functions: 80, statements: 80 },
        'serveur/src/gabarits.ts': { lines: 80, branches: 80, functions: 80, statements: 80 },
        'serveur/src/replication.ts': { lines: 80, branches: 80, functions: 80, statements: 80 },
      },
    },
  },
});
