import { model } from '@medusajs/framework/utils';
import { ImportJob } from './import-job';

/**
 * A demo ecommerce store created from the backoffice. Each demo owns its own
 * Medusa Sales Channel + Region + Stock Location (provisioned on creation) and
 * is published at mercatto.studio/demo/{slug}. Products are imported from an
 * external WooCommerce / VTEX / Shopify store via public endpoints.
 *
 * Excepción: con `source_type = 'sales_channel'` el catálogo ya vive en esta
 * instancia y la demo ADOPTA ese canal (`sales_channel_id === source_url`) en vez
 * de crear uno propio — no tiene sentido tener dos canales con el mismo catálogo.
 * Ese canal y sus productos son preexistentes: el teardown de la demo no los borra.
 *
 * `theme` and `source_config` are JSON to avoid extra 1:1 tables (theme) and to
 * hold per-source params/credentials, e.g. Shopify storefront/admin tokens.
 */
export const DemoStore = model.define('demo_store', {
  id: model.id({ prefix: 'demo' }).primaryKey(),
  name: model.text(),
  slug: model.text().unique(),
  template_code: model.text().default('supermercado'),
  country_code: model.text(),
  currency_code: model.text(),
  locale: model.text().default('es'),
  /**
   * La tienda PRINCIPAL — la que se sirve en el host raíz — es una fila real como
   * cualquier otra, para que el código tenga un solo camino. Un índice único
   * parcial (`where is_main and deleted_at is null`) garantiza que haya a lo sumo
   * una. Plana y NO dentro de `content_config`: POST /admin/demo-stores/{id} hace
   * `updateDemoStores({ id, ...input })` y reemplaza ese JSON entero.
   *
   * Todos los guards preguntan por ESTE booleano, nunca por slug ni por id: es lo
   * único que el índice garantiza. Ver `main-store.ts`.
   */
  is_main: model.boolean().default(false),
  /**
   * Cuál de las DOS formas de URL es la canónica para SEO.
   *
   * Toda tienda es alcanzable siempre por las dos: `<slug>.<sufijo>` y
   * `/tienda/<slug>`. Eso NO es configurable — el certificado es un wildcard, así
   * que el subdominio resuelve por aritmética de strings sin consultar nada; y la
   * forma con path no se puede borrar porque las preview URLs multi-tenant de Vercel
   * son Enterprise-only y es la única manera de testear una tienda en un preview.
   *
   * Lo que esta columna elige es cuál lleva el `<link rel="canonical">` y cuál queda
   * `noindex`. Sin eso Google indexa el mismo contenido en dos hosts, lo marca como
   * duplicado y puede des-indexar la tienda.
   *
   * ⚠ Deliberadamente NO dispara un 308 en el proxy: el proxy tendría que LEER esta
   * fila para saber en qué dirección redirigir, y eso pondría el backend en el camino
   * crítico del TTFB de toda navegación. El canonical tag es la señal primaria para
   * Google y se emite en la capa de página, donde el tenant ya está cargado.
   */
  canonical_form: model.enum(['host', 'path']).default('host'),
  /**
   * `native` = el catálogo ya es de esta instancia y no se importa de ninguna
   * parte (es lo que usa la fila principal). Deliberadamente NO es un valor legal
   * en `demo_import_job.source_type`: así una fila principal nunca puede ser
   * elegible para los runners de import, ni por accidente.
   */
  source_type: model.enum(['woocommerce', 'vtex', 'shopify', 'sales_channel', 'native']),
  /**
   * Locator of the source catalog. For the external platforms it's the store URL;
   * for `sales_channel` it holds the SOURCE sales channel id (`sc_...`) — the
   * catalog already lives in this instance, so there's no URL to fetch.
   */
  source_url: model.text(),
  source_config: model.json().nullable(),
  target_count: model.number().nullable(),
  sales_channel_id: model.text().nullable(),
  region_id: model.text().nullable(),
  stock_location_id: model.text().nullable(),
  status: model.enum(['draft', 'provisioning', 'importing', 'ready', 'failed']).default('draft'),
  theme: model.json().nullable(),
  // Per-demo content config: section visibility toggles + editable texts
  // (blog name, shopping-list copy, "Explorar" quick suggestions). Surfaced to
  // the storefront via buildTenantConfig → assets. JSON to avoid extra tables.
  content_config: model.json().nullable(),
  // Per-demo home layout: a Puck document ({ content, root }) edited from the
  // "Personalizar home" editor. When present, buildTenantConfig exposes it as
  // assets.homeLayout and the storefront renders the demo home from it (an
  // ordered list of section blocks) instead of the hardcoded template layout.
  home_puck_data: model.json().nullable(),
  // ── B2B / Mayorista ────────────────────────────────────────────────────────
  // When `b2b_enabled`, provisioning creates a DEDICATED wholesale sales channel
  // for the demo (isolated from its B2C channel), a customer group, a demo
  // company + a test buyer, and a post-import price list with quantity tiers.
  // The storefront exposes the portal at /demo/{slug}/b2b. The ids below are
  // filled by provisioning (sync) / the import runner (price list, async).
  b2b_enabled: model.boolean().default(false),
  b2b_pricing_tiers: model.json().nullable(),
  // Legacy resources were provisioned; selected existing resources are retained on deletion.
  b2b_sales_channel_owned: model.boolean().default(true),
  b2b_price_list_owned: model.boolean().default(true),
  b2b_sales_channel_id: model.text().nullable(),
  b2b_customer_group_id: model.text().nullable(),
  b2b_price_list_id: model.text().nullable(),
  b2b_company_id: model.text().nullable(),
  // Test buyer credentials, surfaced in the admin so the demo B2B portal is
  // usable right away. It is a demo account, not a production credential.
  b2b_test_email: model.text().nullable(),
  b2b_test_password: model.text().nullable(),
  // ── Compras recurrentes ────────────────────────────────────────────────────
  // When enabled, the storefront shows "Suscribirse" on the PDP + the account
  // section, and the backend accepts recurring-order creation for this demo's
  // sales channel. Surfaced via buildTenantConfig → medusa.recurring.enabled.
  recurring_enabled: model.boolean().default(false),
  // ── Tintometría ────────────────────────────────────────────────────────────
  // Cuando está prendido, el storefront muestra la página "Buscá tu color"
  // (elegir color → ver con qué bases se logra) y su link en el menú. La data
  // maestra tintométrica es de la INSTANCIA, no del sitio, así que este flag sólo
  // decide si la vidriera se muestra: las rutas /store/tinting/* siguen exigiendo
  // el switch `tinting.enabled` de la config del ERP.
  //
  // Vale para TODAS las filas, la principal incluida. Hasta el backfill de
  // Migration20260819120000DemoStore el storefront sólo lo leía cuando había un
  // slug de sitio activo, así que en la principal el switch del admin no estaba
  // cableado a nada y prenderlo no producía ningún efecto.
  tinting_enabled: model.boolean().default(false),
  // ── Mi cuenta: fidelización y gift cards ───────────────────────────────────
  // Gatean las secciones "Mis puntos" y "Gift Cards" del área de cuenta del
  // storefront. Igual que tintometría, son SÓLO la llave de la vidriera: los
  // módulos de fidelización y gift cards son de la INSTANCIA y siguen teniendo
  // sus propios switches en app-settings.
  //
  // ⚠ Nacen en `true`, al revés que `recurring_enabled` y `tinting_enabled`.
  // Esas dos estrenaron una función que NO existía, así que el default `false`
  // era el statu quo. Acá pasa lo contrario: hoy las dos secciones están
  // HARDCODEADAS como siempre visibles en el storefront. Un default `false` las
  // apagaría en TODAS las tiendas existentes —la principal incluida— el día del
  // deploy, sin que nadie lo haya pedido. El `true` preserva el comportamiento
  // actual y deja que cada tienda opte por apagarlo.
  loyalty_enabled: model.boolean().default(true),
  gift_cards_enabled: model.boolean().default(true),
  // ── Página de contraseña (site gate) ───────────────────────────────────────
  // Cuando `password_gate_enabled`, el storefront del demo no se puede navegar
  // sin ingresar `password_gate_password`: sirve para mostrar una tienda que
  // todavía no abrió al público. La clave NUNCA se expone en el config público
  // (buildTenantConfig sólo publica `{ enabled, length }`); la verificación vive
  // en POST /store/store-config/site-gate.
  password_gate_enabled: model.boolean().default(false),
  password_gate_password: model.text().nullable(),
  import_jobs: model.hasMany(() => ImportJob, { mappedBy: 'demo_store' }),
});
