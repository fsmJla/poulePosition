import { defineProject } from 'vitest/config';

// Commandes d'administration (outils/) : le parcours complet démarre le Worker dans workerd.
export default defineProject({
  test: { name: 'outils', environment: 'node', testTimeout: 60_000, hookTimeout: 60_000 },
});
