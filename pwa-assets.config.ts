import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

// Íconos de la PWA a partir del logo. El ícono recortable (Android) y el de iPhone llevan fondo azul PONTIA.
export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, resizeOptions: { background: '#10234b' } },
    apple: { ...minimal2023Preset.apple, resizeOptions: { background: '#10234b' } },
  },
  images: ['public/favicon.svg'],
});
