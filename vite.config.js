import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['assets/favicon.ico', 'assets/apple-touch-icon-180x180.png'],
      manifest: {
        name: 'MJ Beauty — Salón',
        short_name: 'MJ Beauty',
        description: 'Reserva citas y gestión del salón MJ Beauty.',
        lang: 'es',
        theme_color: '#e8649a',
        background_color: '#fdf8f4',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'assets/pwa-64x64.png',          sizes: '64x64',   type: 'image/png' },
          { src: 'assets/pwa-192x192.png',        sizes: '192x192', type: 'image/png' },
          { src: 'assets/pwa-512x512.png',        sizes: '512x512', type: 'image/png' },
          { src: 'assets/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Cachea HTML/CSS/JS y los assets estáticos para arranque instantáneo offline.
        globPatterns: ['**/*.{js,css,html,ico,png,jpg,jpeg,svg,webp,woff2}'],
        // No cachear las llamadas a Supabase: deben ser siempre frescas.
        navigateFallbackDenylist: [/^\/api\//, /supabase\.co/],
      },
    }),
  ],
  server: { port: 5173 },
});
