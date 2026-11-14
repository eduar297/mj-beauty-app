# Plan definitivo: More Hub como plataforma (tienda + servicios + landings personalizables)

Escrito el **14 de noviembre de 2026** tras analizar a fondo los cuatro repos:
`mj-beauty-app`, `more-hub2` (app), `more-hub-admin` (panel master) y `more-hub-web` (web pública).

> Objetivo: cuando llegue un cliente nuevo, **en un día** le enseñas un catálogo de landings, se la
> personalizas con clics, le activas los módulos que necesita (tienda, servicios o ambos, con uno o
> varios locales), le despliegas la web con su dominio desde tu panel, le das la app de gestión que
> funciona sin internet, y cobras.

---

## 1. La decisión: no construir una plataforma nueva. **More Hub ES la plataforma.**

### Lo que encontré al analizar

| | MJ Beauty | More Hub |
|---|---|---|
| Tipo | Web (Vite + React), un solo negocio | App Expo offline + panel master + web pública, **multi-negocio** |
| Madurez | Buena lógica de salón, sin tests | **2.404 tests**, 84 migraciones de tenant, 43 de master, clientes reales (DIEZ67 market…) |
| Seguridad | `anon_all` en todas las tablas; sesión del PIN en `localStorage` | RLS por `business_id` con `using` + `with check`, `business_id` inmutable, permisos por persona (`mh_can()`) |
| Offline | No | Sí: SQLite + Drizzle + cola, reloj que no retrocede, P2P por WiFi, timeouts para la red de Cuba |
| Master / tenants | No | Sí: pool de proyectos Supabase, varios negocios por tenant, provisionado y "Actualizar todos" por API |
| Licencias y cobros | No | Sí: estados, vencimientos, `entitlements`, precios, pagos, MRR, IA de pago con topes |
| Tienda | Catálogo + productos | POS completo: variantes, lotes, compras, traslados, cierres de turno, cajas, monedas, fiado, pedidos al almacén |
| Varios locales | No | Sí: **puntos de venta** con stock y caja por punto, y "Todos" |
| Personal | PIN por empleada, pago por trabajadora | Dependientes con clave, permisos, salarios, "solo ve lo de su turno" |
| Costos | Insumos por servicio | Fichas de costo y recetas |
| **Servicios / agenda / reservas** | **Sí, muy completo** (disponibilidad, horarios, días cerrados, varios servicios por cita, aviso Telegram) | **No existe** |
| Reseñas, galería antes/después, temporada | Sí | No |
| Web pública | Landing de salón muy cuidada, editable por campos | Catálogo de tienda (Next 15, SSR + ISR, ligera para Cuba), tema por negocio, **sin editor visual** |
| IA | Jev para finanzas | Asistente y "decisión" con Jev, ya **cobrados como extra** con topes por negocio |

### Por qué More Hub y no una plataforma nueva

1. **El 70 % de lo que pediste ya existe en More Hub y está probado en la calle**: master, tenants con
   varios negocios, credenciales cifradas, licencias, pausar y suspender, cobros, módulos de pago,
   app offline con cola, varios puntos (tus "locales" con finanzas por punto o juntas), monedas, cajas
   y permisos. Rehacerlo costaría meses y repetiría errores que More Hub ya pagó (el cierre de los 900
   pesos, los 262.990 CUP del reloj atrasado, las migraciones que se marcaban en verde a medias…).
2. **Lo que falta es acotado y es justo lo que MJ hace bien**: servicios, agenda, reservas online,
   reseñas, galería. Se **porta** la lógica de MJ (`availability.js`, `duration.js`, `dates.js`) como
   un módulo nuevo de More Hub.
3. **Un solo sistema que mantener.** Con dos plataformas parecidas, cada arreglo se haría dos veces.
4. **Tus clientes en Cuba gestionan desde el teléfono** (el propio More Hub lo documenta: "nuestros
   clientes no tienen computadora") y con mala conexión. La app offline es la respuesta correcta.
5. **La IA ya es un extra de pago** en More Hub. Jev queda para MJ y para quien lo pague.

### El riesgo y cómo se controla
More Hub tiene clientes reales. Todo lo nuevo entra **apagado por defecto** y detrás de módulos:
- Tablas nuevas (no cambios en las que ya existen) y columnas nuevas en `OPCIONALES_NULAS`, para que
  ningún negocio que no use servicios deje de sincronizar.
- Migraciones re-ejecutables, con sus tests de esquema, igual que hoy.
- Pestañas nuevas que solo aparecen si el negocio tiene el módulo.
- Se prueba primero con **MJ como cliente piloto** antes de ofrecerlo.

---

## 2. Cómo queda el sistema

```
                 ┌─────────────────────────────────────────────────────┐
                 │  PANEL MASTER (more-hub-admin) — solo tú             │
                 │  negocios · módulos · licencias · cobros · tenants   │
                 │  NUEVO: cuentas Vercel · sitios · dominios · uso ·   │
                 │         catálogo de plantillas · "Editar landing"    │
                 └──────────────────────┬──────────────────────────────┘
                                        │
                        ┌───────────────▼────────────────┐
                        │  SUPABASE MASTER (directorio)   │
                        └───────┬───────────────┬────────┘
                                │               │
            ┌───────────────────▼──┐      ┌─────▼──────────────────────────────┐
            │ POOL TENANTS SUPABASE │      │ POOL CUENTAS VERCEL                 │
            │ varios negocios por   │      │ un proyecto por cliente (dominio    │
            │ proyecto (business_id)│      │ propio), mismo código more-hub-web  │
            └───────▲───────────▲───┘      └─────────────┬───────────────────────┘
                    │           │                        │
       sync offline │           │ lectura pública        │
        (cola)      │           │ + reservas (RPC)       │
         ┌──────────┴───┐   ┌───┴────────────────────────▼───┐
         │ APP MORE HUB  │   │ WEB (more-hub-web)              │
         │ (Expo)        │   │ landing con bloques (Puck)      │
         │ gestión sin   │   │ tienda · servicios · reservar   │
         │ internet      │   │ + EDITOR VISUAL /editor         │
         └───────────────┘   └─────────────────────────────────┘
```

**Quién hace qué:**
- **App (more-hub2)**: toda la gestión, sin internet. Lo que el negocio cambia en la app (precios,
  productos, servicios, horarios, fotos, contacto, abrir/cerrar) aparece en la web en cuanto sincroniza,
  porque los bloques de la landing leen esos datos en vivo.
- **Web (more-hub-web)**: la landing que el negocio manda a sus clientes, con reservas y tienda. También
  aloja el **editor visual** (diseño y estructura de la landing).
- **Panel master (more-hub-admin)**: tú. Alta de clientes, módulos, despliegues, uso, cobros.

---

## 3. Módulos

Se guardan como `entitlements` en el master (el mismo mecanismo que ya cobra Nube, Web y Equipos extra),
y la app y la web se arman según lo activo. Desactivar **oculta**, no borra.

| Módulo | Estado | Contenido |
|---|---|---|
| `tienda` | ✅ existe (es More Hub hoy) | POS, inventario, compras, traslados, cierres, cajas, monedas, fiado, pedidos |
| `puntos` (locales) | ✅ existe | Stock y caja por punto, filtro por punto o "Todos" |
| `personal` | ✅ existe | Dependientes, claves, permisos, salarios |
| `clientes`, `reportes`, `gastos` | ✅ existen | — |
| `web` | ✅ existe → **se amplía** | Landing con bloques, editor, dominio propio |
| `servicios` | 🆕 de MJ | Servicios, categorías, duración y precio (con rangos), fotos, quién hace qué |
| `agenda` | 🆕 de MJ | Citas con varios servicios, disponibilidad, horario semanal por persona, ausencias, días cerrados, estados |
| `reservas_online` | 🆕 de MJ | Reservar desde la landing, confirmar/cancelar desde la app, aviso al instante |
| `resenas`, `galeria` | 🆕 de MJ | Reseñas moderadas, fotos antes/después |
| `insumos_por_servicio` | 🆕 se apoya en las fichas de costo | Costo real de cada servicio |
| `temporada` | 🆕 de MJ | Decoración de la web (Navidad, San Valentín…) |
| `asistente` / `decision` (IA, Jev) | ✅ existe, de pago | Solo MJ y quien lo pague |

**Combinaciones**: solo tienda (More Hub de hoy) · solo servicios (salón, barbería, spa, consultorio) ·
servicios + tienda (MJ) · cualquiera con uno o varios puntos.

**Cómo encaja una cita con lo que ya existe**: al completar una cita se **cobra como una venta** del
punto (con sus servicios como renglones y los productos que se lleve), así entra sola en la caja, el
cierre de turno, las monedas y los reportes de More Hub. No se duplica la caja de MJ.

---

## 4. La landing: kit de bloques + editor visual

### Pieza elegida: Puck
`@puckeditor/core` 0.24 (MIT, ~13k ⭐, React 19, Next): editor de arrastrar y soltar que usa **nuestros**
componentes y guarda la página como JSON. La web lo pinta con `<Render>` en el servidor (SSR + ISR,
como ya hace more-hub-web), así sigue siendo ligera para Cuba y sale bien la vista previa en WhatsApp.
Descartados: Craft.js (más trabajo), GrapesJS (HTML suelto, sin datos vivos), Webstudio/Plasmic/Onlook
(productos enteros), Builder.io (cerrado).

### Cómo se logra que ninguna sea igual
Landing = **bloques** × **variante** × **tema** × **orden** × **contenido**. ~20 bloques con 3–5
variantes y temas libres. Si un cliente quiere algo único, se crea un bloque nuevo y queda para todos.

**Bloques**: Navegación · Portada (centrada, dividida, collage, video, editorial, carrusel) ·
Catálogo de tienda *(vivo; se reutiliza el `Storefront` actual)* · Servicios *(vivo)* · Reservar
*(vivo)* · Equipo *(vivo)* · Puntos/Locales con mapa y horario *(vivo)* · Reseñas *(vivo)* · Galería y
antes/después *(vivo)* · Sobre nosotros · Promo/cuenta regresiva · Preguntas frecuentes · Precios y
paquetes · Contacto · Texto · Imagen · Columnas (bloques dentro de bloques) · Espaciador · Pie ·
Temporada.

**Campo "Enlace"**: ir a sección · página interna · abrir reserva · WhatsApp con mensaje · llamar ·
correo · URL externa · producto o servicio concreto.

**Motor de temas**: paleta generada en OKLCH desde 1–2 colores de marca (con contraste medido, como ya
hace `theme.test.ts` en la app), pares de fuentes curados y auto-alojados (como ya hace more-hub-web),
bordes, sombras, densidad, estilo de botones e imágenes. Presets: *Rosa* (MJ), *Noir lujo*, *Minimal
editorial*, *Orgánico spa*, *Urbano barbería*, *Pastel*, *Bodega moderna*, *Teal More Hub*…

**Páginas**: varias por negocio, borrador y publicada, historial, duplicar, guardar como plantilla.

### Dónde se edita
| Quién | Dónde | Qué |
|---|---|---|
| Tú | `more-hub-web/editor/<negocio>` (botón "Editar landing" en el panel) | Todo |
| El cliente | La app (sin internet, en cola) | Contenido vivo: productos, servicios, precios, horarios, fotos, contacto, publicar/ocultar |
| El cliente (opcional, por negocio) | El mismo editor web con permisos limitados | Textos e imágenes de los bloques, sin tocar estructura |

**Cómo guarda el editor sin exponer secretos**: el editor entra con tu usuario del master; guarda por
una Edge Function nueva del master (`site-save`) que comprueba que eres admin, descifra la service_role
del tenant y escribe el JSON. Así los bloques viven en un solo repo (la web) y los secretos no salen
del master.

**Dónde vive la página**: tabla nueva del tenant `website_pages` (`business_id`, ruta, `draft`,
`published`, versión), lectura pública solo de lo publicado. Las plantillas del catálogo viven en el
master (`site_templates`).

### Flujo "en un día"
1. Panel → **Nuevo negocio** (rubro, módulos, puntos, moneda, tenant con hueco).
2. **Catálogo de plantillas** (capturas automáticas con Playwright + "ver demo") → elige una.
3. **Editar landing** → "¿te gusta así? → cámbiale esto".
4. **Link de vista previa** (sin publicar) por WhatsApp.
5. Aprueba → **Publicar** → **Crear sitio** en Vercel con su dominio → código de activación para la app.

---

## 5. Despliegue: un proyecto Vercel por cliente, desde el panel

- **Pool de cuentas Vercel** en el master (token cifrado con la misma AES-256-GCM, team id, nº de
  proyectos), igual que el pool de tenants Supabase.
- Cada cliente = **un proyecto** del mismo repo `more-hub-web` con la variable `BUSINESS_ID` y su
  dominio. La web resuelve el negocio así: `BUSINESS_ID` fijo → dominio → ruta `/<business_id>` (la de
  hoy, que se mantiene para `web.morehub.app/<id>`).
- **Botones del panel** (API de Vercel / `@vercel/sdk`): Crear sitio · Desplegar · Dominio (con los DNS
  a poner y la verificación) · Pausar/Reanudar · **Actualizar todos** (informe paso a paso, como el de
  tenants) · Eliminar.
- **Build**: un GitHub Action disparado desde el panel construye una vez y hace
  `vercel deploy --prebuilt --prod` a cada proyecto con el token de su cuenta. No hace falta conectar el
  repo a cada cuenta de Vercel.
- **Pausar/suspender** es primero un estado del master (la web muestra "temporalmente fuera de servicio"
  y la app avisa, como ya pasa con las licencias); pausar el proyecto en Vercel es opcional.
- **Editar la landing no requiere redeploy**: se revalida la página al publicar.

**Costos/condiciones**: el plan Hobby de Vercel es solo no comercial; lo seguro son pocas cuentas
**Pro (20 USD/mes)** con muchos proyectos cada una. En Supabase, varios negocios por tenant Pro
(~25 USD/mes) como ya hace More Hub.

---

## 6. Uso: qué hace cada cliente

Hoy el master ya sabe versión de la app y última vez visto (master 018). Se añade:
- `usage_daily` en el master: por negocio y día, citas, reservas online, ventas, importe, productos y
  servicios activos, personas activas, fotos/almacenamiento, visitas a la web y reservas que vinieron
  de ella. La recoge un job diario con la service_role de cada tenant; las visitas las cuenta la web con
  un endpoint ligero sin cookies.
- En el panel: ficha de uso por negocio, ranking, **avisos** de negocios sin actividad (riesgo de baja),
  sitios con errores y licencias por vencer (esto último ya existe).

---

## 7. Fases

| # | Repo | Qué | Hecho cuando |
|---|---|---|---|
| 0 | todos | Ramas, skills de diseño instaladas, este plan movido a `more-hub2/docs/PLAN-SERVICIOS-Y-WEB.md` | — |
| 1 | more-hub2 (`supabase/tenant`) | Migraciones del módulo servicios: `services`, `service_categories`, `service_staff`, `appointments`, `appointment_services`, `staff_hours`, `staff_time_off`, `closed_days`, `reviews`, `gallery_photos`, `website_pages`; todo con `business_id`, `punto_id` donde toque, RLS, RPC públicas de reserva y disponibilidad; tests de esquema; vendorear al panel | Un tenant de prueba con dos negocios aislados y una reserva hecha por RPC |
| 2 | more-hub-admin + master | `entitlements` de los módulos nuevos, interruptores por negocio, presets por rubro (salón, barbería, spa, uñas, tienda) | Activas "servicios" a un negocio desde el panel |
| 3 | more-hub2 (app) | Pantallas: Servicios, Agenda (día/semana, por persona), Reservas pendientes, horario por persona, cobrar la cita como venta; lógica portada de MJ con tests; tablas en la cola de sync | Un salón trabaja todo el día sin internet |
| 4 | more-hub-web | Puck como renderizador, kit de bloques, motor de temas, formulario de reserva, resolución por `BUSINESS_ID`/dominio, OG por negocio | La landing de MJ recreada con bloques |
| 5 | more-hub-web + master | Editor `/editor`, Edge Function `site-save`, borrador/publicar/versiones, link de vista previa, catálogo de plantillas | Cambias una landing con clics y la publicas |
| 6 | more-hub-admin | Cuentas Vercel, sitios, dominios, desplegar/pausar/actualizar todos, GitHub Action | "Publicar cliente" con un botón |
| 7 | more-hub-admin + master | `usage_daily`, ficha de uso, avisos | Ves qué uso le da cada uno |
| 8 | more-hub-web | 6–8 plantillas muy distintas con capturas automáticas | Catálogo para enseñar |
| 9 | todos | **MJ como piloto**: script que copia sus datos al tenant con su `business_id`, landing "Rosa", Jev por su entitlement, la app vieja se apaga | MJ funciona en More Hub |

La app actual de MJ **no se toca** hasta la fase 9 y sigue funcionando mientras tanto.

---

## 8. Lo que se porta de MJ (y cómo)

| De MJ | A More Hub |
|---|---|
| `lib/availability.js`, `duration.js`, `dates.js` | `src/domain/agenda/*` (TS, con tests), compartido con la web para la reserva |
| `PublicBookingForm.jsx` | Bloque "Reservar" de la web, contra RPC pública |
| `Agenda.jsx`, `Servicios.jsx`, `Empleadas.jsx` (horarios) | Pantallas nuevas de la app (React Native) |
| `Caja.jsx` (cobro multi-servicio) | Cobrar la cita como venta del punto (sin caja paralela) |
| `StaffPay.jsx` (pago por trabajadora) | Se apoya en `salarios` + comisión por servicio (More Hub ya tiene la comisión en su lista pendiente) |
| `Inventario.jsx` + `service_supplies` | Fichas de costo/recetas existentes, aplicadas a servicios |
| `Resenas.jsx`, `Galeria.jsx`, `PhotoCropEditor.jsx` | Bloques de la web + moderación en la app |
| `Season.jsx` | Bloque/capa "Temporada" |
| Telegram (`tg_*` en SQL) | Los avisos al instante de More Hub (`avisar`) con tipos nuevos: reserva nueva, cancelada, reseña |
| Tasa automática (tasalo) | More Hub decidió tasa **manual** a propósito; para MJ se ofrece como opción del negocio |
| Landing de MJ | Plantilla "Rosa" del catálogo |
| Jev en Finanzas | Entitlement `decision`/`asistente` de MJ |

---

## 9. Investigación (resumen)

**Referencias de producto**: GoHighLevel "Snapshots" (cuenta maestra que se clona por cliente; revenden
a 97–297 USD/mes; su fallo, que actualizar la maestra pisa lo del cliente, lo evitamos separando código
de contenido) · GlossGenius y Vagaro (webs de belleza con reserva por servicio o por persona, poco
personalizables) · Webflow/Framer (catálogos con "ver demo") · Square, Loyverse, Shopify POS y Odoo
(ya estudiados en el plan maestro de More Hub para cajas y puntos).

**Librerías**: Puck (editor) · Motion (animaciones) · `culori` (paletas OKLCH) · Magic UI, Aceternity UI
y React Bits (efectos de landing, copiar y pegar) · `@vercel/sdk` · Playwright (capturas). Para la app,
se queda lo que ya usa More Hub (Expo 56, Drizzle, Paper, Reanimated, gifted-charts).

**Sync offline** (comparado): el motor propio de More Hub gana a PowerSync (servicio extra entre el
teléfono y la base, otra pieza que falla con mala red), Legend-State (persistencia y conflictos aparte)
y WatermelonDB (fricción con la nueva arquitectura de Expo).

**Skills para mí**: ya disponibles `vercel:nextjs`, `vercel:shadcn`, `vercel:react-best-practices`,
`design:design-system`, `design:accessibility-review`, `anthropic-skills:theme-factory`, y las de Expo
(`expo:expo-design-system`, `expo:expo-native-ui`, `expo:expo-animation`, `expo:expo-router`,
`expo:eas-update`, `react-native-best-practices`). A instalar en `more-hub-web/.claude/skills`:
`frontend-design` (Anthropic), `design-taste-frontend` (taste-skill) y `ui-ux-pro-max`, para que cada
plantilla tenga personalidad propia.

---

## 10. Fuentes
- Repos analizados: `eduar297/mj-beauty-app`, `eduar297/more-hub2` (docs/PLAN-MAESTRO.md,
  ANALISIS-VARIOS-NEGOCIOS.md, ESTADO-2026-09-22.md, DESIGN.md, `src/sync/*`, `src/db/*`),
  `eduar297/more-hub-admin` (README, `src/lib/provisioning/*`, migraciones master 004/010/011/018),
  `eduar297/more-hub-web` (README, `src/lib/site.ts`).
- Puck: https://github.com/puckeditor/puck
- Vercel: https://vercel.com/docs/limits/fair-use-guidelines · https://vercel.com/docs/plans/pro-plan ·
  https://vercel.com/docs/rest-api/projects/create-a-new-project ·
  https://vercel.com/docs/rest-api/projects/create-one-or-more-environment-variables ·
  https://vercel.com/docs/rest-api/sdk/examples/deployments-automation ·
  https://vercel.com/docs/platforms/multi-tenant-platforms/configuring-domains ·
  https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel
- Supabase: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook ·
  https://automationatlas.io/answers/supabase-free-tier-limits-2026/
- Sync offline: https://docs.expo.dev/guides/local-first/ ·
  https://expo.dev/blog/offline-first-apps-with-expo-and-legend-state ·
  https://supabase.com/blog/react-native-offline-first-watermelon-db · https://powersync.com/
- Referencias: https://ecosire.com/blog/gohighlevel-snapshots-guide ·
  https://glossgenius.com/blog/website-builder-for-salons · https://glossgenius.com/blog/fresha-vs-vagaro ·
  https://www.pkgpulse.com/guides/react-bits-vs-aceternity-magic-ui-2026
- Skills: https://skills.sh/anthropics/claude-code/frontend-design ·
  https://claudemarketplaces.com/skills/leonxlnx/taste-skill/design-taste-frontend ·
  https://claudemarketplaces.com/skills/nextlevelbuilder/ui-ux-pro-max-skill/ui-ux-pro-max
