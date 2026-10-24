import { defineProject } from 'vitest/config';

// Tests unitaires de la logique de l'application (app/src/lib), sans composant Svelte.
export default defineProject({ test: { name: 'app', environment: 'node', include: ['src/**/*.test.ts'] } });
