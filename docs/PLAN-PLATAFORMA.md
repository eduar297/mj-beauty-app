# Plan: plataforma para negocios (basada en MJ Beauty)

> Objetivo: que cuando llegue un cliente nuevo puedas, **en un día**, enseñarle un catálogo de
> landings, personalizarle la suya con clics, activar solo los módulos de gestión que necesita,
> desplegarla y cobrar. Sin rehacer nada desde cero.

---

## 0. Lo que pediste, en una frase por punto

| Necesidad | Cómo lo resolvemos |
|---|---|
| Landing **totalmente** personalizable y distinta entre clientes | Editor visual **Puck** (drag & drop, MIT) + kit propio de bloques con varias variantes cada uno + motor de temas (colores, fuentes, bordes, estilo) |
| Catálogo de landings para enseñar al cliente | Plantillas = página en JSON + tema. Galería con capturas automáticas y link de vista previa para mandar por WhatsApp |
| Cambiar casi todo con clics, links incluidos | Campos del editor: textos, fotos, colores, orden de secciones, y un campo "Enlace" (sección, página interna, reservar, WhatsApp, teléfono, URL) |
| Gestión "un poco" personalizable | Paleta/logo/fuentes + **módulos que se encienden y apagan** + vocabulario por rubro + categorías configurables |
| Unos solo tienen tienda, otros solo servicios, otros ambos | Módulos por cliente: `servicios`, `tienda`, o los dos. La landing y el menú del panel se adaptan solos |
| Varios locales, finanzas por local o juntas | Tabla `locations`: caja, inventario, ventas, citas y personal **por local**, con filtro "Local A / B / C / Todos" |
| Un solo Supabase para todos | Base multi-cliente (`tenant_id` en cada tabla) con seguridad real (RLS) |
| Cada cliente con su Vercel | Soportado y automatizado, **pero lee la sección 6**: hay un tema de licencias y una alternativa más barata |
| IA (Jev) | **Fuera** para clientes. Solo MJ. Más adelante, posible extra de pago (feature flag) |

---

## 1. Qué encontré en internet (ideas para no reinventar la rueda)

### Productos parecidos de los que copiar ideas
- **GoHighLevel "Snapshots"**: es *exactamente* tu modelo de negocio. Agencias crean una cuenta
  "maestra" (web + CRM + calendarios) y la clonan para cada cliente; en su plan Pro se despliega sola
  cuando el cliente paga. Revenden a 97–297 USD/mes por cliente. Lección que copiamos: **plantilla
  maestra → copia por cliente**. Lección que evitamos: al actualizar la maestra pisan los cambios del
  cliente. Nosotros separamos *código de bloques* (se actualiza para todos) de *contenido* (es de
  cada cliente y nunca se pisa).
- **GlossGenius / Vagaro**: software de salones con constructor de webs por plantillas de belleza.
  Ideas: reservar "por servicio o por empleada", portfolio de fotos, plantillas por rubro. Su
  debilidad (según reseñas) es que son poco personalizables → ahí está nuestra ventaja.
- **Fresha / Booksy**: marketplaces; webs muy limitadas. Confirma que la landing propia vende.
- **Webflow / Framer**: catálogos de plantillas con vista previa en vivo. Copiamos la idea de la
  galería con "ver demo".

### Constructores visuales open source evaluados
| Opción | Veredicto |
|---|---|
| **Puck** (`@puckeditor/core` 0.24, MIT, ~13k ⭐, React 18/19) | ✅ **Elegido.** Usa *nuestros* componentes React, guarda la página como JSON, tiene slots (bloques dentro de bloques), campos personalizados, permisos por bloque y `<Render>` para producción. Encaja perfecto con Supabase |
| Craft.js | Bueno pero más bajo nivel; más trabajo para el mismo resultado |
| GrapesJS | Trabaja con HTML/CSS sueltos, no con nuestros componentes React con datos vivos |
| Webstudio / Plasmic / Onlook | Son productos enteros (o editores de código); demasiado para incrustar |
| Builder.io | Cerrado y de pago por uso |

### Librerías que nos van a facilitar la vida
| Para qué | Librería |
|---|---|
| Editor de landing | `@puckeditor/core` |
| Animaciones | `motion` (ex Framer Motion) |
| Bloques/efectos de landing (copiar y pegar, gratis) | Magic UI, Aceternity UI, React Bits (como inspiración y fuente de efectos; sus versiones Pro son de pago, no hacen falta) |
| UI del panel de gestión | **shadcn/ui** (Radix) + Tailwind v4 con variables CSS (temas por cliente) |
| Generar paleta completa desde 1–2 colores | `culori` (OKLCH: los tonos salen armónicos y con buen contraste) |
| Editor de temas de referencia | tweakcn (para inspirarnos en su UI y exportar presets) |
| Datos y formularios | TanStack Query, react-hook-form + zod, sonner (avisos) |
| Gráficas de finanzas | Recharts (vía shadcn charts) |
| Ordenar con arrastre (ya lo usas) | dnd-kit |
| Despliegues automáticos | `@vercel/sdk` + Vercel CLI en GitHub Actions |
| Monorepo | pnpm workspaces + Turborepo |
| Capturas del catálogo / pruebas visuales | Playwright (ya instalado aquí) |

### Skills para mejorarme a mí en esto
Ya disponibles en esta sesión: `vercel:shadcn`, `vercel:nextjs`, `vercel:react-best-practices`,
`design:design-system`, `design:accessibility-review`, `anthropic-skills:theme-factory`,
`engineering:system-design`.

Para instalar en el repo (en `.claude/skills/`, así sirven en todas las sesiones futuras):
1. **`frontend-design`** (oficial de Anthropic): obliga a elegir una dirección estética fuerte en vez
   del diseño genérico de IA. `npx skills add https://github.com/anthropics/skills --skill frontend-design`
2. **`design-taste-frontend`** (leonxlnx/taste-skill): pensada justo para que cada landing no salga
   igual; antes de diseñar define público, "vibe", referencias. Ideal para crear plantillas distintas.
3. **`ui-ux-pro-max`** (nextlevelbuilder): base de datos de paletas, combinaciones de fuentes y
   estilos. Ideal para los presets de temas.
4. **awesome-claude-design**: 68 `DESIGN.md` de marcas reales como referencia de estilos.

Además, con Playwright yo puedo hacer capturas de cada plantilla y revisarlas visualmente antes de
enseñártelas.

---

## 2. Arquitectura

```
                    ┌──────────────────────────────┐
                    │   ESTUDIO (tu panel)          │  ← solo tú
                    │ clientes · catálogo · editor  │
                    │ temas · módulos · despliegues │
                    └──────────────┬───────────────┘
                                   │
                   ┌───────────────▼────────────────┐
                   │  SUPABASE ÚNICO (multi-cliente) │
                   │  tenants · locations · pages    │
                   │  services · products · stock…   │
                   │  RLS por tenant_id              │
                   └───────────────┬────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
   ┌──────▼──────┐          ┌──────▼──────┐          ┌──────▼──────┐
   │ App cliente │          │ App cliente │          │ App cliente │
   │ MJ Beauty   │          │ Barbería X  │          │ Tienda Y    │
   │ landing +   │          │ landing +   │          │ landing +   │
   │ gestión     │          │ gestión     │          │ gestión     │
   └─────────────┘          └─────────────┘          └─────────────┘
   (mismo código; cambia el contenido, el tema y los módulos que vienen de la base)
```

**Idea clave:** todo lo que cambia entre clientes (landing, tema, módulos, textos, locales) vive en
la **base de datos**, no en el código. Editar la landing de un cliente **no requiere volver a
desplegar**: publicas y se ve al instante.

### Monorepo (repo nuevo)
```
apps/
  web/        App del cliente: landing pública + panel de gestión (un mismo código para todos)
  studio/     Tu panel: clientes, catálogo, editor completo, despliegues
packages/
  blocks/     EL KIT: bloques de la landing + config de Puck (Hero, Servicios, Tienda…)
  theme/      Motor de temas: tokens, generador de paletas, fuentes, presets
  ui/         Componentes del panel (shadcn) que leen el tema
  core/       Lógica de negocio portada de MJ: disponibilidad, dinero, fechas, finanzas, tasa
  db/         Migraciones Supabase (CLI), tipos generados, seeds por rubro
  templates/  Plantillas del catálogo (JSON de páginas + tema + capturas)
```

### Next.js en vez de Vite (recomendación)
La app actual es Vite (SPA). Para la nueva recomiendo **Next.js (App Router) + TypeScript**:
- La landing se genera en el servidor → **Google la indexa** y, muy importante, **al mandar el link
  por WhatsApp sale la vista previa con foto y nombre del negocio** (hoy con SPA eso no funciona bien
  por cliente).
- Al publicar en el editor, se "revalida" solo esa página: cambio visible en segundos.
- El panel de gestión sigue siendo igual de interactivo (componentes de cliente).
- Puck tiene receta oficial para Next.
- La lógica de `src/lib/*` (availability, money, dates, finance) es JS puro: se porta casi tal cual.

---

## 3. Base de datos multi-cliente (Supabase único)

### Tablas nuevas
- `tenants`: id, slug, nombre, rubro, moneda, zona horaria, idioma, estado (prueba/activo/suspendido),
  plan, dominio.
- `tenant_settings`: tema (jsonb), módulos activos (jsonb), vocabulario, contacto, redes, horarios,
  Telegram, etc. (reemplaza el `site_settings` de fila única).
- `locations` (**locales**): id, tenant_id, nombre, dirección, teléfono, horarios, mapa, activo.
- `pages`: tenant_id, ruta (`/`, `/nosotros`…), `draft` jsonb, `published` jsonb, publicado_en.
- `page_versions`: historial para deshacer / volver a una versión.
- `templates`: catálogo (nombre, rubro, JSON de páginas, tema, captura).
- `memberships`: usuario ↔ tenant ↔ rol (`owner`, `manager`, `staff`) ↔ locales permitidos.
- `stock` (por local): producto × local × cantidad. Movimientos y traspasos entre locales.

### Cambios a las tablas existentes
- **Todas** llevan `tenant_id` (+ índice) y las operativas llevan `location_id`:
  citas, caja/transacciones, compras, stock, cierres, personal (en qué locales trabaja).
- Lo que hoy está fijo en el código pasa a ser configurable por cliente:
  - categorías de servicios (hoy `check (cat in ('Uñas','Pelo'…))`) → tabla `categories`
  - zona horaria `America/Havana`, moneda CUP/USD, tasa El Toque/tasalo → ajustes del tenant
  - Telegram (`notify_config`) y los cron (resumen mañanero, tasa) → por tenant
  - storage: rutas `tenant_id/...` con políticas por tenant

### Seguridad (lo más importante antes de vender)
Hoy la app usa políticas `anon_all` (cualquiera con la clave pública puede leer/escribir todo) y el
login por PIN se guarda en `localStorage`. Para un solo negocio pasaba; **con varios clientes en la
misma base, uno podría ver los datos de otro.** Por eso:
1. **Supabase Auth de verdad.** Dueño/a entra con correo; empleadas siguen con **PIN** (misma
   comodidad): una Edge Function `pin-login` verifica el PIN (guardado con hash, con límite de
   intentos) y devuelve una sesión real de Supabase.
2. **Custom Access Token Hook**: mete `tenant_id`, rol y locales en el token.
3. **RLS en todas las tablas**: `tenant_id = (select auth.jwt() ->> 'tenant_id')`.
4. Lo público (reservar, ver catálogo, dejar reseña) va por **funciones RPC** acotadas al tenant, no
   con inserciones abiertas.
5. Tests automáticos que intentan leer datos de otro tenant y deben fallar.

---

## 4. Gestión: módulos, locales y personalización

### Módulos (se encienden/apagan por cliente desde el Estudio)
| Módulo | Incluye | Ejemplo de cliente |
|---|---|---|
| `servicios` | Servicios, categorías, agenda, reservas online, días cerrados, horarios | Salón, barbería, spa |
| `tienda` | Productos, catálogo público, ventas/POS, stock por local, compras | Tienda de cosmética, ropa |
| `personal` | Empleados, PIN, horarios, pago por trabajador/a | Cualquiera con equipo |
| `clientes` | Fichas, historial, VIP | — |
| `caja` | Cobros, métodos de pago, cierre del día | — |
| `finanzas` | Ganancias, costos, desglose (sin IA) | — |
| `insumos` | Inventario de materiales y costo real por servicio | Salón |
| `resenas`, `galeria` | Reseñas y fotos antes/después | — |
| `multi_local` | Selector de local, traspasos de stock, reportes comparados | Cadena de tiendas |
| `telegram` | Avisos y resumen diario | — |
| `tasa_cambio` | Precios duales USD/CUP con tasa automática | Clientes en Cuba |
| `temporada` | Decoraciones (Navidad, San Valentín…) | — |
| `ia_finanzas` (Jev) | **Solo MJ** / extra de pago futuro | — |

El menú lateral, el inicio del panel y la landing se construyen a partir de los módulos activos:
**solo tienda** → no hay agenda ni bloque "Reservar"; **solo servicios** → no hay tienda; **ambos** → todo.

### Varios locales
- Selector arriba del panel: **Local A · Local B · Local C · Todos**.
- Caja, ventas, citas, stock y finanzas se filtran por local; "Todos" consolida y además muestra una
  **comparativa por local** (ingresos, gastos, ganancia, producto más vendido, ticket medio).
- Stock por local con **traspasos** entre locales y alertas de "agotado" por local.
- Personal asignado a uno o varios locales; un encargado puede ver solo su local.
- La landing puede mostrar los locales (bloque "Nuestras tiendas" con mapa y horario de cada una) y la
  reserva permite elegir local.

### Personalización visual del panel
Logo, paleta (generada desde el color de marca), fuentes, claro/oscuro, bordes. Más **vocabulario por
rubro** ("empleadas" / "barberos" / "vendedores", "clientas" / "clientes") y **presets por rubro**
(salón, barbería, spa, uñas, tienda) que crean categorías y servicios de ejemplo al dar de alta.

---

## 5. El kit de la landing (lo más importante)

### Cómo se logra que ninguna landing sea igual
Una landing = **bloques** × **variante de cada bloque** × **tema** × **orden** × **contenido**.
Con ~20 bloques de 3–5 variantes y temas libres, salen miles de combinaciones. Y cuando un cliente
quiera algo único, se crea un bloque nuevo en el kit (lo hago yo) y queda disponible para todos.

### Bloques iniciales (cada uno con variantes)
- **Navegación**: clásica, centrada, transparente sobre hero, menú lateral.
- **Hero**: centrado, dividido foto/texto, collage, video de fondo, editorial con tipografía grande, carrusel.
- **Servicios** (lee de la base): tarjetas por categoría, lista con precios, acordeón, menú tipo carta.
- **Tienda / Productos destacados** (lee de la base): grid, carrusel, "más vendidos".
- **Galería**: masonry, antes/después, carrusel, lightbox.
- **Equipo**: tarjetas, fila de avatares, con especialidades.
- **Reseñas**: carrusel, muro, destacado con promedio de estrellas.
- **Sobre nosotros**: imagen + texto, línea de tiempo, números (años, clientes…).
- **Locales**: mapa + horarios de cada local.
- **Reservar / CTA**: banner, flotante, sección con formulario (reutiliza `PublicBookingForm`).
- **Contacto**: WhatsApp, teléfono, redes, mapa, horarios.
- **Promo / Banner**: oferta, cuenta regresiva, cupón.
- **Preguntas frecuentes**, **Precios/Paquetes**, **Instagram**, **Texto libre**, **Imagen**,
  **Espaciador/Divisor**, **Columnas** (slot para meter otros bloques), **Pie de página**.
- **Temporada**: las decoraciones actuales de MJ como capa opcional.

Los bloques "vivos" (servicios, tienda, reseñas, equipo, locales) leen de la base, así que si el
cliente cambia un precio en su panel, la landing se actualiza sola.

### Campos que se editan con clic
Texto, texto enriquecido, imagen (subida + recorte; ya tienes `PhotoCropEditor`), color (de la paleta
o libre), alineación, fondo (color/degradado/imagen/video), espaciado, animación de entrada, visible en
móvil/escritorio, y el campo **Enlace**:
`Ir a sección` · `Página interna` (/servicios, /tienda, /galeria…) · `Abrir reserva` ·
`WhatsApp` (con mensaje prellenado) · `Llamar` · `Correo` · `URL externa` · `Producto/Servicio concreto`.

### Motor de temas
- Tokens: colores (primario, secundario, fondo, superficie, texto, acentos) generados en OKLCH desde
  1–2 colores de marca con contraste verificado; tipografías (pares curados de Google Fonts);
  bordes; sombras; densidad; estilo de botones; estilo de imágenes (redondas, rectas, arco…).
- **Presets** con personalidad: *Rosa* (MJ actual), *Noir lujo*, *Minimal editorial*, *Orgánico spa*,
  *Urbano barbería*, *Pastel juguetón*, *Tienda moderna*… cada uno cambiable después.

### Flujo con el cliente (el "en un día")
1. Estudio → **Nuevo cliente** → nombre, rubro, módulos, locales, moneda.
2. **Catálogo**: le enseñas las plantillas (capturas + "ver demo"). Elige una.
3. Se clona en un **borrador** suyo. Lo editas en el editor: "¿te gusta así? → cámbiale esto".
4. Mandas un **link de vista previa** (sin publicar) por WhatsApp.
5. Aprueba → **Publicar** → creas su usuario dueño/a → despliegue (sección 6).
6. Después, el cliente puede editar cosas sencillas desde su panel ("Mi página") con **permisos
   limitados** (textos y fotos sí; estructura no), y tú tienes el editor completo en el Estudio.

### Páginas
Varias páginas por cliente (Inicio, Servicios, Tienda, Galería, Nosotros, la que quiera), cada una
editable. Borrador vs publicada, historial de versiones, duplicar página/plantilla.

---

## 6. Despliegue: tu idea (un Vercel por cliente) y una alternativa

### ⚠️ Lo que encontré
El plan **gratis (Hobby) de Vercel es solo para uso personal no comercial**. Una web de un negocio que
te paga es uso comercial → cada cliente necesitaría **Vercel Pro (20 USD/mes)** para cumplir las
condiciones. Si usan Hobby, Vercel puede pausar el proyecto.

### Opción A: un Vercel por cliente (lo que propusiste) — soportada
- El cliente crea su cuenta, te da un **token** (con fecha de caducidad y solo para su equipo).
- Lo guardas en el Estudio (cifrado en Supabase Vault).
- Una **GitHub Action** construye la app una vez y la despliega a cada cliente con
  `vercel deploy --prebuilt --prod --token … --scope …`. El Estudio la dispara con un botón
  ("Desplegar a este cliente" / "Actualizar a todos").
- Variables por cliente: URL de Supabase, clave pública, `TENANT_SLUG`.
- Ventaja: cada uno es "dueño" de su web. Desventajas: 20 USD/mes por cliente, y cada mejora de
  código hay que desplegarla N veces (automatizado, pero son N despliegues).

### Opción B (mi recomendación): un solo Vercel Pro tuyo, multi-cliente
- Una sola app; el dominio decide qué cliente mostrar (`mjbeauty.com`, `barberiax.com` o
  `cliente.tuplataforma.com`). Es el modelo "Vercel for Platforms": dominios personalizados ilimitados
  y certificados automáticos, añadidos desde el Estudio por API.
- **20 USD/mes en total**, no por cliente. Una mejora llega a todos con un despliegue.
- Tú cobras la mensualidad al cliente y te quedas con el margen (modelo GoHighLevel).

**El código sirve para las dos**: el tenant se resuelve por variable de entorno (A) o por dominio (B).
Podemos arrancar con B y, si un cliente exige su propio Vercel, darle A.

### Supabase
Un solo proyecto. El plan gratis tiene 500 MB de base, 1 GB de archivos y **se pausa tras 7 días sin
actividad**. Con varios clientes conviene **Supabase Pro (~25 USD/mes)**: 8 GB, sin pausas, backups.
Las fotos ya se comprimen a WebP, eso ayuda mucho.

---

## 7. Fases

| Fase | Qué sale | Resultado |
|---|---|---|
| **0. Cimientos** | Repo nuevo, monorepo, Next.js + TS, Tailwind v4, shadcn, Supabase CLI con migraciones, skills instaladas | Proyecto vacío que compila y despliega |
| **1. Base multi-cliente y seguridad** | tenants, locations, memberships, `tenant_id` en todo, RLS, login PIN seguro, RPC públicas, storage por tenant | Dos tenants de prueba que no se ven entre sí (con tests) |
| **2. Motor de temas** | Tokens, generador de paletas, fuentes, 6–8 presets | Cambias color/fuente y cambia toda la app |
| **3. Gestión portada por módulos** | Agenda, caja, clientes, servicios, productos, stock por local, finanzas por local/consolidado, personal, reseñas, Telegram | Panel que se arma según módulos y locales |
| **4. Kit de landing** | Puck + bloques + variantes + campo Enlace + bloques vivos + páginas + borrador/publicar/versiones | Landing 100 % editable por clics |
| **5. Estudio** | Clientes, asistente de alta, catálogo con capturas, editor completo, link de vista previa, módulos, presets por rubro | El flujo "en un día" funcionando |
| **6. Despliegue** | Opción B (dominios por API) y/o Opción A (Action por cliente) | Botón "Publicar cliente" |
| **7. Catálogo inicial** | 6+ plantillas muy distintas (salón, barbería, spa, uñas, tienda, multi-local) con capturas automáticas | Algo que enseñar al primer cliente |
| **8. MJ Beauty como cliente #1** | Migrar datos de MJ con su `tenant_id`, su landing actual recreada como plantilla "Rosa", Jev solo para MJ | MJ funcionando en la plataforma; la app vieja se apaga |
| Después | IA como extra de pago, cobros/suscripciones, analíticas de visitas, dominio propio guiado, más idiomas | — |

La app actual de MJ **no se toca** hasta la fase 8: sigue funcionando mientras construimos.

---

## 8. Decisiones que necesito de ti

1. **Despliegue**: ¿Opción B (un Vercel tuyo, recomendada), Opción A (un Vercel por cliente) o ambas?
2. **Next.js** en lugar de Vite para la nueva plataforma (recomendado por la vista previa en WhatsApp y Google).
3. **Repo nuevo**: crea un repo vacío en GitHub (p. ej. `plataforma-negocios`) y lo conecto a la
   sesión. Yo no puedo crear repos desde aquí.
4. **Skills**: ¿instalo `frontend-design`, `design-taste-frontend` y `ui-ux-pro-max` en el repo?
5. **Nombre** de la plataforma (para el Estudio y los subdominios).

---

## Fuentes
- Puck: https://github.com/puckeditor/puck · npm `@puckeditor/core`
- Supabase multi-tenant / claims: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook ·
  https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac
- Vercel Hobby no comercial: https://vercel.com/docs/limits/fair-use-guidelines · https://vercel.com/docs/plans/hobby
- Vercel Pro: https://vercel.com/docs/plans/pro-plan
- Vercel for Platforms: https://vercel.com/docs/multi-tenant-platforms/concepts ·
  https://vercel.com/docs/platforms/multi-tenant-platforms/configuring-domains
- API de Vercel (proyectos, env, despliegues): https://vercel.com/docs/rest-api/projects/create-a-new-project ·
  https://vercel.com/docs/rest-api/projects/create-one-or-more-environment-variables ·
  https://vercel.com/docs/rest-api/sdk/examples/deployments-automation
- GitHub Actions + Vercel: https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel
- Límites Supabase gratis: https://automationatlas.io/answers/supabase-free-tier-limits-2026/
- GoHighLevel Snapshots: https://ecosire.com/blog/gohighlevel-snapshots-guide
- Software de salones: https://glossgenius.com/blog/website-builder-for-salons · https://glossgenius.com/blog/fresha-vs-vagaro
- Librerías de landing: https://www.pkgpulse.com/guides/react-bits-vs-aceternity-magic-ui-2026 ·
  https://ui.aceternity.com/guides/best-react-ui-components-2026
- tweakcn / temas OKLCH: https://tweakcn-picker.vercel.app/docs/theming
- Skills: https://skills.sh/anthropics/claude-code/frontend-design ·
  https://claudemarketplaces.com/skills/leonxlnx/taste-skill/design-taste-frontend ·
  https://claudemarketplaces.com/skills/nextlevelbuilder/ui-ux-pro-max-skill/ui-ux-pro-max ·
  https://composio.dev/content/top-design-skills
