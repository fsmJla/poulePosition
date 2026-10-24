import { defineProject } from 'vitest/config';

// Les tests d'intégration démarrent le Worker dans workerd (wrangler) : délai plus long.
export default defineProject({
  test: { name: 'serveur', environment: 'node', testTimeout: 30_000, hookTimeout: 60_000 },
});
