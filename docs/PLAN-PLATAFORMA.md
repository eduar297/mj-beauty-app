# Plan: plataforma para negocios (basada en MJ Beauty + modelo Master/Tenants de More Hub)

> Objetivo: cuando llegue un cliente nuevo, **en un día** le enseñas un catálogo de landings, se la
> personalizas con clics, le activas solo los módulos de gestión que necesita, la despliegas con su
> dominio desde tu panel y cobras. Sin rehacer nada desde cero.

---

## 0. Resumen

| Necesidad | Cómo lo resolvemos |
|---|---|
| Un panel tuyo que lo controla todo | **Panel Master** (como `more-hub-admin`): crear negocio, módulos, plantilla, desplegar, pausar, suspender, actualizar, ver uso, cobros |
| Base de datos | **Supabase Master** (solo directorio y control) + **pool de Supabase Tenant** (los datos de los negocios) |
| Varios clientes en un mismo tenant | Sí, como en More Hub (migraciones 010/025/026): `business_id` en cada fila + RLS. Llenas un proyecto (aviso con `max_businesses`) y abres otro |
| Web de cada cliente | **Un proyecto Vercel por cliente, con su dominio.** Varias cuentas de Vercel (pool), cada una con varios proyectos, gestionadas desde el panel |
| Landing **totalmente** personalizable y distinta | Editor visual **Puck** + kit de bloques con variantes + motor de temas |
| Catálogo de landings para enseñar | Plantillas (JSON + tema) con capturas automáticas y link de vista previa por WhatsApp |
| Gestión "un poco" personalizable | Paleta/logo/fuentes + módulos que se encienden y apagan + vocabulario por rubro |
| Solo tienda / solo servicios / ambos | Módulos por negocio; menú, panel y landing se adaptan solos |
| Varios locales, finanzas por local o juntas | `locations` (equivalente a los "puntos" de More Hub): caja, stock, ventas, citas y finanzas por local o "Todos" |
| IA (Jev) | **Fuera** para clientes. Solo MJ. Más adelante, posible extra de pago |

---

## 1. Lo que tomamos de More Hub Admin (tu propio sistema)

Revisé `eduar297/more-hub-admin`. Ya resuelve gran parte del problema y lo vamos a **reutilizar**:

| Pieza de More Hub | Qué hace | Cómo la usamos aquí |
|---|---|---|
| Supabase **Master** sin datos de negocio | Solo `businesses`, `tenants`, licencias, pagos, precios, errores, versiones | Igual. Añadimos cuentas Vercel, sitios, plantillas, módulos |
| `tenants` = proyectos Supabase en un **pool** | Se provisionan aparte y al crear un negocio se elige uno con hueco | Igual |
| **Varios negocios por tenant** (master 010, tenant 025/026) | `business_id` en cada tabla, helper `mh_business()`, policies con `using` + `with check`, "freno de mano" si hay filas sin negocio, `max_businesses` como aviso (no candado), el Admin se niega a meter un 2º negocio en un tenant sin aislamiento | **Exactamente igual** desde el día 1: el esquema nace con `business_id` y RLS |
| Credenciales por cuenta (master 011/019) | Token (PAT) de cada cuenta Supabase dueña de sus proyectos; `service_role` cifrado con **AES-256-GCM** | Igual, y lo mismo para los **tokens de Vercel** |
| Provisionamiento por **Management API** | Corre migraciones una a una, registro `_migrations`, secrets, Edge Functions, **tests de aislamiento** | Igual. Botones **"Provisionar"** y **"Actualizar todos"** |
| Estados `active / paused / suspended` + licencia con vencimiento + prueba | La app consulta su estado al master | Igual: la web y el panel del cliente consultan al master; si está suspendido muestran "servicio pausado" |
| Versión de cada negocio (master 018) | La app reporta qué versión trae y cuándo se vio | Igual: cada sitio reporta versión desplegada y último uso |
| `entitlements` + `price_list` + `payments` + dashboard (MRR, vencimientos, adopción de módulos) | Cobros y módulos de pago por negocio | Igual: los **módulos** de esta plataforma son `entitlements` |
| `error_logs`, logs, invitación de soporte, "datos/[tabla]" | Soporte y depuración | Igual |
| Subnegocios y **puntos** (026/027) | Grupo de negocios y puntos de venta | Base para **locales** y cadenas |

Lecciones que More Hub ya pagó y que copiamos desde el principio: migraciones **re-ejecutables y una a
una** (no todo de un tirón), separar "la cuenta dueña del token" (el famoso 403), credenciales con una
sola fuente de verdad (el tenant, no copias en cada negocio), y nunca marcar en verde una migración que
falló a medias.

---

## 2. Arquitectura

```
                  ┌───────────────────────────────────────────┐
                  │            PANEL MASTER (tú)              │
                  │ negocios · plantillas · editor · módulos  │
                  │ desplegar · pausar · uso · cobros · logs  │
                  └───────────────┬───────────────────────────┘
                                  │
                  ┌───────────────▼───────────────┐
                  │       SUPABASE MASTER          │  solo control, cero datos de negocio
                  │ businesses · tenants · cuentas │
                  │ sitios · entitlements · pagos  │
                  │ plantillas · uso · errores     │
                  └──────┬─────────────────┬──────┘
         service_role    │                 │   token Vercel (cifrados)
         cifrado         │                 │
   ┌─────────────────────▼──┐        ┌─────▼────────────────────────────┐
   │ POOL SUPABASE TENANTS   │        │ POOL CUENTAS VERCEL               │
   │ Tenant 1: MJ, Barbería  │        │ Cuenta A: mjbeauty.com,           │
   │ Tenant 2: Tienda Y, …   │        │           barberiax.com, …        │
   │ (business_id + RLS)     │        │ Cuenta B: tiendaY.com, …          │
   └────────────▲────────────┘        └───────────────┬───────────────────┘
                │                                     │
                └─────── cada sitio lee/escribe ◄─────┘
                         solo su business_id
```

- **Mismo código** en todos los sitios. Lo que cambia (landing, tema, módulos, textos, locales) vive en
  la base: editar la landing **no requiere volver a desplegar**.
- Cada proyecto Vercel recibe por variables: URL y anon key de su tenant, su `BUSINESS_ID` y la URL del
  master.

### Repos
- **Panel Master**: decisión pendiente (sección 9). Lo más rápido es **extender `more-hub-admin`**
  (ya tiene login, provisionamiento, cifrado, cobros, dashboard) con un segundo producto, o hacer uno
  nuevo copiando esas piezas.
- **App del cliente** (repo nuevo, monorepo pnpm + Turborepo):
```
apps/
  web/        Landing pública + panel de gestión (un mismo código para todos los clientes)
packages/
  blocks/     EL KIT: bloques de la landing + config de Puck
  theme/      Tokens, generador de paletas (OKLCH), fuentes, presets
  ui/         Componentes del panel (shadcn) que leen el tema
  core/       Lógica portada de MJ: disponibilidad, dinero, fechas, finanzas, tasa
  db/         Migraciones del tenant (las que corre el Master), tipos generados, seeds por rubro
  templates/  Plantillas del catálogo (JSON + tema + capturas)
```
  El Panel Master importa `blocks`, `theme` y `templates` para tener el editor y el catálogo.

### Next.js en vez de Vite (recomendado)
- La landing se genera en el servidor → **Google la indexa** y **al mandar el link por WhatsApp sale la
  vista previa con foto y nombre** del negocio.
- Al publicar en el editor se revalida solo esa página: cambio visible en segundos, sin redeploy.
- More Hub Admin ya es Next 15: mismo stack, mismo conocimiento.
- La lógica de `src/lib/*` de MJ (availability, money, dates, finance) es JS puro: se porta casi tal cual.

---

## 3. Bases de datos

### Supabase Master (control)
Lo de More Hub (`businesses`, `tenants`, `license_history`, `usage_events`, `entitlements`,
`price_list`, `payments`, `error_logs`, `_migrations`, `app_settings`, `app_releases`) **más**:
- `supabase_accounts`: cuenta, PAT cifrado (para provisionar sus proyectos).
- `vercel_accounts`: nombre, team id, token cifrado, nº de proyectos, notas.
- `sites`: business_id, vercel_account_id, vercel_project_id, dominio(s), estado
  (`draft/live/paused`), versión desplegada, último deploy, último uso visto.
- `templates`: catálogo de landings (nombre, rubro, JSON de páginas, tema, captura, etiquetas).
- `business_modules` (o dentro de `entitlements`): qué módulos tiene cada negocio y hasta cuándo.
- `usage_daily`: métricas por negocio y día (ver sección 7).

### Supabase Tenant (datos de los negocios)
- Todas las tablas con `business_id` + índice + RLS desde la migración 001 (patrón 025/026 de More Hub).
- Helper `app_business()` que saca el negocio de la sesión (claim en el token) y `with check` en todas
  las escrituras.
- `locations` (locales) y `location_id` en lo operativo: citas, caja, ventas, compras, stock, cierres;
  personal asignado a locales.
- `pages` (`draft` / `published` jsonb), `page_versions`, `site_theme`, `site_settings`.
- Categorías, moneda, zona horaria, Telegram y crons **por negocio** (hoy están fijos en el código de MJ:
  `America/Havana`, CUP, las 6 categorías).
- Storage con rutas `business_id/...` y políticas por negocio.
- Tests de aislamiento automáticos (negocio A no puede leer ni escribir nada de B) que el Master corre
  al provisionar y al actualizar.

### Seguridad
Hoy MJ usa políticas `anon_all` y guarda la sesión del PIN en `localStorage`. Con varios negocios en un
tenant eso permitiría que uno viera a otro, así que:
1. **Supabase Auth real**: dueño/a con correo; empleadas con **PIN** como ahora, pero validado en una
   Edge Function (PIN con hash + límite de intentos) que devuelve una sesión real.
2. El token lleva `business_id`, rol y locales permitidos.
3. Lo público (reservar, ver catálogo, reseñas) va por **funciones RPC** acotadas al negocio.

---

## 4. Gestión: módulos, locales y personalización

### Módulos (se encienden y apagan desde el Panel Master)
| Módulo | Incluye |
|---|---|
| `servicios` | Servicios, categorías, agenda, reservas online, días cerrados, horarios |
| `tienda` | Productos, catálogo público, ventas/POS, stock por local, compras |
| `personal` | Empleados, PIN, horarios, pago por trabajador/a |
| `clientes` | Fichas, historial, VIP |
| `caja` | Cobros, métodos de pago, cierre del día |
| `finanzas` | Ganancias, costos, desglose (sin IA) |
| `insumos` | Materiales y costo real por servicio |
| `resenas`, `galeria` | Reseñas y fotos antes/después |
| `multi_local` | Selector de local, traspasos de stock, comparativa |
| `telegram` | Avisos y resumen diario |
| `tasa_cambio` | Precios duales USD/CUP con tasa automática |
| `temporada` | Decoraciones (Navidad, San Valentín…) |
| `ia_finanzas` | **Solo MJ** / extra de pago futuro |

Solo tienda → no hay agenda ni botón "Reservar". Solo servicios → no hay tienda. Ambos → todo.
Desactivar un módulo **oculta**, no borra datos.

### Varios locales
- Selector arriba: **Local A · Local B · Local C · Todos**.
- Caja, ventas, citas, stock y finanzas se filtran por local; "Todos" consolida y muestra una
  **comparativa** (ingresos, gastos, ganancia, más vendido, ticket medio).
- Traspasos de stock entre locales y alertas de agotado por local.
- Un encargado puede ver solo su local.
- En la landing: bloque "Nuestras tiendas" (mapa y horario de cada una); la reserva permite elegir local.

### Personalización del panel del cliente
Logo, paleta generada desde el color de marca, fuentes, claro/oscuro, bordes, **vocabulario por rubro**
("empleadas" / "barberos" / "vendedores") y **presets por rubro** (salón, barbería, spa, uñas, tienda)
que crean categorías y datos de ejemplo al dar de alta.

---

## 5. El kit de la landing

### Cómo se logra que ninguna sea igual
Landing = **bloques** × **variante** × **tema** × **orden** × **contenido**. Con ~20 bloques de 3–5
variantes y temas libres salen miles de combinaciones. Si un cliente quiere algo único, se crea un
bloque nuevo en el kit y queda disponible para todos.

### Bloques iniciales
- **Navegación**: clásica, centrada, transparente sobre la portada, menú lateral.
- **Portada (hero)**: centrada, dividida foto/texto, collage, video de fondo, editorial, carrusel.
- **Servicios** *(datos vivos)*: tarjetas por categoría, lista con precios, acordeón, carta.
- **Tienda** *(datos vivos)*: grid, carrusel, más vendidos, por categoría.
- **Galería**: masonry, antes/después, carrusel.
- **Equipo** *(datos vivos)*, **Reseñas** *(datos vivos)*, **Locales** *(datos vivos)*.
- **Sobre nosotros**, **Reservar/CTA**, **Contacto**, **Promo** (oferta, cuenta regresiva),
  **Preguntas frecuentes**, **Precios/Paquetes**, **Instagram**, **Texto libre**, **Imagen**,
  **Columnas** (bloques dentro de bloques), **Espaciador**, **Pie de página**, **Temporada**.

Los bloques con datos vivos leen de la base: si el cliente cambia un precio, la landing se actualiza sola.

### Edición con clics
Texto, texto enriquecido, imagen (subida + recorte, ya existe `PhotoCropEditor`), color, alineación,
fondo (color/degradado/imagen/video), espaciado, animación, visible en móvil/escritorio, y el campo
**Enlace**: `Ir a sección` · `Página interna` · `Abrir reserva` · `WhatsApp` (mensaje prellenado) ·
`Llamar` · `Correo` · `URL externa` · `Producto/Servicio concreto`.

### Motor de temas
Colores generados en OKLCH desde 1–2 colores de marca (con contraste verificado), pares de fuentes
curados, bordes, sombras, densidad, estilo de botones y de imágenes. **Presets**: *Rosa* (MJ actual),
*Noir lujo*, *Minimal editorial*, *Orgánico spa*, *Urbano barbería*, *Pastel*, *Tienda moderna*…

### Páginas
Varias por negocio (Inicio, Servicios, Tienda, Galería, Nosotros…). Borrador vs publicada, historial de
versiones, duplicar página o plantilla.

### Quién edita qué
- **Tú, en el Panel Master**: editor completo de cualquier negocio.
- **El cliente, en su panel ("Mi página")**: el mismo editor con **permisos limitados** (Puck permite
  bloquear arrastrar/borrar/editar por bloque): textos y fotos sí, estructura no. Configurable por cliente.

---

## 6. Despliegue: un proyecto Vercel por cliente, controlado desde el panel

### Pool de cuentas Vercel
- Registras en el Master varias cuentas Vercel (token cifrado AES-256-GCM, team id).
- Cada cuenta aloja **varios proyectos** (uno por cliente). El panel muestra cuántos lleva cada una
  y propone la que tenga hueco, igual que con los tenants de Supabase.

### Acciones desde el panel (vía API de Vercel / `@vercel/sdk`)
| Botón | Qué hace |
|---|---|
| **Crear sitio** | Crea el proyecto en la cuenta elegida, le pone las variables (tenant, `BUSINESS_ID`, master) |
| **Desplegar** | Lanza el build y el deploy de la versión actual del código |
| **Dominio** | Añade el dominio del cliente, muestra los registros DNS a poner y verifica |
| **Pausar / Reanudar** | Marca el negocio `paused` en el master → la web muestra "temporalmente fuera de servicio" y el panel se bloquea; opcionalmente pausa también el proyecto en Vercel |
| **Suspender** | Igual que pausar, pero por impago/licencia vencida (automático al vencer) |
| **Actualizar todos** | Despliega la nueva versión del código a todos los sitios (o a los marcados), con informe paso a paso como el de "Actualizar todos" de More Hub |
| **Eliminar** | Borra el proyecto en Vercel, con confirmación ("zona de peligro") |

### Cómo se construye
Un **GitHub Action** (disparado desde el panel con `workflow_dispatch`) hace el build una vez y
despliega con `vercel deploy --prebuilt --prod` al proyecto de cada cliente con el token de su cuenta.
Así no hace falta conectar tu repo de GitHub a cada cuenta de Vercel. Los tokens se piden al master con
una clave del Action y nunca quedan en los logs.

### Condiciones y costos a tener en cuenta
- El plan **Hobby de Vercel es solo para uso personal no comercial**; un sitio de negocio que cobra es
  comercial. Con Hobby, Vercel puede pausar proyectos. La forma segura es **Vercel Pro (20 USD/mes por
  cuenta)**, que admite muchos proyectos, así que el pool puede ser pocas cuentas Pro con muchos
  clientes cada una.
- Supabase gratis: 2 proyectos activos por cuenta, 500 MB de base, 1 GB de archivos, se pausa tras 7
  días sin actividad. Con varios negocios por tenant (como hace More Hub) un Supabase **Pro (~25 USD/mes)**
  aguanta muchos clientes.

---

## 7. Panel Master: todo lo que puedes hacer

**Negocios**
- Asistente "Nuevo negocio": nombre, contacto, rubro (preset), módulos, locales, moneda, zona horaria,
  tenant (con hueco), cuenta Vercel (con hueco), plantilla del catálogo.
- Ficha del negocio: estado, licencia/vencimiento, módulos, sitio y dominio, usuarios, logs, errores,
  versión, datos (ver tablas como en More Hub), zona de peligro.
- Activar / pausar / suspender / reactivar / borrar.
- Usuarios: crear dueño/a, invitar, resetear PIN, invitación de soporte para entrar a ayudar.

**Landing**
- Catálogo de plantillas con capturas automáticas (Playwright) y "ver demo".
- Editor completo, vista previa compartible por WhatsApp (link con token, sin publicar), publicar,
  versiones, copiar la landing de un negocio como nueva plantilla.

**Infraestructura**
- Tenants Supabase: provisionar, actualizar esquema (uno o todos), ocupación (`max_businesses`),
  tests de aislamiento.
- Cuentas Vercel: alta, proyectos por cuenta, sitios caídos o desactualizados.

**Uso: qué uso le están dando**
- Por negocio: último acceso al panel, usuarios activos, citas/ventas/cobros de los últimos 7 y 30 días,
  productos y servicios activos, locales, almacenamiento usado, visitas a la landing y reservas que
  llegaron desde ella, versión desplegada, errores.
- Un job diario del master recoge las cifras de cada tenant (con su service_role) a `usage_daily`; las
  visitas las cuenta la propia web con un endpoint ligero (sin cookies) o Vercel Web Analytics.
- Avisos: negocios sin actividad en X días (riesgo de baja), sitios con errores, licencias por vencer.

**Cobros** (lo de More Hub): precios por módulo y periodo, pagos, MRR, vencimientos, adopción de módulos.

---

## 8. Fases

| Fase | Qué sale | Resultado |
|---|---|---|
| **0. Cimientos** | Repo de la app (monorepo, Next + TS, Tailwind v4, shadcn), skills instaladas, decisión sobre el Master | Proyecto que compila y despliega |
| **1. Esquema tenant** | Migraciones con `business_id` + RLS + `locations` + `pages`, login PIN seguro, RPC públicas, storage por negocio, tests de aislamiento | Dos negocios en un tenant sin verse |
| **2. Master** | Tablas nuevas del master, provisionar tenants, alta de negocio, módulos, estados, cuentas Vercel | Crear un negocio desde el panel |
| **3. Motor de temas** | Tokens, paletas, fuentes, presets | Cambias color/fuente y cambia todo |
| **4. Gestión por módulos** | Agenda, caja, clientes, servicios, tienda, stock por local, finanzas por local/todos, personal, reseñas, Telegram | Panel que se arma según módulos y locales |
| **5. Kit de landing** | Puck + bloques + variantes + Enlace + datos vivos + páginas + borrador/publicar/versiones + permisos | Landing 100 % editable |
| **6. Despliegue** | Crear sitio, desplegar, dominio, pausar, actualizar todos | Botón "Publicar cliente" |
| **7. Uso y cobros** | Métricas diarias, avisos, dashboard | Ves qué uso le dan |
| **8. Catálogo** | 6+ plantillas muy distintas con capturas automáticas | Algo que enseñar al primer cliente |
| **9. MJ Beauty como cliente nº 1** | Migrar datos de MJ con su `business_id`, recrear su landing como plantilla "Rosa", Jev solo para MJ | MJ en la plataforma; se apaga la app vieja |
| Después | IA como extra de pago, más rubros, más idiomas | — |

La app actual de MJ **no se toca** hasta la fase 9.

---

## 9. Investigación: referencias, librerías y skills

### Productos parecidos
- **GoHighLevel "Snapshots"**: agencias clonan una cuenta maestra (web + CRM + calendario) para cada
  cliente y revenden a 97–297 USD/mes. Copiamos "plantilla maestra → copia por cliente"; evitamos su
  problema de que actualizar la maestra pisa lo del cliente (aquí el código de los bloques se actualiza
  para todos y el contenido es de cada cliente).
- **GlossGenius / Vagaro**: webs con plantillas de belleza y reserva por servicio o por empleada; poco
  personalizables, que es justo nuestra ventaja.
- **Webflow / Framer**: catálogos de plantillas con "ver demo".

### Constructores visuales evaluados
| Opción | Veredicto |
|---|---|
| **Puck** (`@puckeditor/core` 0.24, MIT, ~13k ⭐, React 18/19) | ✅ Elegido: usa nuestros componentes, guarda JSON, slots, campos propios, permisos por bloque, `<Render>` para producción |
| Craft.js | Más bajo nivel, más trabajo |
| GrapesJS | HTML/CSS sueltos, no componentes React con datos vivos |
| Webstudio / Plasmic / Onlook | Productos enteros, demasiado para incrustar |
| Builder.io | Cerrado y de pago |

### Librerías
Puck (editor) · Motion (animaciones) · shadcn/ui + Tailwind v4 (panel y temas por variables CSS) ·
`culori` (paletas OKLCH) · Magic UI, Aceternity UI, React Bits (efectos de landing, copiar y pegar) ·
TanStack Query · react-hook-form + zod · sonner · Recharts · dnd-kit (ya lo usas) · `@vercel/sdk` ·
pnpm + Turborepo · Playwright (capturas del catálogo).

### Skills
Disponibles ya: `vercel:shadcn`, `vercel:nextjs`, `vercel:react-best-practices`, `design:design-system`,
`design:accessibility-review`, `anthropic-skills:theme-factory`, `engineering:system-design`.

Para instalar en el repo (`.claude/skills/`):
1. **`frontend-design`** (oficial de Anthropic): dirección estética fuerte, nada de "diseño genérico de IA".
2. **`design-taste-frontend`** (leonxlnx/taste-skill): pensada para que cada landing tenga personalidad.
3. **`ui-ux-pro-max`** (nextlevelbuilder): paletas, pares de fuentes y estilos para los presets.
4. **awesome-claude-design**: 68 `DESIGN.md` de marcas reales como referencia.

---

## 10. Decisiones pendientes

1. **Panel Master**: ¿extender `more-hub-admin` (mismo panel y mismo Supabase master, con un segundo
   producto) o un panel nuevo copiando sus piezas?
2. **Next.js** para la app del cliente (recomendado).
3. **Repo nuevo** para la app del cliente: créalo vacío en GitHub y lo conecto.
4. **Skills**: ¿instalo las de la sección 9?
5. **Nombre** de la plataforma.

---

## Fuentes
- More Hub Admin (`eduar297/more-hub-admin`): README, `src/lib/provisioning/*`, migraciones master
  004/010/011/018 y tenant 025/026.
- Puck: https://github.com/puckeditor/puck · npm `@puckeditor/core`
- Supabase custom claims y RBAC: https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook ·
  https://supabase.com/docs/guides/api/custom-claims-and-role-based-access-control-rbac
- Vercel Hobby no comercial: https://vercel.com/docs/limits/fair-use-guidelines · https://vercel.com/docs/plans/hobby
- Vercel Pro: https://vercel.com/docs/plans/pro-plan
- API de Vercel: https://vercel.com/docs/rest-api/projects/create-a-new-project ·
  https://vercel.com/docs/rest-api/projects/create-one-or-more-environment-variables ·
  https://vercel.com/docs/rest-api/sdk/examples/deployments-automation
- Dominios por API: https://vercel.com/docs/platforms/multi-tenant-platforms/configuring-domains
- GitHub Actions + Vercel: https://vercel.com/kb/guide/how-can-i-use-github-actions-with-vercel
- Límites Supabase gratis: https://automationatlas.io/answers/supabase-free-tier-limits-2026/
- GoHighLevel Snapshots: https://ecosire.com/blog/gohighlevel-snapshots-guide
- Software de salones: https://glossgenius.com/blog/website-builder-for-salons · https://glossgenius.com/blog/fresha-vs-vagaro
- Librerías de landing: https://www.pkgpulse.com/guides/react-bits-vs-aceternity-magic-ui-2026
- Temas OKLCH: https://tweakcn-picker.vercel.app/docs/theming
- Skills: https://skills.sh/anthropics/claude-code/frontend-design ·
  https://claudemarketplaces.com/skills/leonxlnx/taste-skill/design-taste-frontend ·
  https://claudemarketplaces.com/skills/nextlevelbuilder/ui-ux-pro-max-skill/ui-ux-pro-max ·
  https://composio.dev/content/top-design-skills
