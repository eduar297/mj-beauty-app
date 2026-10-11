// Función serverless de Vercel: POST /api/jev
// La clave se configura en Vercel → Settings → Environment Variables como
// TYPESAFE_API_KEY (sin prefijo VITE_, para que no entre en el bundle).
import { askJev } from './_jev-core.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Usa POST.' });
    return;
  }
  const { kind, data } = req.body || {};
  const out = await askJev({ kind, data, key: process.env.TYPESAFE_API_KEY });
  res.status(out.status).json(out.body);
}
