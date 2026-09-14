/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Ruta de publicación en GitHub Pages: https://fabian-ponton.github.io/eficiencia-energ-tica/
const base = '/eficiencia-energ-tica/';

export default defineConfig({
  base,
  plugins: [
    vue(),
    VitePWA({
      // Avisa de una versión nueva en lugar de recargar en plena auditoría
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon-180x180.png'],
      manifest: {
        id: base,
        name: 'PONTIA · Auditoría y eficiencia energética',
        short_name: 'PONTIA',
        description: 'Auditorías energéticas, PGEE y planes de implementación. Funciona sin conexión.',
        lang: 'es-CO',
        dir: 'ltr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        theme_color: '#10234b',
        background_color: '#eef1f5',
        categories: ['productivity', 'business', 'utilities'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
