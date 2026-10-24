// Tests de la logique pure du relais (sans environnement Cloudflare).
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { environment: 'node' } });
