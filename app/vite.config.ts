// Build de l'application (ADR-0002) : Svelte 5, PWA précachée pour fonctionner hors ligne.
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icone.svg'],
      manifest: {
        name: 'poulePosition',
        short_name: 'poulePosition',
        description: "Organisation et suivi de compétitions d'escrime",
        lang: 'fr',
        display: 'standalone',
        theme_color: '#4b2a8c',
        background_color: '#ffffff',
        icons: [{ src: 'icone.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg}'], navigateFallback: 'index.html' },
    }),
  ],
});
