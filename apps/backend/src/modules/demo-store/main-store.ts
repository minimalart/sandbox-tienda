import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { DEMO_STORE_MODULE } from './index';

/**
 * La tienda PRINCIPAL como fila real de `demo_store`.
 *
 * Antes era implícita: no tenía fila, y su configuración vivía repartida entre
 * `apps/storefront/src/lib/site-config/default.ts`, los namespaces de
 * `site_manager_setting` y `store_setting`. Eso la volvía la única tienda que no se
 * podía gestionar desde el admin, y obligaba a que cada guard tuviera dos caminos.
 *
 * Con la fila, todo el código tiene UN camino y los guards preguntan por
 * `is_main`. El índice único parcial `IDX_demo_store_is_main_unique` garantiza que
 * haya a lo sumo una.
 */

/** Slug reservado de la fila principal. Rechazado en el POST de creación. */
export const MAIN_STORE_SLUG = 'principal';

/**
 * Id FIJO, no generado. Dos razones: la idempotencia de `ensureMainStore()` sale
 * gratis por PK, y los runbooks/guards pueden hablar de una fila concreta
 * (`DELETE /admin/stores/demo_main` → 409).
 *
 * Mantiene el prefijo `demo` del modelo (`model.id({ prefix: 'demo' })`): la capa
 * física no se renombra, así que un id `site_...` sería la única fila con otra
 * convención.
 */
export const MAIN_STORE_ID = 'demo_main';

/**
 * Semilla del theme, COPIADA LITERAL de `apps/storefront/src/lib/site-config/default.ts`
 * (`defaultConfig.theme.colors`, L42-51). No es cosmética: `getTenantBySlug()` en
 * `active-tenant.ts:58-80` mergea SÓLO `assets` con `defaultConfig` — `theme`,
 * `medusa`, `metadata`, `template`, `domains` y `name` vienen tal cual del backend.
 * Sin esta semilla, publicar la fila (Fase 5) le borraría al sitio principal el
 * `accent` (#f97316), que es el color de las etiquetas de promo.
 *
 * Las claves son las de la COLUMNA `theme` (snake_case), no las del payload:
 * `buildTenantConfig` las mapea a `theme.colors.{primary,secondary,accent}`.
 *
 * ⚠ Si cambiás un color en `default.ts`, cambialo acá. Lo hace cumplir
 * `main-store.test.ts`.
 */
export const MAIN_STORE_THEME_SEED = {
  primary_color: '#2e7d32',
  secondary_color: '#374151',
  accent_color: '#f97316',
} as const;

/**
 * El único predicado que usan todos los guards. Por el BOOLEANO, nunca por slug ni
 * por id: el booleano es lo que el índice único garantiza, y un slug o un id son
 * datos que alguien puede llegar a cambiar.
 */
export function isMainStore(row: { is_main?: boolean | null } | null | undefined): boolean {
  return Boolean(row?.is_main);
}

type StoreDefaults = {
  salesChannelId: string | null;
  regionId: string | null;
  countryCode: string | null;
  currencyCode: string | null;
  /** Nombre del Store de Medusa. Null si no tiene uno cargado. */
  name: string | null;
};

/**
 * Nombre de la fila principal cuando el Store de Medusa no tiene uno.
 *
 * Era el literal hardcodeado, y por eso TODO proyecto generado nacía con su tienda
 * principal llamada "Mercatto" — en el backoffice de un cliente eso se lee como una DB
 * copiada del boilerplate, y ya costó una ronda de diagnóstico en Desde el Sur. Queda
 * sólo como último recurso para no cambiarle el nombre a las instancias que no tienen
 * Store nombrado.
 */
export const MAIN_STORE_FALLBACK_NAME = 'Mercatto';

/**
 * Defaults del store, leídos con los SERVICIOS DE MÓDULO — el mismo patrón que ya usa
 * `provision.ts:113` y `:432` para leer exactamente estos campos.
 *
 * `query.graph({ entity: 'store', fields: ['default_sales_channel_id'] })` también
 * funciona (core lo hace en `GET /admin/stores`: ver `defaultAdminStoreFields` en
 * `@medusajs/medusa/dist/api/admin/stores/query-config.js`). Se prefiere el servicio
 * porque no depende de una lista de `fields`: si un nombre de campo se escribe mal ahí,
 * la propiedad vuelve `undefined` en silencio y el llamador no puede distinguirlo de un
 * store que de verdad no tiene canal por defecto.
 */
async function readStoreDefaults(container: any): Promise<StoreDefaults> {
  const storeService: any = container.resolve(Modules.STORE);
  const [store] = await storeService.listStores({}, { take: 1 });

  const regionId = store?.default_region_id ?? null;
  let countryCode: string | null = null;
  let currencyCode: string | null = null;

  if (regionId) {
    // `relations: ['countries']` igual que `provision.ts:191`: el `iso_2` del país no
    // viene si no se pide la relación explícitamente.
    const regionService: any = container.resolve(Modules.REGION);
    const [region] = await regionService.listRegions(
      { id: regionId },
      { take: 1, relations: ['countries'] },
    );
    currencyCode = region?.currency_code ?? null;
    countryCode = (region?.countries ?? [])[0]?.iso_2 ?? null;
  }

  return {
    salesChannelId: store?.default_sales_channel_id ?? null,
    // `trim()` porque un nombre en blanco es tan inservible como uno ausente y tiene
    // que caer al fallback igual.
    name: store?.name?.trim() || null,
    regionId,
    countryCode,
    currencyCode,
  };
}

/**
 * Crea la fila principal si falta. Idempotente por PK (`MAIN_STORE_ID`) y por el
 * índice único parcial sobre `is_main`.
 *
 * NO se llama desde `ensureDemoStoreTables()`: ese corre una vez por proceso y
 * resetea su promesa en el catch, así que N instancias arrancando en paralelo
 * entran las N. La carrera es benigna (la segunda pierde contra la PK y el índice,
 * y el catch la absorbe), pero crear datos como efecto secundario de un DDL es
 * modelar mal: se llama explícito desde el listado del admin, que es el único lugar
 * donde la fila tiene que existir para poder mostrarla.
 *
 * Todo el cuerpo va en try/catch con `logger.warn`: un fallo acá NO puede tirar un
 * 500 en `GET /admin/sites`.
 *
 * ⚠ El catch NOMBRA EL PASO que falló (`stage`). La primera versión tenía un solo
 * try/catch alrededor de cinco pasos que podían fallar por motivos distintos, y los
 * cinco logueaban el mismo warn genérico. El síntoma visible era siempre el mismo —
 * "la principal no aparece en el listado" — sin forma de distinguir un módulo que no
 * resuelve de una columna que falta o de un `id` que el servicio rechaza. Un
 * diagnóstico que no discrimina cuesta una vuelta de deploy por hipótesis.
 */
export async function ensureMainStore(container: any): Promise<void> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  let stage = 'resolver el módulo demo_store';
  try {
    const service: any = container.resolve(DEMO_STORE_MODULE);

    stage = 'buscar una fila is_main existente (¿corrió la migración?)';
    const existing = await service.listDemoStores({ is_main: true }, { take: 1 });
    if (existing?.[0]) return;

    stage = 'leer los defaults del store y de la región';
    const defaults = await readStoreDefaults(container);
    if (!defaults.salesChannelId) {
      logger.warn(
        '[demo-store] No pude sembrar la tienda principal: el store no tiene ' +
          'default_sales_channel_id. Asignalo en Configuración → Store y recargá el listado.',
      );
      return;
    }

    stage = `crear la fila (id fijo ${MAIN_STORE_ID})`;
    await service.createDemoStores({
      id: MAIN_STORE_ID,
      is_main: true,
      name: defaults.name ?? MAIN_STORE_FALLBACK_NAME,
      slug: MAIN_STORE_SLUG,
      // 'supermercado' → tenant_template 'grocery', que es el `template` de
      // defaultConfig. Cambiar la plantilla de la principal le cambiaría todo el
      // chrome al storefront, así que el admin no ofrece el selector.
      template_code: 'supermercado',
      country_code: defaults.countryCode ?? 'ar',
      currency_code: defaults.currencyCode ?? 'ars',
      locale: 'es',
      // El catálogo ya es de esta instancia: no hay nada que importar. `native` es
      // ilegal en demo_import_job, así que esta fila nunca es elegible para los
      // runners de import.
      source_type: 'native',
      source_url: '',
      status: 'ready',
      sales_channel_id: defaults.salesChannelId,
      region_id: defaults.regionId,
      // Se deja en null a propósito: la principal usa el stock location que ya
      // tiene configurado la instancia, no uno propio.
      stock_location_id: null,
      theme: MAIN_STORE_THEME_SEED,
      content_config: null,
      // Matchea el default actual del storefront para la principal
      // (`NEXT_PUBLIC_RECURRING_ENABLED !== 'false'` en active-tenant.ts:162). El
      // default de la COLUMNA es false, y `isRecurringEnabledForChannel()` busca la
      // fila por sales_channel_id: sin esto, la fila principal apagaría las compras
      // recurrentes del sitio principal en silencio.
      recurring_enabled: true,
      // El gate de la principal NO vive acá: sigue en el scope `store` de
      // store_setting (`password_gate`). Estas columnas quedan en NULL/false y
      // nunca se leen para ella — así no se invalida ninguna cookie `_site_gate`.
      password_gate_enabled: false,
      password_gate_password: null,
    });

    logger.info(`[demo-store] Tienda principal sembrada (${MAIN_STORE_ID}).`);
  } catch (err) {
    logger.warn(
      `[demo-store] No pude asegurar la tienda principal al ${stage}: ${
        (err as Error)?.message ?? String(err)
      }`,
    );
  }
}
