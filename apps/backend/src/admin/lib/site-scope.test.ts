import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { SCREEN_SITE_SCOPE, resolveScreenScope } from './site-scope';

/**
 * Sin esto, un `<SiteScopeBar screen="…">` citado en un JSDoc cuenta como uso real.
 * No es hipotético: `routes/settings/extension-settings/page.tsx` explica en prosa
 * cuál NO es su barra de tienda, y el ejemplo con puntos suspensivos entró al
 * registro como si fuera una pantalla llamada `…`.
 *
 * Es la tercera vez que este repo tropieza con lo mismo (ver `env-coverage.test.ts`
 * y `provider-credentials.test.ts`): los comentarios de acá son densos y citan
 * código constantemente, así que TODO escáner de fuente tiene que limpiarlos antes.
 */
const stripComments = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');

/**
 * El registro de pantallas sólo sirve si no puede driftear ni del filesystem ni del
 * registro de rutas del backend.
 *
 * El drift peligroso es en una sola dirección: una pantalla marcada `scoped` cuya
 * ruta todavía no filtra le dice al operador "estás viendo sólo Norte" mientras le
 * muestra las tres tiendas. Lo contrario —marcarla `unscoped` de más— sólo muestra
 * un aviso que sobra.
 */

const ADMIN_DIR = join(import.meta.dirname, '..');
const ROUTES_DIR = join(ADMIN_DIR, 'routes');
const SCOPED_ROUTES = join(ADMIN_DIR, '..', 'lib', 'multistore', 'scoped-routes.ts');

/**
 * Pantallas que ya viven en paquetes publicados. Conservan su clave en el registro
 * del host porque consumen `SiteScopeBar` mediante el runtime slot, pero su fuente no
 * está bajo `apps/backend/src/admin/routes` y por eso este test no puede descubrirla.
 */
const PLUGIN_SCREEN_KEYS = new Set([
  'abandoned-carts',
  'banners',
  'banners.placement',
  'blog.articles',
  'brands',
  'checkout-links',
  'comments',
  'contact-submissions',
  'dynamic-groups',
  'landing-pages',
  'loyalty.campanas',
  'loyalty.canjes',
  'loyalty.dashboard',
  'loyalty.movimientos',
  'loyalty.niveles',
  'loyalty.recompensas',
  'loyalty.reglas',
  'marketplaces',
  'media-library',
  'payment-benefits',
  'pdf-catalogs',
  'shop-by-looks',
  'videos',
]);

test('fail-closed: una pantalla sin declarar se asume no filtrada', () => {
  assert.equal(resolveScreenScope('pantalla-que-no-existe'), 'unscoped');
});

test('todo `screen` usado en el código está declarado en el registro', () => {
  // Al revés de lo habitual: acá lo que buscamos es que nadie monte la barra con un
  // `screen` que el registro no conoce, porque caería al fallback y diría "no filtra"
  // en una pantalla que sí filtra.
  const used = new Set<string>();
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.tsx?$/.test(entry.name)) continue;
      const src = stripComments(readFileSync(full, 'utf8'));
      for (const m of src.matchAll(/<SiteScopeBar\s+screen="([^"]+)"/g)) used.add(m[1]!);
    }
  };
  walk(ROUTES_DIR);

  const missing = [...used].filter((screen) => !(screen in SCREEN_SITE_SCOPE)).sort();
  assert.deepEqual(
    missing,
    [],
    `Estas pantallas montan <SiteScopeBar> con un screen que el registro no declara:\n  ${missing.join('\n  ')}\n` +
      `Agregalas a lib/site-scope.ts, o van a decir "no filtra" aunque su ruta filtre.`,
  );
});

test('no hay entradas muertas en el registro', () => {
  // Sólo se exige para las `scoped`: las `unscoped`/`instance` pueden declararse
  // antes de que la pantalla monte la barra, y sirven de lista de trabajo.
  const used = new Set<string>();
  const walk = (dir: string) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!/\.tsx?$/.test(entry.name)) continue;
      for (const m of stripComments(readFileSync(full, 'utf8')).matchAll(
        /<SiteScopeBar\s+screen="([^"]+)"/g,
      )) {
        used.add(m[1]!);
      }
    }
  };
  walk(ROUTES_DIR);

  const declaredScoped = Object.entries(SCREEN_SITE_SCOPE)
    .filter(([, state]) => state === 'scoped')
    .map(([screen]) => screen);

  // Si ninguna pantalla montó la barra todavía, no hay nada que cruzar.
  if (used.size === 0) return;

  const dead = declaredScoped
    .filter((screen) => !used.has(screen) && !PLUGIN_SCREEN_KEYS.has(screen))
    .sort();
  assert.deepEqual(dead, [], `Pantallas marcadas 'scoped' que no montan la barra: ${dead.join(', ')}`);
});

test('ninguna pantalla `scoped` corresponde a una ruta que el backend dejó pending', () => {
  // El cruce que de verdad importa: la barra no puede decir "mostrando sólo Norte"
  // si la ruta que alimenta la pantalla devuelve las tres tiendas.
  if (!existsSync(SCOPED_ROUTES)) return;
  const backend = readFileSync(SCOPED_ROUTES, 'utf8');

  /** `blog.articles` → `blog-posts`; el resto mapea 1:1 con el grupo de la ruta. */
  const ROUTE_OF: Record<string, string> = {
    brands: 'admin/brands',
    'shop-by-looks': 'admin/shop-by-looks',
    'payment-benefits': 'admin/payment-benefits',
    banners: 'admin/banners',
    'blog.articles': 'admin/blog-posts',
    'store-locations': 'admin/store-locations',
    // abandoned-carts: moved to @minimalart/mercatto-plugin-abandoned-cart
    'recurring-orders': 'admin/recurring-orders',
    // pdf-catalogs: moved to @minimalart/mercatto-plugin-pdf-catalog
    'site-credentials': 'admin/site-credentials',
    // El nombre de la pantalla y el de la ruta no coinciden, y está bien: la ruta
    // es del MÓDULO (`app-settings`) y la pantalla es del lugar donde vive en el
    // menú (`settings/extension-settings`). Por eso este mapa existe.
    'extension-settings': 'admin/app-settings',
    // Preferencias se declara por PESTAÑA, así que cada una mapea a la ruta que
    // realmente la alimenta. Antes había una sola entrada para las siete, apuntando a
    // `settings`, y eso hacía pasar el test para pestañas cuya ruta no filtraba.
    // `commerce` no está acá a propósito: es `instance`, y este mapa sólo exige ruta a
    // las `scoped`.
    'store-config.branches': 'admin/store-config/settings',
    'store-config.storefront': 'admin/store-config/settings',
    'store-config.ai': 'admin/store-config/ai-config',
    'store-config.fiscal': 'admin/fiscal-documents/config',
    'store-config.min-purchase': 'admin/store-config/minimum-purchase',
    'store-config.access': 'admin/store-config/site-gate',
    'store-config.legal': 'admin/store-config/legal-pages',
    // Fidelización mapea 1:1 con el grupo de la ruta salvo por el idioma: el menú
    // está en español y las rutas en inglés.
    //
    // `loyalty.dashboard` entró acá recién cuando su handler dejó de filtrar a
    // medias: mientras tres de sus siete KPIs salían de `listRewardGrants({}, …)`
    // sin filtro, la pantalla estaba declarada `unscoped` y este mapa —que sólo le
    // exige ruta a las `scoped`— la dejaba afuera con razón.
    'loyalty.dashboard': 'admin/loyalty/dashboard',
    'loyalty.reglas': 'admin/loyalty/rules',
    'loyalty.recompensas': 'admin/loyalty/rewards',
    'loyalty.canjes': 'admin/loyalty/grants',
    'loyalty.movimientos': 'admin/loyalty/movements',
    'loyalty.niveles': 'admin/loyalty/tiers',
    'loyalty.campanas': 'admin/loyalty/campaigns',
    // Las seis listas sueltas mapean 1:1 con el grupo de su ruta. `companies` no está
    // acá a propósito: es `unscoped` porque su alta escribe el canal mayorista de la
    // instancia, y este mapa sólo le exige ruta a las `scoped`.
    'checkout-links': 'admin/checkout-links',
    'contact-submissions': 'admin/contact-submissions',
    'newsletter-subscriptions': 'admin/newsletter-subscriptions',
    corporates: 'admin/corporates',
    'email-templates': 'admin/email-templates',
    'landing-pages': 'admin/landing-pages',
    // Delivery mapea por PANTALLA porque cada lista tiene su propia ruta. Las dos que
    // no coinciden con el nombre de la pantalla son las que el menú agrupa distinto
    // que el backend: el listado principal es de EJECUCIONES, y el mapa de coberturas
    // se alimenta de `coverages-overview`, no de las coberturas por sucursal.
    'delivery.executions': 'admin/delivery/executions',
    'delivery.analytics': 'admin/delivery/analytics',
    'delivery.zones': 'admin/delivery/zones',
    'delivery.zone-conflicts': 'admin/delivery/zones/conflicts',
    'delivery.rules': 'admin/delivery/rules',
    'delivery.drivers': 'admin/delivery/drivers',
    'delivery.vehicles': 'admin/delivery/vehicles',
    'delivery.routes': 'admin/delivery/routes',
    // La pantalla de Coberturas vive en el menú de Delivery pero su listado es de
    // SUCURSALES (`useStoreLocations`); las coberturas se piden después, por sucursal
    // y con `assertIdInSite`. La ruta que decide qué ve el operador es esta.
    'delivery.coverages': 'admin/store-locations',
    'delivery.coverages-map': 'admin/delivery/coverages-overview',
    // SEO & GEO mapea por PANTALLA, y el idioma no coincide: el menú está en español y
    // las rutas en inglés (`auditorias` → `audits`, `hallazgos` → `findings`,
    // `simulador` → `simulator`). `seo-geo.correcciones` queda afuera a propósito,
    // igual que `companies`, porque este mapa sólo le exige ruta a las `scoped`.
    //
    // `keywords` entró recién cuando su handler dejó de listar las categorías de toda
    // la instancia: mientras Término, Pregunta y Productos salían de un `query.graph`
    // sin filtro, la pantalla estaba `unscoped` y este mapa la dejaba afuera con razón
    // —`admin/seo-geo/keywords` ya estaba declarada `scoped` en el backend, así que
    // tenerla acá antes habría dado verde sobre una lista que no filtraba.
    'seo-geo.dashboard': 'admin/seo-geo/dashboard',
    'seo-geo.auditorias': 'admin/seo-geo/audits',
    'seo-geo.hallazgos': 'admin/seo-geo/findings',
    'seo-geo.ai-visibility': 'admin/seo-geo/ai-visibility',
    'seo-geo.simulador': 'admin/seo-geo/simulator',
    'seo-geo.keywords': 'admin/seo-geo/keywords',
    // Secundarias de extensiones cuya raíz ya estaba mapeada. `banners.placement`
    // comparte ruta con `banners` a propósito: son dos pantallas del mismo endpoint, y
    // este mapa relaciona pantalla → ruta, no pantalla → ruta EXCLUSIVA.
    'banners.placement': 'admin/banners',
    'recurring-orders.analytics': 'admin/recurring-orders/analytics',
    'recurring-orders.renewals': 'admin/recurring-orders/cycles',
    'recurring-orders.plans': 'admin/recurring-orders/plans',
    'recurring-orders.forecast': 'admin/recurring-orders/forecast',
    'recurring-orders.incidents': 'admin/recurring-orders/alerts',
  };

  const lying: string[] = [];
  for (const [screen, state] of Object.entries(SCREEN_SITE_SCOPE)) {
    if (state !== 'scoped' || PLUGIN_SCREEN_KEYS.has(screen)) continue;
    const route = ROUTE_OF[screen];
    assert.ok(route, `La pantalla '${screen}' está marcada scoped pero no mapea a ninguna ruta: agregala a ROUTE_OF.`);
    const declared = new RegExp(`'${route.replace(/[[\]]/g, '\\$&')}': \\{ state: '([a-z-]+)'`).exec(backend);
    if (declared?.[1] !== 'scoped') lying.push(`${screen} → ${route} (${declared?.[1] ?? 'sin declarar'})`);
  }

  assert.deepEqual(
    lying,
    [],
    `Estas pantallas dicen filtrar por tienda pero su ruta del backend no:\n  ${lying.join('\n  ')}`,
  );
});
