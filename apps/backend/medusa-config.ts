import { defineConfig, loadEnv, Modules } from '@medusajs/framework/utils';
import { existsSync } from 'node:fs';
import path from 'node:path';
import './src/loaders/plugin-runtime-bridge';
import './src/loaders/credential-runtime-bridge';
import { googleAuthEnvWarning, resolveGoogleAuthEnv } from './src/lib/google-auth-env';

loadEnv(process.env.NODE_ENV || 'development', __dirname);

// Generated projects contain only the selected extension source folders. Keep
// this central registry independent from those sources so an unselected module
// is neither imported nor registered by Medusa.
/**
 * Cuántos eventos procesa el worker del event bus a la vez. Ver el comentario largo
 * en el bloque `event_bus`: el default de BullMQ es 1 y con 1 un subscriber colgado
 * congela toda la tienda.
 */
const EVENT_BUS_CONCURRENCY = 10;

const hasExtensionSource = (folder: string) =>
  existsSync(path.join(__dirname, 'src', 'modules', folder));
// Space Designer is installed per project. Keeping discovery lazy allows stores
// without the plugin to boot, including before its first package release.
const hasSpaceDesignerPlugin = () => {
  if (process.env.SPACE_DESIGNER_ENABLED === 'false') return false;
  try {
    require.resolve('@minimalart/mercatto-plugin-space-designer/package.json');
    return true;
  } catch {
    return false;
  }
};
const optionalModule = (key: string, folder: string, options?: Record<string, unknown>) =>
  hasExtensionSource(folder)
    ? { [key]: { resolve: `./src/modules/${folder}`, ...(options ? { options } : {}) } }
    : {};

/**
 * Andreani. Igual que Correo (abajo): UNA sola implementación, y esto la reusa.
 *
 * Este bloque reimplementaba `loadAndreaniOptionsFromEnv()` línea por línea, con un
 * comentario en `env-options.ts` pidiendo mantener las dos copias en sync a mano.
 * Dos listas de env vars que podían divergir sin que nada avisara, y el síntoma
 * —envíos creados con un origen o un contrato distinto al cotizado— no apunta acá.
 *
 * Apunta a `settings.ts` y no a `env-options.ts` porque el módulo ya no lee
 * `process.env` a mano: el entorno pasó a ser una CAPA de `app-settings`, declarada
 * por el `env: [...]` de cada descriptor. Al evaluar esta config todavía no hay
 * contenedor ni snapshot, así que `getAndreaniBootOptions()` resuelve `env → default`,
 * que es exactamente lo que devolvía el bloque viejo.
 *
 * El `require` es PEREZOSO a propósito, no un import de tope de archivo: los
 * proyectos generados sólo traen las carpetas de las extensiones seleccionadas, así
 * que un import estático rompería el arranque de cualquier proyecto sin este módulo.
 * Se invoca únicamente dentro de la guarda, que ya verificó que la carpeta existe.
 */
const loadAndreaniOptionsFromEnv = () =>
  (
    require('./src/modules/andreani-fulfillment/settings') as typeof import('./src/modules/andreani-fulfillment/settings')
  ).getAndreaniBootOptions();

// Correo Argentino. A diferencia de Andreani —que duplica su loader acá y en
// `env-options.ts`, con un comentario pidiendo mantener las dos copias en sync—
// Correo tiene UNA sola implementación y esto la reusa. Dos copias de la lista de
// env vars significan que el provider puede terminar leyendo una configuración y
// el workflow de tickets otra, y el síntoma (envíos creados con un origen o un
// serviceType distinto al que se cotizó) no apunta al archivo de config.
//
// El `require` es PEREZOSO a propósito, no un import de tope de archivo: los
// proyectos generados traen solo las carpetas de extensión seleccionadas (por eso
// existe `hasExtensionSource`), así que un import estático haría fallar el
// arranque de cualquier proyecto que no incluya este módulo. Se invoca solo
// dentro de la guarda, que ya verificó que la carpeta existe.
const loadCorreoOptionsFromEnv = () =>
  (
    require('./src/modules/correo-argentino-fulfillment/env-options') as typeof import('./src/modules/correo-argentino-fulfillment/env-options')
  ).loadCorreoOptionsFromEnv();

// Register installed providers independently of runtime business settings.
// New payments are gated in the provider; existing payments can still settle.
const mercadoPagoEnabled = hasExtensionSource('mercado-pago');
const mercadoPagoApiEnabled = hasExtensionSource('mercado-pago-api');
// Cuenta Corriente: se registra siempre que exista el módulo (como Stripe con su
// key). El alta/baja del medio se hace por región desde el admin, NO por env: por
// eso ya no depende de COMPANY_CREDIT_ENABLED.
const cuentaCorrienteEnabled = hasExtensionSource('company-credit-payment');

/**
 * Login con Google. El gate mira las TRES variables (`GOOGLE_CLIENT_ID`,
 * `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`) y no sólo el clientId como antes,
 * porque el provider `auth-google` las exige a las tres: con dos de tres su loader
 * tira `Google callbackUrl is required` y, siendo Auth un módulo del CORE, eso no
 * degrada el login con Google — aborta el `medusa start` entero. Pasó en
 * producción el 2026-09-08. El por qué largo y el aviso de boot están en
 * `src/lib/google-auth-env.ts`, que es donde se pueden testear.
 */
const googleAuth = resolveGoogleAuthEnv();
const googleAuthWarning = googleAuthEnvWarning(googleAuth);
// `console.warn` y no el logger de Medusa: esto corre al EVALUAR este archivo,
// cuando todavía no hay contenedor de donde sacarlo (mismo criterio que el aviso
// de entorno de Andreani en `andreani-fulfillment/settings.ts`).
if (googleAuthWarning) console.warn(googleAuthWarning);

// Managed Postgres providers (DigitalOcean, etc.) require SSL but sign their
// certs with a private CA that Node doesn't trust. Newer `pg` treats
// sslmode=require as verify-full, so the connection fails CA verification and
// times out. Enable SSL with rejectUnauthorized=false for those hosts.
const databaseSslEnabled =
  process.env.DATABASE_SSL === 'true' ||
  (process.env.DATABASE_URL?.includes('ondigitalocean.com') ?? false);
const redisUrl = process.env.DISABLE_REDIS === 'true' ? undefined : process.env.REDIS_URL;

// ioredis tuning para Managed Valkey en DO. Sin esto, ioredis usa su default y una
// conexión que resuelve a IPv6 (o choca con el límite de conexiones del plan) se cuelga
// ~75s en el handshake TLS en vez de fallar rápido, reconectando en loop y estirando el
// boot a minutos (síntoma real: `connect ETIMEDOUT` durante el arranque → health check
// falla con `connection refused` porque el puerto 9000 nunca abre). `family: 0` hace un
// lookup dual-stack (DO suele resolver IPv6 primero); si el ETIMEDOUT persiste, forzar
// IPv4 con `family: 4`. Se pasa a cache/event-bus/locking (mismo Redis compartido).
// NOTA: `maxRetriesPerRequest` DEBE ser null: el event-bus-redis crea un Worker de BullMQ
// y BullMQ rechaza cualquier otro valor ("Your redis options maxRetriesPerRequest must be
// null") → crashea el boot. La aceleración del boot la dan connectTimeout + retryStrategy,
// no este parámetro, así que null no nos cuesta nada.
/**
 * Familia de direcciones para el lookup de DNS de ioredis: `4` (sólo IPv4),
 * `6` (sólo IPv6) o `0` (dual-stack).
 *
 * ES UNA ENV Y NO UN LITERAL PORQUE YA NOS COSTÓ UNA CAÍDA. El 2026-09-09 el
 * backend de desdeelsur arrancó con las tres conexiones principales sanas
 * (`cache-redis`, `event-bus-redis`, `locking-redis` en el mismo segundo) y la
 * conexión EXTRA que BullMQ duplica para su comando bloqueante se colgó en el
 * handshake TLS hasta agotar `connectTimeout`:
 *
 *   Error: connect ETIMEDOUT   at TLSSocket (ioredis/built/Redis.js:183)
 *   Error: Connection is closed.  at connectionCloseHandler (Redis.js:220)
 *
 * Sin ese worker no salen los mails de orden, ni el WhatsApp, ni se drena el
 * outbox del ERP — y el proceso queda SANO, con los crons y el HTTP corriendo,
 * así que nada se cae y nadie se entera. Fueron ~50 minutos y nos enteramos por
 * una compra de prueba.
 *
 * El default queda en `0` a propósito: es el comportamiento histórico de todas
 * las instalaciones y cambiarlo para todos por un problema de infra de una sería
 * la clase de decisión que después nadie puede explicar. La salida es prender
 * `REDIS_FAMILY=4` en el proyecto afectado, SIN deploy.
 */
const redisFamily = ((): 0 | 4 | 6 => {
  const raw = Number(process.env.REDIS_FAMILY);
  return raw === 4 || raw === 6 ? raw : 0;
})();

const redisOptions = redisUrl
  ? {
      connectTimeout: 10_000,
      family: redisFamily,
      maxRetriesPerRequest: null,
      retryStrategy: (times: number) => Math.min(times * 500, 5_000),
      enableReadyCheck: true,
    }
  : undefined;

// Workflow engine on Redis exists for HORIZONTAL scaling (multiple containers
// sharing workflow state via BullMQ). On a single container it's pure overhead:
// a BullMQ worker polling Redis constantly + a Redis round-trip on every
// workflow run (e.g. each add-to-cart) + reconnect storms when the connection
// flaps — all competing for the same shared vCPU as the HTTP server. We DON'T
// rely on its durability: the demo-store importer survives restarts via its own
// `ImportJob` table + cron, not the workflow engine. So default to in-memory and
// only opt into Redis (set WORKFLOW_ENGINE_REDIS=true) when running >1 container.
const workflowEngineRedis = !!redisUrl && process.env.WORKFLOW_ENGINE_REDIS === 'true';

const config = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    ...(databaseSslEnabled
      ? {
          databaseDriverOptions: {
            connection: {
              ssl: {
                rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'true',
              },
            },
          },
        }
      : {}),
    redisUrl,
    http: {
      storeCors: process.env.STORE_CORS || 'http://localhost:3000',
      adminCors: process.env.ADMIN_CORS || 'http://localhost:9000',
      authCors: process.env.AUTH_CORS || 'http://localhost:3000,http://localhost:9000',
      jwtSecret: process.env.JWT_SECRET || 'supersecret',
      cookieSecret: process.env.COOKIE_SECRET || 'supersecret',
    },
  },
  // RBAC del admin. El flag `rbac` activa el enforcement en las 48 rutas
  // anotadas del core; sin él, las tablas rbac_* se crean pero ninguna ruta
  // chequea permisos. `MEDUSA_FF_RBAC=true` funciona como override desde el
  // entorno cuando hace falta apagarlo por ambiente sin tocar el config.
  featureFlags: {
    rbac: true,
  },
  admin: {
    disable: process.env.DISABLE_ADMIN === 'true',
    // The prebuilt dashboard imports @tanstack/react-query as an external bare
    // specifier, and so do our admin extensions. Under pnpm the two resolve via
    // different symlink paths, so the admin build instantiates react-query twice
    // -> two QueryClientContexts -> "No QueryClient set" in production (dev is
    // fine because Vite serves a single module graph). Force a single instance.
    //
    // The SAME duplication breaks i18n: react-i18next/i18next get instantiated
    // twice, so the extension's `useTranslation().i18n.addResourceBundle(...)`
    // registers our namespaces on a DIFFERENT instance than the one the
    // dashboard renders with -> every custom admin label shows the raw key
    // (TITLE, COLUMN_NAME, ...) in production while dev looks fine. Deduping
    // react-i18next + i18next makes the extension share the dashboard's live
    // instance, so the per-page register*Translations() calls take effect.
    //
    // CRITICAL: return ONLY the delta, never the received `config`. Medusa runs
    // `mergeConfig(baseConfig, whatThisReturns)` and Vite's mergeConfig
    // CONCATENATES arrays. Returning the (mutated) baseConfig merges its own
    // `plugins` onto itself, so @vitejs/plugin-react runs twice and every
    // src/admin/**/*.tsx fails to transform with `The symbol "inWebWorker" has
    // already been declared`. Returning just `{ resolve: { dedupe } }` merges
    // the dedupe cleanly without duplicating the plugin pipeline.
    vite: () => ({
      resolve: {
        dedupe: [
          '@tanstack/react-query',
          'react',
          'react-dom',
          'react-i18next',
          'i18next',
          // react-router-dom: sin dedupe, una extensión que lo importa
          // (useNavigate/Link/useParams) recibe una SEGUNDA instancia cuyo Router
          // context está vacío → "useNavigate() may be used only in the context of
          // a <Router>" y la pantalla rompe (Demo Stores, Banners, etc.). Deduplicar
          // react-router-dom lo hace compartir la instancia del shell admin (esa
          // única copia resuelve su propio `react-router` internamente; NO agregar
          // `react-router` acá: en pnpm no está hoisteado y rompe el build de Vite).
          'react-router-dom',
        ],
      },
    }),
  },
  plugins: [
    ...(() => {
      try {
        require.resolve('@minimalart/mercatto-plugin-marketplaces/package.json');
        return [{ resolve: '@minimalart/mercatto-plugin-marketplaces', options: {} }];
      } catch { return []; }
    })(),
    ...(hasSpaceDesignerPlugin()
      ? [{ resolve: '@minimalart/mercatto-plugin-space-designer', options: {} }]
      : []),
    // Contact form + submissions management (migrated from the in-tree
    // extension). Ships its own module, admin UI, admin/store routes and
    // migrations. Multitenant integration is handled by the plugin's local
    // shim against `demo_store`.
    { resolve: '@minimalart/mercatto-plugin-contact', options: {} },

    // Loyalty program: points ledger + engine (migrated from the in-tree
    // extensions `loyalty-points` and `loyalty-engine`). Ships two modules
    // (`points` and `loyalty`), admin UI (8 routes + customer widget),
    // admin/store routes, workflows, subscribers, an expiration job, and
    // storefront subpath exports for account/checkout components. Multi-
    // tenant scoping uses its local `lib/multistore` copy — degrades to
    // no-op filter when `demo_store` module is not registered.
    { resolve: '@minimalart/mercatto-plugin-loyalty', options: {} },

    // Commerce dashboard — pre-aggregated snapshot analytics (revenue, orders,
    // customers, top products/collections/categories). Migrated from the in-tree
    // `commerce-dashboard` module. Ships the module, admin UI (recharts), admin
    // routes and the `aggregate-commerce-metrics` workflow. Kept as `unscoped`
    // in the host's screen registry; the plugin infers the active
    // `sales_channel_id` from `demo_store` when present.
    { resolve: '@minimalart/mercatto-plugin-commerce-dashboard', options: {} },

    // Database explorer — read-only admin tool to browse core Medusa + custom
    // tables (rows, relations, schema graph, saved views) with backend
    // allowlisting, sensitive-column masking and audit log. Migrated from the
    // in-tree `database-explorer` module. All routes are `not-applicable` under
    // the host's multitenant scope registry (navigates the whole DB by design).
    { resolve: '@minimalart/mercatto-plugin-database-explorer', options: {} },

    // Dynamic customer groups — self-recalculating rule-based groups that
    // manage native Medusa customer_groups. Real-time via subscribers
    // (order.placed, customer.created/updated), plus a periodic sweep for
    // time-based rules (DYNAMIC_GROUPS_RECALC_CRON). Migrated from the
    // in-tree `dynamic-groups` module.
    { resolve: '@minimalart/mercatto-plugin-dynamic-groups', options: {} },

    // Media library — catalog of media assets (rows) served through the core
    // File module (S3 or local, per env). Provides the media-library admin
    // route, the picker consumed by seo-geo/store-config/puck email-config,
    // and the product-detail widget. Migrated from the in-tree
    // `media-library` module.
    { resolve: '@minimalart/mercatto-plugin-media-library', options: {} },

    // Abandoned cart — self-recovering carts with a 3-step email cadence
    // (steps and thresholds edited from admin via app-settings; WhatsApp
    // templates optional via kapso-whatsapp). Migrated from the in-tree
    // `abandoned-cart` module. Consume el runtime contract; el bridge del host
    // vive en src/loaders/plugin-runtime-bridge.ts y sirve a este y a cualquier
    // plugin futuro que use `@minimalart/mercatto-plugin-runtime`.
    { resolve: '@minimalart/mercatto-plugin-abandoned-cart', options: {} },

    // Brands — catalog of marcas linked to products (product_brand link module)
    // with per-site scoping via sales_channel_ids. Migrated from the in-tree
    // `brand` module. Storefront routes stay in apps/storefront (logo-showcase).
    { resolve: '@minimalart/mercatto-plugin-brands', options: {} },

    // Checkout links — preloaded public checkout URLs (products + optional
    // customer data/promos) generated from the admin, à la draft orders.
    // Migrated from the in-tree `checkout-link` module. Storefront route
    // (`/[countryCode]/c/[token]`) stays in apps/storefront.
    { resolve: '@minimalart/mercatto-plugin-checkout-links', options: {} },

    // Beneficios de Pago — beneficios informativos por medio de pago (cuotas,
    // descuentos, reintegros). Sync desde Mercado Pago (medios + cuotas) + carga
    // manual. Nunca modifica el precio del producto. Migrado desde el módulo
    // in-tree `payment_benefits`. Store routes (/store/payment-benefits,
    // /store/payment-methods) también viajan con el plugin.
    { resolve: '@minimalart/mercatto-plugin-payment-benefits', options: {} },

    // Blog — editorial articles (Tiptap content) with category taxonomy +
    // associated catalog products. Admin CRUD + publish/duplicate, public
    // read by slug for storefront. Migrated from the in-tree `blog` module.
    // Storefront routes stay in apps/storefront. Note: apps/backend keeps a
    // copy of src/admin/translations/blog/ because the banners AI compose
    // drawer imports registerBlogTranslations from there — resolves in Fase B.
    { resolve: '@minimalart/mercatto-plugin-blog', options: {} },

    // Landing pages — visual builder (Puck) authored pages with AI-assisted
    // content generation. Admin CRUD + publish/duplicate + AI routes,
    // public read by slug for the storefront renderer. Migrated from the
    // in-tree `landing-page` module. The host keeps
    // apps/backend/src/modules/landing-page/ as a dormant shim because banner
    // AI and ai-assistant campaign-enrich still import
    // ai/{client,image-client,image-optimize,generator,puck-schema,types}
    // from there. `storeConfig` (host module) is resolved by string key at
    // runtime for AI overrides — see src/lib/foreign-modules.ts in the plugin.
    { resolve: '@minimalart/mercatto-plugin-landing-pages', options: {} },

    // Banners — home placement banners (hero, promo) with AI-assisted copy +
    // image generation via OpenRouter, publish/archive workflows and per-
    // sales-channel scoping. Admin CRUD + AI compose/generate/image, store API
    // for placement resolution and click/impression tracking. Migrated from
    // the in-tree `banner` module. The host keeps a dormant shim at
    // apps/backend/src/modules/banner/ because ai-assistant campaign-enrich
    // still resolves BANNER_MODULE and workflows/create-banner.ts is kept
    // in-tree for the dynamic import from ai-assistant artifact-tools.
    // `storeConfig` (host module) is resolved by string key at runtime for AI
    // overrides — see src/lib/foreign-modules.ts in the plugin.
    { resolve: '@minimalart/mercatto-plugin-banners', options: {} },

    // Comments — customer product reviews with moderation (admin) and per-site
    // config (comment mode, moderation policy, edit window, rate limits).
    // Migrated from the in-tree `comments` module. Storefront server actions
    // stay in host under apps/storefront/src/lib/data/.
    { resolve: '@minimalart/mercatto-plugin-comments', options: {} },

    // Google Analytics 4 — server-side dispatch of ecommerce events via
    // Measurement Protocol, with per-site mapping and per-site builtins.
    // Migrated from the in-tree `ga4` module. Storefront gtag.js wrapper
    // (page_view/view_item/begin_checkout) stays in apps/storefront under
    // src/lib/analytics/ — that layer talks to gtag.js, not to this plugin.
    { resolve: '@minimalart/mercatto-plugin-ga4', options: {} },

    // Wishlist — customer favorites: one wishlist per customer, N items each
    // pointing to a product_variant. Backend module + /store/customers/me/wishlist
    // endpoints. Storefront experience (button, drawer, account overview,
    // Next.js proxy routes) stays in the host under apps/storefront/.
    { resolve: '@minimalart/mercatto-plugin-wishlist', options: {} },

    // PDF Catalog — per-site PDF catalogs with clickable hotspots that add
    // products to the cart. Backend generates and stores; storefront viewer +
    // cart live in host under apps/storefront/src/modules/pdf-catalog/.
    // Migrated from the in-tree `pdf-catalog` module.
    { resolve: '@minimalart/mercatto-plugin-pdf-catalog', options: {} },

    // Catalogador — mass AI-assisted product catalog enrichment (reviewable,
    // resumable, recoverable executions) with barcode + web scraping,
    // OpenRouter text/vision + image models and lifestyle composition.
    // Migrated from the in-tree `catalogador` module. `storeConfig` (host
    // module) is resolved by string key at runtime to persist the plugin's
    // `catalogador_config` setting — see src/lib/foreign-modules.ts.
    { resolve: '@minimalart/mercatto-plugin-catalogador', options: {} },

    // Fiscal documentation — versioned constancias de inscripción from ARCA
    // (per-owner history, snapshot diff, PDF, retention policy) bundled with
    // the ARCA WSAA + padrón A5 client that also powers the storefront
    // Factura A autocomplete (`/store/arca/taxpayer-lookup`). Migrated from
    // the in-tree `fiscal-documentation` + `arca` modules. Per-store settings
    // and per-store credentials fall back to env-only reads inside the plugin
    // until `app-settings` and the `site_credential` reader are extracted to a
    // shared package — see the plugin's CHANGELOG for details.
    { resolve: '@minimalart/mercatto-plugin-fiscal-documentation', options: {} },

    // Shop by Look — shoppable editorial looks for the home (image + hotspots
    // + editable product list). Admin CRUD + segmented public endpoint (per
    // sales channel / region) with per-store toggle honoured via storeConfig
    // (host module) resolved by string key. Migrated from the in-tree
    // `shop-by-look` module.
    { resolve: '@minimalart/mercatto-plugin-shop-by-looks', options: {} },

    // Videos — Vimeo integration for shoppable videos. Ships admin CRUD,
    // Vimeo OAuth, product-video links, and store API. Storefront viewer
    // (shoppable-videos in home) stays in host. Migrated from the in-tree
    // `vimeo-video` module. Las 5 opciones son las MISMAS que la extensión
    // pasaba antes de migrar — Medusa las inyecta al service constructor del
    // módulo. Sin `accessToken`, el admin muestra "no conectado" aunque el
    // env esté en DO: los envs no llegan al service si no viajan por aquí.
    {
      resolve: '@minimalart/mercatto-plugin-videos',
      options: {
        clientId: process.env.VIMEO_CLIENT_ID,
        clientSecret: process.env.VIMEO_CLIENT_SECRET,
        redirectUri: process.env.BACKEND_URL
          ? `${process.env.BACKEND_URL}/admin/vimeo/oauth/callback`
          : 'http://localhost:9000/admin/vimeo/oauth/callback',
        accessToken: process.env.VIMEO_ACCESS_TOKEN,
        folderUri: process.env.VIMEO_FOLDER_URI,
      },
    },

    // Gift cards + store credit (loyalty). The official plugin owns monetary
    // value; the Mercatto plugin owns issuance intent, delivery orchestration,
    // secure landing/claim/wallet flow and the SendGrid webhook receiver.
    // Migrated from `apps/backend/src/{modules/gift-card-experience, api/{admin,store}/gift-card-experience,
    // api/webhooks/sendgrid-gift-cards, admin/{routes/gift-card-experience, hooks/api/gift-cards.tsx},
    // workflows/hooks/gift-card-cart-validation.ts, subscribers/*gift-card*, jobs/*gift-card*}` to
    // @minimalart/mercatto-plugin-gift-cards. The Mercatto plugin depends on the
    // official plugin's workflows (`claimGiftCardWorkflow`, `createGiftCardsWorkflow`)
    // so both are registered together and unconditionally — the previous
    // `hasExtensionSource('gift-card-experience')` gate is gone now that the
    // in-tree module was deleted.
    {
      resolve: '@medusajs/loyalty-plugin',
      options: { prefix: 'MRC', sections: 3 },
    },
    { resolve: '@minimalart/mercatto-plugin-gift-cards', options: {} },

    // Google Analytics 4 — el tracking server-side de eventos ecommerce
    // (add_to_cart, remove_from_cart, add_shipping_info, add_payment_info,
    // purchase) YA NO usa el plugin @variablevic/google-analytics-medusa: se
    // migró al módulo interno `ga4` (src/modules/ga4), donde esos eventos son
    // configurables (activar/desactivar + renombrar) desde el backoffice. El
    // storefront sigue cubriendo page_view/view_item/begin_checkout (gtag.js) y
    // puentea el client_id en cart.metadata.ga_client_id para la atribución.
  ],
  modules: {
    // Cache — redis when available, otherwise in-memory (default)
    ...(redisUrl
      ? {
          [Modules.CACHE]: {
            resolve: '@medusajs/medusa/cache-redis',
            options: {
              redisUrl,
              redisOptions,
            },
          },
        }
      : {}),

    // Event bus — redis when available, otherwise local
    // NOTE: Medusa 2.x uses the string key 'event_bus' (not Modules.EVENT_BUS)
    ...(redisUrl
      ? {
          event_bus: {
            /**
             * El módulo de Medusa ENVUELTO, no reemplazado: hereda de
             * `@medusajs/medusa/event-bus-redis` y le agrega el supervisor que
             * reconstruye el worker de BullMQ cuando su `run()` muere. Medusa lo
             * arranca UNA vez y no lo reintenta jamás: tres caídas mudas en
             * producción (2026-08-31, 09-03 y 09-09) con el proceso sano. Mismas
             * opciones, mismo prefijo de cola. Ver `src/modules/event-bus-redis/index.ts`
             * y `src/lib/event-bus-worker-supervisor.ts`. NO volver a apuntar acá
             * al paquete pelado: se pierde el supervisor y vuelve el bug.
             */
            resolve: './src/modules/event-bus-redis',
            options: {
              redisUrl,
              redisOptions,
              /**
               * CONCURRENCIA DEL WORKER. Sin esto BullMQ usa su default, que es 1.
               *
               * Con 1, TODA la instalación procesa un evento por vez, y un solo
               * subscriber que se cuelgue congela absolutamente todo lo asincrónico
               * de la tienda. No es teórico: el 2026-08-31 a las 21:35:33 se cortaron
               * en el MISMO segundo las notificaciones por event bus, el outbox del
               * ERP y el WhatsApp de desdeelsur, y estuvieron tres días sin volver.
               * Seis órdenes se quedaron sin mail, sin WhatsApp y sin llegar al ERP.
               *
               * Y no se cayó el proceso: el cron de Typesense (cada 15 min) corrió sin huecos
               * todo ese tiempo y los `cart-abandoned` —que salen de un job, no del
               * bus— siguieron saliendo. Lo que murió fue el consumidor, adentro de un
               * proceso sano. Nadie se enteró en tres días.
               *
               * Peor todavía: `lockDuration` se renueva con un timer INDEPENDIENTE del
               * handler, así que un subscriber que hace una llamada de red sin timeout
               * y nunca resuelve tampoco se marca como stalled. Ocupa el slot para
               * siempre y BullMQ no lo detecta.
               *
               * 10 y no 1 porque un colgado tiene que costar UN slot y no la tienda
               * entera; 10 y no 50 porque cada evento dispara todos sus subscribers y
               * varios pegan a Postgres — subirlo sin medir cambia el bug de lugar en
               * vez de arreglarlo. Es un piso deliberado: hay que medirlo con carga
               * real antes de tocarlo.
               *
               * EL LOADER LO LEE DE ACÁ, verificado en el paquete instalado
               * (`event-bus-redis/dist/loaders/index.js:10,35`): destructura
               * `workerOptions` de las opciones del módulo y lo registra como
               * `eventBusRedisWorkerOptions`, que es lo que el servicio spreadea sobre
               * el `new Worker`. No alcanza con ponerlo en `redisOptions`.
               *
               * ESTO NO CIERRA EL OTRO MECANISMO, y conviene tenerlo escrito. En
               * `event-bus-redis/dist/services/event-bus-redis.js:21` el arranque hace
               * `void this.bullWorker_.run().catch(err => logger.error(...))`: si
               * `run()` rechaza, Medusa LOGUEA Y NO LO VUELVE A ARRANCAR NUNCA. Contra
               * eso la concurrencia no puede nada. Ese mecanismo lo cierran otras dos
               * piezas: el módulo `./src/modules/event-bus-redis` del `resolve` de
               * arriba, que reconstruye el worker cuando `run()` muere, y el job
               * `event-bus-monitor`, que mide la cola desde fuera del bus y avisa.
               */
              workerOptions: { concurrency: EVENT_BUS_CONCURRENCY },
            },
          },
        }
      : {}),

    // Workflow engine — redis ONLY for multi-container deployments (opt-in via
    // WORKFLOW_ENGINE_REDIS=true). Default is in-memory: no BullMQ worker, no
    // per-run Redis round-trip, no reconnect storms. See note above redisUrl.
    ...(workflowEngineRedis
      ? {
          [Modules.WORKFLOW_ENGINE]: {
            resolve: '@medusajs/medusa/workflow-engine-redis',
            options: {
              redis: {
                url: redisUrl,
              },
            },
          },
        }
      : {
          [Modules.WORKFLOW_ENGINE]: {
            resolve: '@medusajs/medusa/workflow-engine-inmemory',
          },
        }),

    // Locking — redis when available, otherwise Medusa's in-memory default.
    // CRITICAL: the in-memory locking provider keeps every lock in a heap `Map`
    // with NO background eviction — expired locks are only dropped lazily when
    // the SAME key is re-acquired, and locks taken by a workflow step that fails
    // before its release step (e.g. add-to-cart) are never freed. Under cart
    // traffic those `cart_*` locks (and the queued waiters they retain) pile up
    // in the heap until the process OOMs — independent of the cache/workflow
    // Redis config, which is exactly the leak we observed. Redis moves locks out
    // of the process and expires them reliably. Single shared key prefix
    // (`medusa_lock:`), reuses the same Redis as cache/event-bus.
    ...(redisUrl
      ? {
          [Modules.LOCKING]: {
            resolve: '@medusajs/medusa/locking',
            options: {
              providers: [
                {
                  resolve: '@medusajs/medusa/locking-redis',
                  id: 'locking-redis',
                  is_default: true,
                  options: {
                    redisUrl,
                    redisOptions,
                  },
                },
              ],
            },
          },
        }
      : {}),

    // Auth: emailpass (email/password) is Medusa's built-in default. Google
    // OAuth registers ONLY when its THREE env vars are set — see `googleAuth`
    // above: gating on GOOGLE_CLIENT_ID alone made an incomplete set abort the
    // whole boot instead of leaving Google login off. IMPORTANT: declaring the
    // Auth module here overrides Medusa's default providers, so emailpass MUST be
    // listed alongside google — otherwise email/password login would stop working.
    ...(googleAuth.enabled
      ? {
          [Modules.AUTH]: {
            resolve: '@medusajs/medusa/auth',
            options: {
              providers: [
                {
                  resolve: '@medusajs/medusa/auth-emailpass',
                  id: 'emailpass',
                },
                {
                  resolve: '@medusajs/medusa/auth-google',
                  id: 'google',
                  options: {
                    clientId: process.env.GOOGLE_CLIENT_ID,
                    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
                  },
                },
              ],
            },
          },
        }
      : {}),

    // Payment: system/manual provider is always available (Medusa built-in).
    // Stripe registers when STRIPE_API_KEY is set; MercadoPago when its explicit
    // toggle (MERCADOPAGO_ENABLED=true + token) is on.
    ...(process.env.STRIPE_API_KEY ||
    mercadoPagoEnabled ||
    mercadoPagoApiEnabled ||
    cuentaCorrienteEnabled
      ? {
          [Modules.PAYMENT]: {
            resolve: '@medusajs/payment',
            options: {
              providers: [
                ...(process.env.STRIPE_API_KEY
                  ? [
                      {
                        resolve: '@medusajs/payment-stripe',
                        id: 'stripe',
                        options: {
                          apiKey: process.env.STRIPE_API_KEY,
                          webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
                        },
                      },
                    ]
                  : []),
                ...(mercadoPagoEnabled
                  ? [
                      {
                        resolve: './src/modules/mercado-pago',
                        id: 'mercadopago',
                        options: {
                          accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
                          webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET,
                          publicKey: process.env.MERCADOPAGO_PUBLIC_KEY,
                          backendUrl: process.env.MEDUSA_BACKEND_URL || process.env.BACKEND_URL,
                          storefrontUrl: process.env.STOREFRONT_URL,
                          // Per-branch accounts (JSON map keyed by branch code /
                          // sales_channel_id). Optional — global token is the fallback.
                          accounts: process.env.MERCADOPAGO_ACCOUNTS,
                        },
                      },
                    ]
                  : []),
                // MercadoPago Checkout API (embedded/tokenized). Distinct provider
                // id (pp_mercadopagoapi_mercadopagoapi) so it coexists with the
                // Express provider above. Shares the same MP credentials/accounts.
                ...(mercadoPagoApiEnabled
                  ? [
                      {
                        resolve: './src/modules/mercado-pago-api',
                        id: 'mercadopagoapi',
                        options: {
                          accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
                          webhookSecret: process.env.MERCADOPAGO_WEBHOOK_SECRET,
                          publicKey: process.env.MERCADOPAGO_PUBLIC_KEY,
                          backendUrl: process.env.MEDUSA_BACKEND_URL || process.env.BACKEND_URL,
                          accounts: process.env.MERCADOPAGO_ACCOUNTS,
                        },
                      },
                    ]
                  : []),
                // Cuenta Corriente (crédito comercial B2B). Medio interno sin
                // credenciales; se ofrece solo a empresas con cuenta activa y
                // crédito suficiente (gate en checkout + validación dura en el
                // provider). Opt-in: COMPANY_CREDIT_ENABLED=true.
                ...(cuentaCorrienteEnabled
                  ? [
                      {
                        resolve: './src/modules/company-credit-payment',
                        id: 'cuenta_corriente',
                        options: {},
                      },
                    ]
                  : []),
              ],
            },
          },
        }
      : {}),

    // Notification: custom email provider (./src/modules/email) for the `email`
    // channel — renders the hardcoded HTML templates and sends them via SendGrid.
    // Always registered: without SENDGRID_API_KEY the provider logs the email to
    // the console instead of crashing, so the `email` channel is always present.
    // The sender/from is per-project via EMAIL_FROM. The local provider keeps the
    // `feed` channel (admin notifications) working when we override the defaults.
    [Modules.NOTIFICATION]: {
      resolve: '@medusajs/medusa/notification',
      options: {
        providers: [
          ...(hasExtensionSource('email')
            ? [
                {
                  resolve: './src/modules/email',
                  id: 'email-provider',
                  options: {
                    channels: ['email'],
                    from: process.env.EMAIL_FROM || 'noreply@mercatto.com',
                    sendgrid_api_key: process.env.SENDGRID_API_KEY,
                  },
                },
              ]
            : []),
          // WhatsApp via Kapso para el canal `whatsapp`. Siempre registrado:
          // sin KAPSO_API_KEY el provider loguea el mensaje en vez de fallar, así
          // el canal `whatsapp` está siempre presente. El phone_number_id y la API
          // key vienen por env (credenciales del proyecto Kapso).
          ...(hasExtensionSource('kapso-whatsapp')
            ? [
                {
                  resolve: './src/modules/kapso-whatsapp',
                  id: 'kapso-whatsapp',
                  options: {
                    channels: ['whatsapp'],
                    api_key: process.env.KAPSO_API_KEY,
                    phone_number_id: process.env.KAPSO_PHONE_NUMBER_ID,
                    base_url: process.env.KAPSO_BASE_URL,
                    business_account_id: process.env.KAPSO_BUSINESS_ACCOUNT_ID,
                    config_id: process.env.KAPSO_CONFIG_ID,
                  },
                },
              ]
            : []),
          {
            resolve: '@medusajs/medusa/notification-local',
            id: 'local',
            options: {
              name: 'Local Notification Provider',
              channels: ['feed'],
            },
          },
        ],
      },
    },

    // Fulfillment: manual provider always available; Andreani registers only
    // when ANDREANI_USERNAME is set, Correo Argentino only when
    // CORREO_ARGENTINO_API_KEY is set (credentials come from env). Sin
    // credenciales, la app arranca igual y el carrier simplemente no existe.
    [Modules.FULFILLMENT]: {
      resolve: '@medusajs/fulfillment',
      options: {
        providers: [
          {
            resolve: '@medusajs/fulfillment-manual',
            id: 'manual',
          },
          // El gate es SÓLO la existencia de la carpeta, no la presencia de
          // credenciales. Con las credenciales en `site_credential`, un gate por env
          // dejaría al carrier sin registrar y las shipping options que apuntan a
          // `andreani_andreani` quedarían huérfanas. Sin credenciales en ningún lado
          // el provider se registra igual y degrada, como ya hacen los de email y
          // kapso. Aparte, el gate viejo miraba sólo USERNAME mientras la
          // normalización exigía tres: con la password vacía el backend no arrancaba.
          ...(hasExtensionSource('andreani-fulfillment')
            ? [
                {
                  resolve: './src/modules/andreani-fulfillment',
                  id: 'andreani',
                  options: loadAndreaniOptionsFromEnv(),
                },
              ]
            : []),
          // provider_id resultante: `correo_argentino_correo_argentino`.
          // Clave de contenedor: `fp_correo_argentino_correo_argentino`.
          // Mismo criterio que Andreani, arriba: la API key ya no es gate. Puede
          // vivir sólo en `site_credential`, y esta config se evalúa antes de que
          // haya conexión a la base. Con el gate viejo, migrar la key a la base
          // dejaba el provider sin registrar: la extensión instalada, las shipping
          // options apuntando a un `provider_id` inexistente y el checkout sin
          // envío. `normalizeCorreoOptions()` dejó de tirar por eso mismo.
          ...(hasExtensionSource('correo-argentino-fulfillment')
            ? [
                {
                  resolve: './src/modules/correo-argentino-fulfillment',
                  id: 'correo_argentino',
                  options: loadCorreoOptionsFromEnv(),
                },
              ]
            : []),
        ],
      },
    },

    // File storage. We ALWAYS register the File module so the public URL base is
    // explicit — otherwise the built-in local provider returns
    // `http://localhost:9000/static/...` even in production (mixed-content +
    // broken images). When S3_* env vars are set we use the S3 provider
    // (S3-compatible: AWS S3 / DigitalOcean Spaces) so uploads persist; otherwise
    // we use the local provider but point its `backend_url` at the real backend.
    //
    // NOTE: the S3 provider ships INSIDE @medusajs/medusa, so it resolves as
    // `@medusajs/medusa/file-s3` (not the standalone `@medusajs/file-s3`, which
    // isn't a dependency here and fails to resolve).
    [Modules.FILE]: {
      resolve: '@medusajs/medusa/file',
      options: {
        providers: process.env.S3_BUCKET
          ? [
              {
                resolve: '@medusajs/medusa/file-s3',
                id: 's3',
                options: {
                  // PUBLIC base URL used to build returned URLs (CDN/origin).
                  // Acepta S3_FILE_URL o S3_PUBLIC_URL (alias usado en prod).
                  file_url: process.env.S3_FILE_URL || process.env.S3_PUBLIC_URL,
                  access_key_id: process.env.S3_ACCESS_KEY_ID,
                  secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
                  region: process.env.S3_REGION,
                  bucket: process.env.S3_BUCKET,
                  // Acepta S3_ENDPOINT o S3_URL (alias usado en prod).
                  endpoint: process.env.S3_ENDPOINT || process.env.S3_URL,
                  ...(process.env.S3_PREFIX ? { prefix: process.env.S3_PREFIX } : {}),
                },
              },
            ]
          : [
              {
                resolve: '@medusajs/medusa/file-local',
                id: 'local',
                options: {
                  backend_url: `${(
                    process.env.BACKEND_URL ||
                    process.env.MEDUSA_BACKEND_URL ||
                    'http://localhost:9000'
                  ).replace(/\/$/, '')}/static`,
                },
              },
            ],
      },
    },

    // Ajustes de aplicación: valores de configuración por namespace, para que
    // las extensiones se configuren desde el admin en vez del `.env`.
    //
    // Va SIN `optionalModule` a propósito: es core, no una extensión. Si la
    // carpeta faltara, `optionalModule` lo saltearía en silencio y cada
    // extensión que lo resuelve fallaría después, en runtime y de a una. Así
    // falla al arrancar, que es donde se puede diagnosticar.
    appSettings: { resolve: './src/modules/app-settings' },

    // RBAC (roles y permisos del admin). NO es un módulo default de Medusa: sin
    // esta línea las tablas rbac_* no existen y `/admin/rbac/*` no responde. El
    // rol `role_super_admin` (policy `*:*`) y su asignación a los usuarios
    // existentes los hace el migration script `create-super-admin-role.js` del
    // propio core, que sólo corre cuando el feature flag `rbac` está encendido
    // (ver arriba, `featureFlags.rbac: true`).
    [Modules.RBAC]: {
      resolve: '@medusajs/medusa/rbac',
    },

    // Typesense search module
    ...optionalModule('typeSenseService', 'typesense'),
    // Historial de sincronizaciones del índice. Módulo aparte (y anidado dentro
    // de la carpeta que ya mapea la extensión) porque `TypeSenseService` se
    // instancia con `new` en 30+ lugares y no puede extender `MedusaService`.
    ...optionalModule('typesenseSyncLog', 'typesense/sync-log'),

    // Brands: migrated to @minimalart/mercatto-plugin-brands.

    // Banners: migrated to @minimalart/mercatto-plugin-banners.
    // The plugin registers the `banner` module by itself. The dormant shim at
    // src/modules/banner/ stays for ai-assistant/campaign-enrich (imports
    // BANNER_MODULE) and workflows/create-banner.ts (imported dynamically
    // from ai-assistant artifact-tools).

    // shop-by-look: migrated to @minimalart/mercatto-plugin-shop-by-looks.
    // The plugin registers the `shop_by_look` module by itself. It talks to
    // the host `storeConfig` module by string key
    // (`req.scope.resolve('storeConfig')`) to read the per-store
    // `shop_by_look_enabled` toggle — see src/lib/foreign-modules.ts in the
    // plugin.

    // pdf-catalog: migrated to @minimalart/mercatto-plugin-pdf-catalog.
    // The plugin registers the `pdf_catalog` module by itself.

    // Checkout links: migrated to @minimalart/mercatto-plugin-checkout-links.
    // The plugin registers the `checkout_link` module by itself.

    // Store locations ("Mis tiendas" / sucursales) — admin CRUD + public list.
    ...optionalModule('storeLocation', 'store-location'),

    // Store config ("Configuración adicional") — append-only auditable settings
    // (minimum purchase amount). Admin list/create + public "current" endpoint.
    ...optionalModule('storeConfig', 'store-config'),

    // Newsletter — altas del formulario del storefront, con sincronización a
    // Brevo. La fila se guarda SIEMPRE y antes de llamar a Brevo: la API key es
    // por tienda y puede faltar, y perder el contacto por eso es exactamente el
    // bug que esta extensión vino a cerrar (ver modules/newsletter/models).
    ...optionalModule('newsletter', 'newsletter'),

    // ERP — integración con sistemas de gestión externos: stock ERP → Medusa
    // por SKU + notificación de ventas vía outbox idempotente. Adapter registry
    // por proveedor (mock, contabilium) + capa país. Config/logs desde el admin.
    ...optionalModule('erp', 'erp'),

    // Abandoned cart: migrated to @minimalart/mercatto-plugin-abandoned-cart.
    // The plugin registers the `abandoned_cart` module by itself.

    // WhatsApp bot — estado conversacional (historial + borrador de carrito) del
    // bot entrante de WhatsApp. Habilita el multi-turno y la compra por chat
    // (arma un spec de items que alimenta el checkout-link para pagar en el web).
    ...optionalModule('whatsappAgent', 'whatsapp-agent'),

    // Embudo del bot de WhatsApp — módulo HERMANO anidado en la carpeta del
    // agente (mismo patrón que `typesense/sync-log`): una fila por paso comercial,
    // con `used_ai` para poder distinguir el recorrido determinístico del que
    // gastó LLM. `runWhatsappTurn` no usa el tracer del Asistente IA, así que sin
    // esto no hay forma de medir el embudo ni los abandonos.
    ...optionalModule('whatsappEventLog', 'whatsapp-agent/event-log'),

    // Grafo de conversación del bot — el árbol de caminos que hoy está repartido
    // entre el router determinístico y el asesor, versionado y editable desde el
    // admin. La key es `whatsappFlow` y NO `flow`: una key genérica choca con la de
    // algún plugin oficial y rompe `medusa build` fallando sólo en el deploy (ya
    // pasó con `loyalty`).
    ...optionalModule('whatsappFlow', 'whatsapp-flow'),

    // Compras recurrentes — suscripciones de reposición (items + frecuencia).
    // Cada renovación arma un carrito real del canal (stock/precios/promos
    // vigentes); en modo manual_link el cliente confirma y paga con el checkout
    // existente y `order.placed` cierra el ciclo.
    ...optionalModule('recurringOrder', 'recurring-order'),

    // Database Explorer: migrated to @minimalart/mercatto-plugin-database-explorer.
    // The plugin registers the `database_explorer` module by itself.

    // Landing pages: migrated to @minimalart/mercatto-plugin-landing-pages.
    // The plugin registers the `landing_page` module by itself. The dormant
    // shim at src/modules/landing-page/ stays only for banner/ai-assistant
    // helper consumers (see src/modules/landing-page/index.ts).

    // Email templates: DB-authored Handlebars subject/html editable from the
    // backoffice. The SendGrid provider reads published rows by `key` and falls
    // back to the hardcoded templates in src/modules/email/templates.
    ...optionalModule('email_template', 'email-template'),

    // Blog: migrated to @minimalart/mercatto-plugin-blog.

    // Comments: migrated to @minimalart/mercatto-plugin-comments.
    // The plugin registers the `comments` module by itself.

    // Contacto — migrado a @minimalart/mercatto-plugin-contact. El plugin
    // registra el módulo por sí mismo, no hace falta declararlo acá.

    // Andreani data — modelo de cajas (bultos) para el armado de envíos.
    // Single-tenant: las cajas son globales (sin credential_id). Las
    // credenciales de la API siguen viniendo por ENV en el provider de
    // fulfillment.
    ...optionalModule('andreaniData', 'andreani-data'),

    // Delivery — capa de ejecución logística. DeliveryExecution es un sidecar
    // operativo 1:1 de cada Fulfillment de Medusa (estado operativo fino,
    // intentos, ventana, zona). NO copia items/direcciones/montos: se leen en
    // vivo de la order vía links. Medusa Fulfillment sigue siendo la verdad
    // comercial (shipped/delivered).
    ...optionalModule('delivery', 'delivery'),

    // Commerce Dashboard: migrated to @minimalart/mercatto-plugin-commerce-dashboard.
    // The plugin registers the `commerce_dashboard` module by itself.

    // Videos: migrated to @minimalart/mercatto-plugin-videos.
    // The plugin registers the `vimeo_video` module by itself.

    // Wishlist: migrated to @minimalart/mercatto-plugin-wishlist.
    // The plugin registers the `wishlist` module by itself.

    // Loyalty points — per-customer account + transaction ledger.
    ...optionalModule('points', 'points'),
    // Loyalty Engine — programs, earn rules, rewards, grants, tiers, campaigns.
    // Builds on the `points` ledger; produces benefits via Promotions/Store Credit.
    // Key is `loyalty_engine`, NOT `loyalty`: the latter belongs to the official
    // loyalty plugin (gift-card store credit) and reusing it breaks `medusa build`.
    ...optionalModule('loyalty_engine', 'loyalty'),
    // gift_card_experience: moved to @minimalart/mercatto-plugin-gift-cards
    // (self-registers via plugin's src/modules/gift-card-experience). Monetary
    // value remains in the official loyalty plugin above.

    // Dynamic groups: migrated to @minimalart/mercatto-plugin-dynamic-groups.
    // The plugin registers the `dynamic_groups` module by itself.

    ...optionalModule('corporate', 'corporate'),

    ...optionalModule('billing_profile', 'billing-profile'),

    // Media library: migrated to @minimalart/mercatto-plugin-media-library.
    // The plugin registers the `media_library` module by itself.

    ...optionalModule('company', 'company'),

    // Cuenta corriente B2B (crédito comercial): línea de crédito por empresa +
    // ledger append-only de movimientos. El medio de pago "Cuenta Corriente" se
    // registra aparte, dentro del módulo PAYMENT (ver más abajo).
    ...optionalModule('company_credit', 'company-credit'),

    // Fiscal documentation: migrated to @minimalart/mercatto-plugin-fiscal-documentation.
    // The plugin registers the `fiscal_documentation` module by itself and bundles
    // the `arca` client (WSAA + padrón A5) for both the admin generation flow and
    // the storefront Factura A autocomplete (`/store/arca/taxpayer-lookup`).

    // Payment benefits: migrated to @minimalart/mercatto-plugin-payment-benefits.
    // The plugin registers the `payment_benefits` module by itself.

    // Asistente IA — hilos de chat + permisos de tools del MCP.
    ...optionalModule('aiAssistant', 'ai-assistant'),

    // Catalogador: migrated to @minimalart/mercatto-plugin-catalogador.
    // The plugin registers the `catalogador` module by itself. It talks to the
    // host `storeConfig` module by string key (`req.scope.resolve('storeConfig')`)
    // to persist its `catalogador_config` setting — see src/lib/foreign-modules.ts
    // in the plugin. Image cleanup + upload go through `media_library` when
    // present and fall back to `Modules.FILE` otherwise.

    // SEO & GEO — auditoría continua de visibilidad en buscadores (SEO) y en
    // motores de IA (GEO). Crawler propio del storefront + motores que cruzan
    // catálogo/stock de Medusa, AI Visibility Score heurístico y Simulador IA
    // (RAG sobre el catálogo). Correcciones asistidas por IA (integra el
    // Catalogador cuando está presente). Key `seo_geo`.
    ...optionalModule('seo_geo', 'seo-geo'),

    // Motor de Recomendaciones — relaciones producto→producto (manuales y
    // calculadas), estrategias con cadena de fallbacks, filtros de elegibilidad
    // aplicados AL SERVIR (stock/canal/región/carrito), versionado con swap
    // atómico y tracking con atribución directa y asistida. Headless: lo consumen
    // los widgets del storefront y, a futuro, email/WhatsApp/MCP.
    // Key `recommendation_engine`, NO `recommendations`: una key genérica puede
    // colisionar con la de un plugin y esa colisión rompe `medusa build` fallando
    // sólo en deploy (pasó con `loyalty`).
    ...optionalModule('recommendation_engine', 'recommendations'),

    // Demo Stores — demos comerciales autogeneradas (branding + plantilla +
    // import de catálogo externo). Cada demo crea su propio sales channel /
    // región / stock location y se publica en mercatto.studio/demo/{slug}.
    ...optionalModule('demo_store', 'demo-store'),
    ...optionalModule('catalog_import', 'store-importer'),

    // GA4: migrated to @minimalart/mercatto-plugin-ga4.
    // The plugin registers the `ga4` module by itself.
  },
});

export default config;
