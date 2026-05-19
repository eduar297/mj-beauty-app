import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    // Fondo del logo (crema, matchea el tema rose). Se usa como base de los íconos maskable
    // para que el launcher de Android pueda recortarlo en círculo/cuadrado sin que quede vacío.
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { background: '#fdf8f4', fit: 'contain' },
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: { background: '#fdf8f4', fit: 'contain' },
    },
  },
  images: ['public/assets/logo.jpeg'],
});
