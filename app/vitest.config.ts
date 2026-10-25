import { defineProject } from 'vitest/config';

// Tests unitaires de la logique de l'application (app/src/lib), sans composant Svelte.
// CSS traité : le test de la charte (US-011) lit app.css par un import `?raw`.
export default defineProject({
  test: { name: 'app', environment: 'node', include: ['src/**/*.test.ts'], css: { include: [/app\.css/] } },
});
