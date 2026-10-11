import { defineConfig, loadEnv } from 'vite';
import { askJev } from './api/_jev-core.js';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';


// En producción /api/jev lo sirve Vercel (api/jev.js). En desarrollo no hay
// serverless, así que se monta el MISMO núcleo como middleware para que las
// dos se comporten igual. La clave se lee aquí, en Node: nunca llega al
// bundle del navegador.
function jevDevApi(key) {
  return {
    name: 'jev-dev-api',
    configureServer(server) {
      server.middlewares.use('/api/jev', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Usa POST.' }));
          return;
        }
        let raw = '';
        for await (const chunk of req) raw += chunk;
        let parsed = {};
        try { parsed = JSON.parse(raw || '{}'); } catch {}
        const out = await askJev({ kind: parsed.kind, data: parsed.data, key });
        res.statusCode = out.status;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(out.body));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  // '' como prefijo = también las variables sin VITE_ (solo para uso en Node).
  const env = loadEnv(mode, process.cwd(), '');
  return {
  plugins: [
    react(),
    jevDevApi(env.TYPESAFE_API_KEY),
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
  };
});
