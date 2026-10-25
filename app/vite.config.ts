// Build de l'application (ADR-0002) : Svelte 5, PWA précachée pour fonctionner hors ligne.
// Icônes et couleurs du manifeste : pack d'icônes poulePosition et charte « Calme rétro » (US-011).
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'icons/*.svg'],
      manifest: {
        // Nom affiché (US-014) ; le nom technique reste poulePosition.
        name: 'Poule Position',
        short_name: 'Poule Position',
        description: "Organisation et suivi de compétitions d'escrime",
        lang: 'fr',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: '#2F4B4A',
        background_color: '#F7F4EF',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      // Polices (woff2), icônes et manifeste sont précachés : même style hors ligne (US-011).
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2,png,ico}'], navigateFallback: 'index.html' },
    }),
  ],
});
