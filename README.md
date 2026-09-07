# Medusa B2C Boilerplate

Boilerplate de e-commerce B2C listo para arrancar MVPs y POCs. Monorepo con backend MedusaJS 2.x, storefront Next.js 15 con **checkout completo funcionando**, y búsqueda con Typesense desde el día cero.

## Stack

| Capa | Tecnología |
|------|------------|
| Backend | MedusaJS 2.18 (Postgres 15, Redis 7) |
| Storefront | Next.js 15 (App Router, React 19), Tailwind, Zustand |
| Búsqueda | Typesense 27 (módulo backend + subscribers + UI de búsqueda) |
| Monorepo | pnpm workspaces + Turborepo |
| Infra local | Docker Compose (db, redis, typesense) |

## Estructura

```
apps/
├── backend/        # Medusa: módulo typesense, subscribers, seed, scripts
└── storefront/     # Next.js: checkout, cart, PLP/PDP, cuenta, búsqueda
packages/
└── shared/         # Types y validadores Zod compartidos
infra/
└── docker-compose.yml   # postgres :5433, redis :6380, typesense :8109
scripts/
├── dev-with-docker.js   # `pnpm dev`: levanta Docker + apps
└── setup-medusa.js      # `pnpm setup:db`: migra, crea admin y seedea
```

> Los puertos de Docker son **5433** (postgres), **6380** (redis) y **8109** (typesense)
> a propósito, para no chocar con instalaciones o contenedores locales que usen los defaults.
>
> ¿Alguno está ocupado igual? Copiá `infra/.env.example` a `infra/.env` y pisá el puerto
> (`B2C_DB_PORT`, `B2C_REDIS_PORT`, `B2C_TYPESENSE_PORT`). Acordate de actualizar el
> puerto correspondiente en `apps/backend/.env` (`DATABASE_URL`, `REDIS_URL`, `TYPESENSE_PORT`)
> y en `apps/storefront/.env.local` si tocás Typesense.

## Requisitos

- Node >= 20.18
- pnpm >= 9
- Docker Desktop

## Quickstart

```bash
# 1. Instalar dependencias
pnpm install

# 2. Configurar envs (los defaults de dev ya funcionan)
cp apps/backend/.env.example apps/backend/.env
cp apps/storefront/.env.example apps/storefront/.env.local

# 3. Levantar infra + migrar + admin + seed
pnpm setup:db

# 4. Obtener la publishable key generada por el seed…
docker exec b2c-db psql -U postgres -d medusa -t \
  -c "SELECT token FROM api_key WHERE type='publishable';"
# …y pegarla en apps/storefront/.env.local → NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY

# 5. Indexar productos en Typesense
pnpm --filter @repo/backend typesense:sync

# 6. Levantar todo (Docker + backend + storefront)
pnpm dev
```

| URL | Qué es |
|-----|--------|
| http://localhost:3000 | Storefront |
| http://localhost:9000/app | Admin de Medusa (`admin@example.com` / `supersecret`) |
| http://localhost:9000/health | Health del backend |
| http://localhost:8109 | Typesense |

## Qué incluye

### Checkout completo (verificado E2E)
Flujo por pasos: datos personales → dirección (guest addresses en metadata del cart) → método de envío → códigos de descuento → pago → orden confirmada, con páginas de `success` / `failure` / `pending`.

**Pagos**: Manual (`pp_system_default`, funciona out-of-the-box), Stripe (se activa solo: `STRIPE_API_KEY` en backend + `NEXT_PUBLIC_STRIPE_KEY` en storefront). La UI de MercadoPago está portada pero requiere el provider correspondiente en el backend.

### Typesense end-to-end
- Módulo backend con schema de productos (categorías jerárquicas lvl0-2, precios, variantes, tags, brand opcional vía `metadata.brand`)
- Subscribers que sincronizan en `product.created/updated/deleted`
- Re-index completo: `pnpm --filter @repo/backend typesense:sync`
- PLP con facetas, orden por relevancia/ranking y búsqueda instantánea

### Extensión de Typesense en el Admin de Medusa
En **http://localhost:9000/app → Typesense** (i18n es/en):
- **Search playground**: probá queries con filtros, facetas y orden — los campos se derivan del schema vivo de la colección
- **Curations** (overrides): fijá/ocultá productos para queries específicas
- **Presets**: configuraciones de búsqueda guardadas
- **Synonyms** y **Stopwords**: tuneo de relevancia
- **Analytics**: queries populares, búsquedas sin resultados, productos más buscados (el storefront trackea vía `POST /store/typesense/analytics`)
- Sync manual y last-sync visibles desde el dashboard de la extensión

### Extensiones: Banners, Brands y Vimeo
Tres extensiones de admin + store, portadas/reconstruidas con paridad a Selectio/Saphirus:

- **Banners** (`/app → Banners`): módulo nativo con placements (`top_bar`, `banner_1..6`), contenido/media/CTA/color, ventana de fechas y estados draft/published/archived. El storefront los consume vía `GET /store/banners?placement=...` y los renderiza en el home (hero-banners + context). El seed crea 3 demo.
- **Brands** (`/app → Brands` + widget en la página de producto): módulo brand con link brand↔product, imágenes, CSV bulk/export. Store: `GET /store/brands` (solo activos). El seed crea 3 marcas demo con sus productos asociados. Ver [Cargar marcas en un proyecto nuevo](#cargar-marcas-en-un-proyecto-nuevo).
- **Vimeo** (`/app → Videos`): módulo OAuth (o personal access token), búsqueda/sync de videos, link video↔product, upload TUS. Store: `GET /store/videos[?product_id=]`. Sin credenciales el módulo carga igual y el admin muestra "no conectado" (degradación limpia). Configurá `VIMEO_*` en `apps/backend/.env`.

#### Cargar marcas en un proyecto nuevo

La marca vive en **dos lugares que se mantienen sincronizados**:

- **Entidad `brand` + link a producto** — el modelo formal (módulo `brand`). Es lo que muestra el widget de marca en la página de producto del admin y lo que devuelve `GET /store/brands`.
- **`product.metadata.brand` (string)** — es lo que el `product-mapper` de Typesense **realmente indexa** para el facet/filtro de marca del storefront (PLP). Sin esto la marca no aparece ni filtra en el front, aunque exista la entidad.

Por eso, cargar marcas significa escribir **ambos**. Tres formas, según el caso:

1. **Seed demo** (`pnpm db:seed`): `apps/backend/src/scripts/seed.ts` define `DEMO_BRANDS` + `PRODUCT_BRANDS`, crea las entidades, los links y setea `metadata.brand`. Editá esos dos objetos para tus marcas y productos.
2. **Admin** (manual, por producto): creá la marca en `/app → Brands` y asignala desde el widget de la página de producto. Para que aparezca en el storefront, además seteá `metadata.brand` en el producto y corré `pnpm typesense:sync`.
3. **Import masivo** (`pnpm vtex:import`): `apps/backend/src/scripts/import-vtex.ts` deriva las marcas del catálogo VTEX (caso supermercado), crea entidades + links y setea `metadata.brand` en cada producto.

En todos los casos, después de cargar/cambiar marcas corré **`pnpm typesense:sync`** para que el storefront las vea.

### Seed de demo
2 regiones (Argentina/ARS y Europa/EUR), tax regions con provider, ubicación de stock + 2 opciones de envío (Estándar/Express), sales channel + publishable key, 3 categorías, 6 productos con variantes y precios en ambas monedas, y 3 marcas demo (entidad + links + `metadata.brand`).

### Cart
Zustand con optimistic updates, drawer, promociones manuales en metadata, sincronización de inventario.

## Variables de entorno clave

### Backend (`apps/backend/.env`)
| Variable | Default dev | Notas |
|----------|-------------|-------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5433/medusa` | Puerto 5433 = Docker |
| `REDIS_URL` | `redis://localhost:6380` | Opcional (fallback in-memory) |
| `TYPESENSE_*` | host/puerto/key del docker-compose | |
| `STRIPE_API_KEY` | vacío | Activa el provider Stripe |
| `SENDGRID_API_KEY` | vacío | Manda los emails transaccionales por SendGrid (sin esto, se loguean) |
| `EMAIL_FROM` | `noreply@mercatto.com` | Remitente (from) de los emails, por proyecto |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | vacío | Activan el login con Google (ver sección dedicada) |
| `GOOGLE_CALLBACK_URL` | `http://localhost:3000/google-callback` | Página de callback del storefront (no del backend) |
| `GA_MEASUREMENT_ID` / `GA_API_SECRET` | vacío | Activan el tracking server-side de GA4 (ver [Google Analytics 4](#google-analytics-4-opcional)) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | admin@example.com / supersecret | Usado por `setup:db` |
| `SENTRY_DSN` | vacío | Opcional — activa el reporte de errores. Ver [Monitoreo de errores con Sentry](#monitoreo-de-errores-con-sentry) |

### Storefront (`apps/storefront/.env.local`)
| Variable | Notas |
|----------|-------|
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | **Requerida** — la genera el seed (paso 4 del quickstart) |
| `NEXT_PUBLIC_SALES_CHANNEL_ID` | Opcional — filtra catálogo por canal |
| `NEXT_PUBLIC_MIN_PURCHASE_AMOUNT` | Opcional — mínimo de compra (default: sin mínimo) |
| `NEXT_PUBLIC_STRIPE_KEY` | Opcional — habilita Stripe Elements |
| `GOOGLE_MAPS_API_KEY` | Opcional — autocompletado de direcciones con mapa |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | Opcional — `true` muestra el botón "Continuar con Google" |
| `GOOGLE_MAPS_API_KEY` | Opcional — autocompletado de direcciones con mapa. Ver [Google Maps en el flujo de dirección](#google-maps-en-el-flujo-de-dirección) para activarlo |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID` | Opcional — GA4 Measurement ID (`G-XXXXXXXXXX`). Ver [Google Analytics 4](#google-analytics-4-opcional) para activarlo |
| `NEXT_PUBLIC_SENTRY_DSN` | Opcional — activa el reporte de errores del frontend. Ver [Monitoreo de errores con Sentry](#monitoreo-de-errores-con-sentry) |
| `NEXT_PUBLIC_TYPESENSE_*` | Defaults apuntan al docker-compose |

## Cómo personalizar para un proyecto nuevo

1. **Branding**: `apps/storefront/src/lib/site-config/default.ts` — nombre, colores (CSS variables), nav, hero, secciones del home. Logo en `public/logo.svg`.
2. **Catálogo**: editá `apps/backend/src/scripts/seed.ts` o cargá productos desde el admin. Después corré `typesense:sync`.
3. **Regiones/monedas**: en el seed o desde el admin (Settings → Regions).
4. **Schema de búsqueda**: `apps/backend/src/modules/typesense/schema.ts` + `product-mapper.ts`. El campo `brand` se alimenta de `product.metadata.brand`.
5. **Pagos**: para MercadoPago agregá el provider en `medusa-config.ts`; la UI del storefront ya lo contempla (`src/lib/constants.tsx`).
6. **Google Maps**: opcional. Ver la sección siguiente para activar el autocompletado de direcciones por proyecto.
7. **Sentry**: opcional. Ver [Monitoreo de errores con Sentry](#monitoreo-de-errores-con-sentry) para activar el reporte de errores de frontend y backend por proyecto.

## Google Maps en el flujo de dirección

El formulario de dirección (checkout y libreta de direcciones de la cuenta) trae autocompletado de Google Places + un mapa con marcador arrastrable. La integración es **opcional y se degrada de forma limpia**: si no hay API key configurada, el formulario se renderiza igual con todos los campos editables a mano (calle, ciudad, código postal, provincia, depto/piso) y no se inyecta ningún script de Google.

Componentes involucrados:

- `apps/storefront/src/modules/common/components/address-form-with-map/index.tsx` — formulario con autocomplete + mapa (cuenta y checkout).
- `apps/storefront/src/modules/checkout/components/shipping-address/new-address-form.tsx` — variante del checkout.

### Cómo activarlo

1. **Crear / elegir un proyecto** en [Google Cloud Console](https://console.cloud.google.com/).
2. **Habilitar las APIs** necesarias (APIs & Services → Library):
   - **Maps JavaScript API** — render del mapa y el marcador.
   - **Places API** — autocompletado de direcciones (`AutocompleteSuggestion`).
   - **Geocoding API** — reverse geocoding al clickear/arrastrar el marcador.
3. **Crear la API key** (APIs & Services → Credentials → Create credentials → API key).
4. **Restringir la key** (obligatorio para producción — la key viaja al navegador):
   - **Application restrictions → HTTP referrers (web sites)**: agregá los dominios autorizados. Para desarrollo, `http://localhost:3000/*`; para producción, el dominio real del proyecto (`https://tu-dominio.com/*`). Sin esta restricción, cualquiera puede usar tu key.
   - **API restrictions → Restrict key**: limitala a las tres APIs del paso 2.
5. **Configurar la variable de entorno** en `apps/storefront/.env.local`:
   ```bash
   GOOGLE_MAPS_API_KEY=tu_api_key
   ```
   El storefront la lee server-side y la inyecta como prop a los componentes de dirección (no se expone como `NEXT_PUBLIC_*` en el código fuente; el script de Maps que la usa corre en el cliente, por eso las restricciones de dominio del paso 4 son las que protegen la key).

> **Facturación**: las APIs de Maps requieren una cuenta de facturación activa en Google Cloud. Hay un crédito mensual gratuito que suele cubrir el tráfico de un MVP; revisá el pricing vigente antes de ir a producción.

### Acotar la región

Por defecto la integración está acotada a **Argentina**. Si tu proyecto opera en otro país, ajustá estos puntos:

- `includedRegionCodes: ["ar"]` en `address-form-with-map/index.tsx` y `new-address-form.tsx` — sesga las sugerencias de autocomplete al país.
- `DEFAULT_CENTER` en `address-form-with-map/index.tsx` — centro inicial del mapa (hoy Buenos Aires).
- El filtro de países del `PhoneInput` (`ar`/`uy`) si cambiás el alcance del teléfono.

### Manejo de errores

La integración ya contempla los casos de borde: si la API de Places falla o no devuelve resultados, las sugerencias quedan vacías y el dropdown no se muestra; el reverse geocoding ignora respuestas con `status !== "OK"`. En todos los casos el usuario puede seguir completando la dirección manualmente sin que el flujo se rompa.

## Emails transaccionales con SendGrid

El backend trae un **provider de notificación custom** (`apps/backend/src/modules/email`) para el canal `email`: **renderiza plantillas HTML hardcodeadas en el código** y las manda por **SendGrid**. Las plantillas NO viven en SendGrid — son funciones TypeScript que devuelven `{ subject, html }`, con la temática de Mercatto (verde `#2e7d32`, marca, logo) como defaults.

El provider se **registra siempre**. Sin `SENDGRID_API_KEY`, en vez de mandar, **loguea el email en consola** (útil en dev y para no romper); con la key, envía de verdad. El **remitente (`from`) se define por entorno** vía `EMAIL_FROM` (default `noreply@mercatto.com`).

Archivos involucrados:

- `apps/backend/src/modules/email/service.ts` — el provider (`AbstractNotificationProviderService`): busca la plantilla por nombre, la renderiza y la manda por SendGrid (o loguea si no hay key).
- `apps/backend/src/modules/email/templates/` — las plantillas hardcodeadas (una por archivo) + el registry `index.ts` que mapea nombre → función. Helpers de branding en `email-helpers.ts`.
- `apps/backend/medusa-config.ts` — registra `Modules.NOTIFICATION` con este provider para `email` + el local para `feed`.
- `apps/backend/src/scripts/test-email.ts` — prueba de envío transaccional (`pnpm email:test`).

Plantillas incluidas (registry keys): `customer-register`, `password-reset`, `order-confirmation`, `order-notification-admin`, `order-tracking`, `order-cancelled`, `company-register`, `b2b-client-approved`, `quotation-notification-admin`, `quotation-rejected-admin`, `kit-cde-notification`, `stock-sync-report`.

### Cómo activarlo

1. **Crear la API key en SendGrid** (Settings → API Keys, permiso *Mail Send*) y **verificar un remitente** (Settings → Sender Authentication).
2. **Configurar el backend** en `apps/backend/.env`:
   ```bash
   SENDGRID_API_KEY=SG.xxxxxxxx
   EMAIL_FROM=no-reply@tudominio.com   # remitente verificado
   EMAIL_TEST_TEMPLATE=customer-register   # opcional — template del test
   SENDGRID_TEST_TO=vos@tudominio.com  # opcional (default: ADMIN_EMAIL)
   EMAIL_ICONS_BASE_URL=               # opcional — bucket de iconos del email
   ```
3. **Probar el envío** (reiniciá el backend para tomar las envs):
   ```bash
   pnpm --filter @repo/backend email:test                    # a SENDGRID_TEST_TO / ADMIN_EMAIL
   pnpm --filter @repo/backend email:test -- vos@dominio.com  # a un destinatario explícito
   ```
   Sin `SENDGRID_API_KEY` el email se loguea en consola; con la key, se manda por SendGrid.

### Personalizar una plantilla

Editá el archivo correspondiente en `src/modules/email/templates/`. Cada plantilla es una función `(data) => { subject, html }`: cambiás el HTML/copy directamente. El color, la marca y el logo se pueden pisar por email pasando `primary_color`, `cde_display_name` y `logo_url` en el `data` del `createNotifications`; si no, caen a los defaults de Mercatto. Para sumar una plantilla nueva, creá el archivo y registrala en `templates/index.ts`.

### Disparar los emails

El módulo **renderiza y manda**, pero cada email se dispara desde un *subscriber* que llama a `notificationService.createNotifications({ channel: 'email', template: '<nombre>', data })` (ver `src/subscribers/order-placed-gift-card.ts` como ejemplo). Conectar cada evento (registro, pedido, etc.) a su plantilla es trabajo por proyecto.

### Manejo de errores

Los fallos de envío se loguean con contexto: el `service` loguea el error y el script de test imprime el `message` y el `response.body` de SendGrid (causa real: key inválida, remitente no verificado). Si llega un nombre de plantilla que no está en el registry, el provider loguea `No template found` y no rompe el flujo.

### Desactivarlo

Dejá `SENDGRID_API_KEY` vacío. El provider sigue registrado pero **loguea** los emails en vez de mandarlos. No hace falta tocar código.

## Login con Google (opcional)

El boilerplate trae el login con Google listo para activar, sin tocar código. Se apoya en el auth provider oficial de Medusa (`@medusajs/medusa/auth-google`) y respeta el mismo aislamiento multi-tenant que el login con email/contraseña: la cuenta queda vinculada al `tenant_ids` de la tienda y se rechaza si pertenece a otra.

Si no configurás las credenciales, **el flujo degrada limpio**: el módulo Auth sigue usando solo `emailpass` y el botón "Continuar con Google" no se renderiza.

**Cómo activarlo:**

1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials) creá un OAuth Client ID (tipo *Web application*). Agregá como **Authorized redirect URI** exactamente el valor de `GOOGLE_CALLBACK_URL` (en dev: `http://localhost:3000/google-callback`; en prod: `https://tu-dominio/google-callback`).
2. En `apps/backend/.env` seteá `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` y `GOOGLE_CALLBACK_URL`. Al haber `GOOGLE_CLIENT_ID`, `medusa-config.ts` registra el módulo Auth con los providers `emailpass` **y** `google`.
3. En `apps/storefront/.env.local` seteá `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` para mostrar el botón en la pantalla de login.
4. Verificá que el dominio del storefront esté en `AUTH_CORS` del backend.

**Cómo funciona el flujo:**

- El botón llama a `sdk.auth.login("customer", "google", {})` y redirige a la pantalla de consentimiento de Google.
- Google vuelve a `apps/storefront/src/app/[countryCode]/google-callback/page.tsx`, que intercambia el código por un token y lo envía a la acción `googleCallback` de `src/app/api/store/auth/route.ts`.
- Esa acción crea el customer en el primer login (vinculándolo al tenant actual) o valida el tenant si ya existía. Si la cuenta pertenece a otra tienda, muestra el mismo aviso que el login con email.
- Cancelar el consentimiento o un error de Google se manejan en la página de callback con un mensaje claro y un link para volver a iniciar sesión.

> **Seguridad:** `GOOGLE_CLIENT_SECRET` vive solo en el backend; el storefront nunca lo recibe. El flag `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` solo controla la visibilidad del botón.

## Google Analytics 4 (opcional)

El boilerplate mide tráfico y embudo de ecommerce con **Google Analytics 4** usando una arquitectura **híbrida** (cliente + servidor). Es **opcional y se activa por proyecto/entorno**, con el mismo criterio que Stripe, Google Maps o el login con Google — se enciende cuando hace falta y degrada limpio si no.

**Por qué híbrido y no solo cliente:** un `purchase` disparado únicamente en el navegador se pierde si lo bloquea un ad-blocker o si el usuario cierra la pestaña tras pagar (caso típico del flujo de redirect de MercadoPago, donde la página de confirmación puede no cargar). Por eso los eventos de carrito y compra se emiten **server-side** desde el backend, que es la fuente de verdad. Los eventos de engagement que el backend no puede ver (page_view, view_item) se quedan en el cliente. La división es **sin solapamiento**: cada evento se emite en un solo lado, así no se duplican en GA4.

### Qué se mide y dónde

| Evento GA4 | Lado | Dónde |
|------------|------|-------|
| `page_view` | Cliente (`gtag.js`) | `apps/storefront/src/lib/analytics/google-analytics.tsx` |
| `view_item` | Cliente (`gtag.js`) | `apps/storefront/src/modules/products/templates/index.tsx` |
| `begin_checkout` | Cliente (`gtag.js`) | `apps/storefront/.../checkout/checkout-page-client.tsx` |
| `add_to_cart` | Servidor (Measurement Protocol) | Módulo `ga4` (`src/modules/ga4`) |
| `remove_from_cart` | Servidor (Measurement Protocol) | Módulo `ga4` (`src/modules/ga4`) |
| `add_shipping_info` | Servidor (Measurement Protocol) | Módulo `ga4` (`src/modules/ga4`) |
| `add_payment_info` | Servidor (Measurement Protocol) | Módulo `ga4` (`src/modules/ga4`) |
| `purchase` | Servidor (Measurement Protocol) | Módulo `ga4` (`src/modules/ga4`) |
| `sign_up`, `generate_lead`, `join_group`, … | Servidor (Measurement Protocol) | Módulo `ga4` — eventos de ciclo de vida configurables |

**Gestión desde el backoffice:** los eventos server-side se administran desde **Configuración → GA4 Eventos** en el admin. Ahí podés activar/desactivar y renombrar los eventos del embudo ecommerce (payload calculado automáticamente), crear mapeos propios evento Medusa ↔ evento GA4 con parámetros, ver el **por qué** de cada asociación y auditar en la pestaña **Actividad** cada envío (enviado / fallido / omitido) con su payload. Un botón **"Enviar evento de prueba"** valida la config contra el endpoint debug de GA4 sin registrar un hit real.

**Atribución (client_id):** para que los eventos server-side se asocien a la sesión/usuario correcto en GA4, el storefront lee el `client_id` de la cookie `_ga` y lo escribe en `cart.metadata.ga_client_id` al crear el carrito (`apps/storefront/src/lib/analytics/ga-client-id.ts` + `createCart` en `cart.repository.ts`). El módulo `ga4` lo lee de ahí. Es automático: si GA está apagado, no se agrega nada.

**Privacidad:** nunca se envían datos personales del usuario (email, nombre, dirección, teléfono). Solo datos de producto/transacción.

### Cómo activarlo

1. **Crear la propiedad GA4** en [Google Analytics](https://analytics.google.com/) (Admin → Create property → Web data stream). Copiá el **Measurement ID** (`G-XXXXXXXXXX`).
2. **Crear un API Secret** para el data stream (Admin → Data Streams → tu stream → Measurement Protocol API secrets → Create). Lo usa el backend para el envío server-side.
3. **Storefront** — eventos de cliente. En `apps/storefront/.env.local`:
   ```bash
   NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
   ```
4. **Backend** — eventos de servidor. En `apps/backend/.env`:
   ```bash
   GA_MEASUREMENT_ID=G-XXXXXXXXXX        # mismo id que el storefront
   GA_API_SECRET=xxxxxxxxxxxxxxxxxxxxxx  # el API Secret del paso 2
   # GA_DEBUG=true                       # opcional: NO envía eventos, solo valida
   ```
   El dispatch server-side (módulo `ga4`) se activa **solo si están GA_MEASUREMENT_ID y GA_API_SECRET**; los subscribers hacen no-op si faltan.
5. Reiniciá ambos. Verificá en GA4 → **Realtime**: navegación y vistas de producto desde el cliente, y add-to-cart/compra desde el backend. Desde el admin (**Configuración → GA4 Eventos**) usá **"Enviar evento de prueba"** para validar la config y la pestaña **Actividad** para auditar cada envío. Para los server-side también podés usar `GA_DEBUG=true` con el [Measurement Protocol validation server](https://developers.google.com/analytics/devguides/collection/protocol/ga4/validating-events).

> **Atención al doble conteo:** no agregues los eventos de carrito/compra también en el cliente (ni vía GTM apuntando a la misma propiedad). La división cliente/servidor está pensada para que cada evento se emita una sola vez; duplicarlos infla las métricas y corrompe el revenue.

### Desactivarlo

Dejá las variables vacías (o no las setees). Sin `NEXT_PUBLIC_GA_MEASUREMENT_ID` el cliente no carga el script y sus eventos quedan en no-op; sin `GA_MEASUREMENT_ID`/`GA_API_SECRET` los subscribers del backend hacen no-op y no se envía nada. No hace falta tocar código.

## Monitoreo de errores con Sentry

El boilerplate trae [Sentry](https://sentry.io) cableado en **frontend y backend** para reporte de errores. La integración es **opcional y se activa por entorno**: sin DSN configurado, Sentry queda desactivado, no se inicializa nada y el build/runtime no cambian. Mismo criterio que Stripe, Vimeo o Google Maps — se enciende por proyecto cuando hace falta.

Qué captura cuando está activo:

- **Storefront** (`@sentry/nextjs`): errores de cliente (browser), de renderizado en servidor (RSC / route handlers, vía `onRequestError`) y de Edge (middleware).
- **Backend** (`@sentry/node`): (1) excepciones no atrapadas y promesas rechazadas (`uncaughtException` / `unhandledRejection`) desde `apps/backend/instrumentation.ts`, y (2) errores HTTP de las rutas vía un `errorHandler` en `apps/backend/src/api/middlewares.ts` que envuelve al de Medusa ([patrón oficial](https://docs.medusajs.com/resources/integrations/guides/sentry)). Solo reporta errores 5xx/inesperados: los `MedusaError` esperables del cliente (4xx — validación, no encontrado, auth, pago rechazado) se filtran para no inundar la cuota.

Archivos involucrados:

- `apps/storefront/instrumentation-client.ts` — init del browser + instrumentación de navegación.
- `apps/storefront/instrumentation.ts` — init server/edge + `onRequestError`.
- `apps/storefront/sentry.server.config.ts` / `sentry.edge.config.ts` — config por runtime.
- `apps/storefront/next.config.js` — envuelve la config con `withSentryConfig` **solo si hay DSN**.
- `apps/backend/instrumentation.ts` — init de `@sentry/node` (lo ejecuta Medusa al arrancar).
- `apps/backend/src/api/middlewares.ts` — `errorHandler` que reporta errores HTTP 5xx a Sentry y delega en el handler default de Medusa.

### Cómo activarlo

1. **Crear los proyectos en Sentry** ([sentry.io](https://sentry.io)): conviene uno para el storefront (plataforma *Next.js*) y otro para el backend (plataforma *Node.js*). Cada uno te da su **DSN**.
2. **Configurar el storefront** en `apps/storefront/.env.local`:
   ```bash
   NEXT_PUBLIC_SENTRY_DSN=https://...ingest.sentry.io/...
   NEXT_PUBLIC_SENTRY_ENVIRONMENT=production   # opcional (default: NODE_ENV)
   ```
3. **Configurar el backend** en `apps/backend/.env`:
   ```bash
   SENTRY_DSN=https://...ingest.sentry.io/...
   SENTRY_ENVIRONMENT=production   # opcional (default: NODE_ENV)
   ```
4. **(Opcional) Subida de sourcemaps** del storefront en build, para ver stack traces legibles. Solo ocurre si están las tres variables; sin ellas el build no sube nada y **no rompe**:
   ```bash
   SENTRY_ORG=tu-org
   SENTRY_PROJECT=tu-proyecto-storefront
   SENTRY_AUTH_TOKEN=sntrys_...   # generar en Sentry → Settings → Auth Tokens
   ```

### Datos sensibles

`sendDefaultPii` está en `false` en los tres runtimes: Sentry **no** envía IP, cookies, headers ni body de request por defecto. El **Session Replay del browser queda deshabilitado** a propósito (captura el DOM y podría filtrar datos del usuario). El performance tracing arranca en `0` (apagado); subilo por entorno con `SENTRY_TRACES_SAMPLE_RATE` / `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` si lo necesitás.

### Activar solo en producción (local / develop sin envíos)

En entornos deployados como `develop` el DSN suele quedar seteado igual que en producción. Para **no consumir cuota ni mezclar errores de prueba con los reales** hay un kill-switch explícito, independiente del DSN:

- Storefront: `NEXT_PUBLIC_SENTRY_ENABLED`
- Backend: `SENTRY_ENABLED`

El default es **activo** cuando hay DSN. Poné el valor en `false` para apagar el envío aunque el DSN esté presente (en ese caso el storefront tampoco envuelve la config de Next ni sube sourcemaps):

```bash
# en el entorno local / develop
NEXT_PUBLIC_SENTRY_ENABLED=false   # storefront
SENTRY_ENABLED=false               # backend
```

Hay dos formas equivalentes de lograr "solo producción": dejar los DSN únicamente en el entorno de producción, o setear los DSN en todos lados y usar `*_SENTRY_ENABLED=false` en local/develop. Las dos mantienen local/develop sin enviar nada — especialmente útil en el **tier gratuito**, donde la cuota de errores es acotada.

### Desactivar Sentry por completo

Dejá los DSN vacíos (o no los setees). El storefront no envuelve la config de Next, el backend no inicializa el SDK, y no se reporta nada. No hace falta tocar código.

## Comandos útiles

```bash
pnpm dev              # Docker services + backend + storefront
pnpm dx:services      # Solo Docker (db, redis, typesense)
pnpm dx:down          # Bajar Docker y borrar volúmenes
pnpm setup:db         # Migraciones + admin + seed
pnpm typecheck        # tsc en todos los workspaces
pnpm --filter @repo/storefront test:e2e   # Playwright
```

## Gotchas conocidos

- **Tax regions**: necesitan `provider_id: 'tp_system'` — sin eso el add-to-cart explota. El seed ya lo hace.
- **Reglas de envío**: `enabled_in_store` va como `'true'` plano (no `'"true"'`) en Medusa 2.13.
- **Stock**: el storefront prioriza el stock indexado en Typesense; productos con `manage_inventory: false` se indexan como ilimitados.
- **`medusa db:setup`** deriva el nombre de la DB del directorio y agrega `DB_NAME` al `.env` — el script `setup:db` ya lo maneja, pero si corrés comandos `medusa db:*` a mano, tenelo en cuenta.
- **Índice de Typesense efímero**: la fuente de verdad es Postgres; Typesense es un índice derivado. Si recreás el contenedor (`dx:down`, cambio de puerto, volumen nuevo) la colección queda vacía y el home tira `AggregateError`/`Params: {}`. Solución: `pnpm --filter @repo/backend typesense:sync`. No se resincroniza solo por diseño — lo corrés cuando recreás el contenedor o cambiás el catálogo.
- **i18next / react-i18next**: pineados en el root (`pnpm.overrides`) a `23.7.11` / `13.5.0` para matchear `@medusajs/dashboard`. Si los actualizás y rompés esa paridad, el admin de Typesense vuelve a mostrar las keys crudas (vive en una instancia i18n distinta a la que Medusa inicializa).
