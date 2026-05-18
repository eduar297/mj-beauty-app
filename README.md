# MJ Beauty — App React + Supabase + Vercel

App moderna para tu salón: web pública para reservas + panel de gestión con login por PIN, todo conectado a Supabase con actualizaciones en tiempo real.

## ⚡ Stack

- **Vite + React 18** — frontend rápido
- **Tailwind CSS** + variables CSS — estilos
- **React Router** — `/`, `/servicios`, `/login`, `/dashboard/*`
- **Supabase** — DB Postgres + Storage + Realtime
- **Auth por PIN** (4–6 dígitos) — sin contraseñas, simple para empleadas

## 🚀 Setup en 5 pasos

### 1. Crea el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) → New Project
2. Cuando esté listo, ve a **SQL Editor** → New query
3. Copia y pega TODO el contenido de `supabase/schema.sql` y dale **Run**
4. Esto crea las tablas, activa Realtime y deja un admin con PIN `1234`

### 2. Copia tus claves Supabase

En Supabase → **Settings → API**:
- `Project URL` → será tu `VITE_SUPABASE_URL`
- `anon public key` → será tu `VITE_SUPABASE_ANON_KEY`

### 3. Configura local

```bash
cd mj-beauty-app
cp .env.example .env.local
# Edita .env.local y pega tus claves
npm install
npm run dev
```

Abre http://localhost:5173 — entra con PIN **1234**.

### 4. Sube a GitHub

```bash
git init
git add .
git commit -m "MJ Beauty initial"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/mj-beauty.git
git push -u origin main
```

### 5. Despliega en Vercel

1. [vercel.com](https://vercel.com) → New Project → importa tu repo
2. **Framework Preset:** Vite (autodetectado)
3. **Environment Variables** — agrega:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. En 30s tendrás `mj-beauty.vercel.app` online.

## 🔐 Cambia el PIN del admin

Tras tu primer login, ve a **Empleadas** → toca tu tarjeta → cambia el PIN.

## 📁 Estructura

```
src/
├── components/ui.jsx           Iconos, Modal, Btn, Avatar, etc.
├── hooks/useAuth.jsx           Auth por PIN + localStorage
├── lib/
│   ├── supabase.js             Cliente
│   └── api.js                  Queries (staff, clients, services, etc.)
├── pages/
│   ├── Landing.jsx             Web pública
│   ├── Services.jsx            Listado público
│   ├── Login.jsx               Numpad PIN
│   ├── Dashboard.jsx           Shell con sidebar/drawer/tabs
│   └── dashboard/
│       ├── Agenda.jsx          ← realtime
│       ├── Clientes.jsx
│       ├── Servicios.jsx       ← upload de fotos
│       ├── Empleadas.jsx
│       └── Caja.jsx            ← realtime
└── styles/globals.css
```

## 🎨 Temas

`localStorage.setItem('mj-theme', 'noir' | 'rose' | 'minimal')` — recarga.

## 🆘 Si algo falla

- **PIN no funciona** → revisa que el SQL corrió bien (tabla `staff` debe tener una fila)
- **Fotos no suben** → en Supabase → Storage → bucket `services` debe ser **public**
- **Realtime no actualiza** → el SQL ya hace `alter publication supabase_realtime add table…`. Verifica en Supabase → Database → Replication
- **404 en Vercel al recargar** → ya está cubierto por `vercel.json` (rewrites SPA)

¡Listo para producción! 💄
