import { memoNamespace } from '../../lib/settings-cache';
import whatsappDescriptors from '../app-settings/descriptors/whatsapp';
import { resolveEffectiveValue, type AppSettingRow } from '../app-settings/resolve';
import { readEntriesFromBlob } from '../app-settings/site-setting-store';
import { getSnapshotRow } from '../app-settings/snapshot';

/**
 * Configuración efectiva de WhatsApp/Kapso, con la precedencia de
 * `app-settings`.
 *
 * Hay DOS entradas, y elegir mal es el error clásico:
 *
 *  - `getKapsoSettings()` — SINCRÓNICA, lee del snapshot que el loader de
 *    `app-settings` llena al arrancar. Es la que usan las funciones sueltas de
 *    `lib/whatsapp/*`, los builders de plantilla y los jobs: ninguno puede
 *    esperar una promesa ni tiene un contenedor a mano. Mismo patrón que
 *    `typesense/settings.ts`.
 *
 *  - `loadKapsoSettingsViaPg(pg)` — ASÍNCRONA, lee `site_setting` con knex crudo
 *    y memoiza 30 s por namespace. Es para el NOTIFICATION PROVIDER, que corre
 *    en el contenedor hermético que arma `load-internal.js` (sin padre, sólo
 *    seis claves re-exportadas) donde no se puede resolver el módulo de tiendas.
 *    Es el camino que documenta `lib/settings-cache.ts`.
 *
 * POR QUÉ EL PROVIDER NO ALCANZA CON EL SNAPSHOT, aunque técnicamente lo vería
 * (es un singleton de módulo ES, uno por proceso, no por contenedor): en
 * `MEDUSA_WORKER_MODE` hay DOS procesos, y el admin escribe en el del servidor
 * mientras las notificaciones las despacha el WORKER.
 *
 * OJO, la razón de acá abajo cambió y el comentario viejo decía otra cosa: NO es
 * que el snapshot del worker se llene una sola vez al arrancar. Desde que
 * `snapshot.ts:revalidateIfStale` es stale-while-revalidate, el worker converge
 * solo en `SNAPSHOT_TTL_MS`. Esa parte ya no justifica nada.
 *
 * Lo que SÍ la justifica, y no cambió, es el contenedor: el provider de
 * notificaciones lo instancia `load-internal.js` en un cradle hermético, y el
 * snapshot sincrónico sólo sirve ajustes `scope: 'instance'` (ver el recuadro de
 * abajo). Para leer la configuración de UNA tienda no queda otra que ir por
 * `PG_CONNECTION`, que es de las seis claves que el cradle sí re-exporta.
 *
 * Las dos comparten el MISMO cálculo (`buildSettings`) y el mismo resolver, así
 * que no hay dos definiciones de precedencia que puedan divergir.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LAS DOS ENTRADAS VEN LA CONFIGURACIÓN DE LA INSTANCIA, NO LA DE UNA       │
 * │ TIENDA — aunque `extension:whatsapp` sea `defaultScope: 'site'`.          │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Es la misma limitación de `resolve.ts:resolveSettingSync`, por el mismo motivo:
 * ni un job ni un notification provider tienen request de dónde sacar la tienda.
 * Se lee la fila GLOBAL (`site_id IS NULL`), o sea `global ?? env ?? default`.
 * Nunca se lee la de otra tienda, así que no hay leak; lo que se pierde es la
 * personalización por tienda. El camino para arreglarlo existe —`resolveSetting`
 * acepta una `SiteResolution`— y lo que falta es que el emisor la propague; el
 * webhook de Kapso ya lo hace por URL para OTRAS cosas, y ese es el hilo del que
 * hay que tirar cuando haga falta una API key por tienda.
 */

export const WHATSAPP_SETTINGS_NAMESPACE = whatsappDescriptors.namespace;

export type KapsoTemplateNames = {
  orderConfirmation: string;
  orderTracking: string;
  orderDelivery: string;
  orderCancelled: string;
  passwordReset: string;
  /**
   * Los templates opcionales de abajo son `string | null` A PROPÓSITO. El código usa su
   * PRESENCIA como interruptor: sin valor, el paso de WhatsApp ni se arma. Ver
   * la nota 2 de `app-settings/descriptors/whatsapp.ts`.
   */
  /**
   * Retiro en tienda: lo dispara `markOrderReadyForPickup`, la MISMA función que
   * el mail, así que el gate de una sola vez (`order.metadata.ready_for_pickup_at`)
   * también cubre el WhatsApp. Sin valor y sin binding publicado en el admin, el
   * aviso sale sólo por mail.
   */
  orderReadyForPickup: string | null;
  cartAbandoned1: string | null;
  cartAbandoned2: string | null;
  cartAbandoned3: string | null;
  recurringOrderCreated: string | null;
  recurringOrderPaused: string | null;
  recurringOrderResumed: string | null;
  recurringOrderSkipped: string | null;
  recurringOrderCancelled: string | null;
  recurringOrderGenerated: string | null;
  recurringOrderUpdated: string | null;
  recurringRenewalReady: string | null;
  recurringRenewalUpcoming: string | null;
  recurringRenewalReminder: string | null;
  recurringOrderFailed: string | null;
  recurringStockUnavailable: string | null;
  recurringStockSkipped: string | null;
  recurringPaymentFailed: string | null;
};

export type KapsoSettings = {
  apiKey: string;
  phoneNumberId: string;
  baseUrl: string;
  businessAccountId: string;
  inboxEmbedUrl: string | null;
  webhookSecret: string;
  webhookVerifyToken: string;
  templateLang: string;
  templates: KapsoTemplateNames;
  /** Vacío = deducir la región por país. */
  regionId: string | null;
  /** Vacío = heredar de `STOREFRONT_DEFAULT_COUNTRY` en el call site. */
  countryCode: string | null;
  placeholderImageUrl: string | null;
  handoffAutoResumeHours: number;
};

/** De dónde sale la fila de DB de una key. Es lo único que cambia entre caminos. */
type RowLookup = (key: string) => AppSettingRow | undefined;

const byKey = new Map(whatsappDescriptors.settings.map((d) => [d.key, d]));

const snapshotLookup: RowLookup = (key) => getSnapshotRow(WHATSAPP_SETTINGS_NAMESPACE, key);

function buildSettings(lookup: RowLookup): KapsoSettings {
  const read = <T>(key: string, fallback: T): T => {
    const descriptor = byKey.get(key);
    if (!descriptor) return fallback;
    // La entrada se pasa como capa GLOBAL, que es lo que es: sin `resolution`,
    // `resolveEffectiveValue` resuelve como instancia y ni mira la capa de tienda.
    const value = resolveEffectiveValue(descriptor, { global: lookup(key) });
    return (value === undefined || value === null ? fallback : value) as T;
  };

  /** Igual que `read`, pero un string vacío o de sólo espacios cuenta como ausente. */
  const readOptional = (key: string): string | null => {
    const value = read<string>(key, '');
    const trimmed = typeof value === 'string' ? value.trim() : String(value ?? '');
    return trimmed === '' ? null : trimmed;
  };

  return {
    apiKey: read('KAPSO_API_KEY', ''),
    phoneNumberId: read('KAPSO_PHONE_NUMBER_ID', ''),
    baseUrl: read('KAPSO_BASE_URL', 'https://api.kapso.ai'),
    businessAccountId: read('KAPSO_BUSINESS_ACCOUNT_ID', ''),
    inboxEmbedUrl: readOptional('KAPSO_INBOX_EMBED_URL'),
    webhookSecret: read('KAPSO_WEBHOOK_SECRET', ''),
    webhookVerifyToken: read('KAPSO_WEBHOOK_VERIFY_TOKEN', ''),
    templateLang: read('KAPSO_TEMPLATE_LANG', 'es'),
    templates: {
      orderConfirmation: read('KAPSO_TEMPLATE_ORDER_CONFIRMATION', 'order_confirmation'),
      orderTracking: read('KAPSO_TEMPLATE_ORDER_TRACKING', 'order_tracking'),
      orderDelivery: read('KAPSO_TEMPLATE_ORDER_DELIVERY', 'order_delivery_own_fleet'),
      orderCancelled: read('KAPSO_TEMPLATE_ORDER_CANCELLED', 'order_cancelled'),
      passwordReset: read('KAPSO_TEMPLATE_PASSWORD_RESET', 'password_reset'),
      orderReadyForPickup: readOptional('KAPSO_TEMPLATE_ORDER_READY_FOR_PICKUP'),
      cartAbandoned1: readOptional('KAPSO_TEMPLATE_CART_ABANDONED_1'),
      cartAbandoned2: readOptional('KAPSO_TEMPLATE_CART_ABANDONED_2'),
      cartAbandoned3: readOptional('KAPSO_TEMPLATE_CART_ABANDONED_3'),
      recurringOrderCreated: readOptional('KAPSO_TEMPLATE_RECURRING_ORDER_CREATED'),
      recurringOrderPaused: readOptional('KAPSO_TEMPLATE_RECURRING_ORDER_PAUSED'),
      recurringOrderResumed: readOptional('KAPSO_TEMPLATE_RECURRING_ORDER_RESUMED'),
      recurringOrderSkipped: readOptional('KAPSO_TEMPLATE_RECURRING_ORDER_SKIPPED'),
      recurringOrderCancelled: readOptional('KAPSO_TEMPLATE_RECURRING_ORDER_CANCELLED'),
      recurringOrderGenerated: readOptional('KAPSO_TEMPLATE_RECURRING_ORDER_GENERATED'),
      recurringOrderUpdated: readOptional('KAPSO_TEMPLATE_RECURRING_ORDER_UPDATED'),
      recurringRenewalReady: readOptional('KAPSO_TEMPLATE_RECURRING_RENEWAL_READY'),
      recurringRenewalUpcoming: readOptional('KAPSO_TEMPLATE_RECURRING_RENEWAL_UPCOMING'),
      recurringRenewalReminder: readOptional('KAPSO_TEMPLATE_RECURRING_RENEWAL_REMINDER'),
      recurringOrderFailed: readOptional('KAPSO_TEMPLATE_RECURRING_ORDER_FAILED'),
      recurringStockUnavailable: readOptional('KAPSO_TEMPLATE_RECURRING_STOCK_UNAVAILABLE'),
      recurringStockSkipped: readOptional('KAPSO_TEMPLATE_RECURRING_STOCK_SKIPPED'),
      recurringPaymentFailed: readOptional('KAPSO_TEMPLATE_RECURRING_PAYMENT_FAILED'),
    },
    regionId: readOptional('WHATSAPP_REGION_ID'),
    countryCode: readOptional('WHATSAPP_COUNTRY_CODE'),
    placeholderImageUrl: readOptional('WHATSAPP_PLACEHOLDER_IMAGE_URL'),
    handoffAutoResumeHours: read('WHATSAPP_HANDOFF_AUTO_RESUME_HOURS', 6),
  };
}

/**
 * Camino SINCRÓNICO. Antes de que corra el loader de `app-settings` devuelve lo
 * que hay en `process.env`, o sea que se comporta exactamente como antes de esta
 * migración. Ver la nota de `app-settings/snapshot.ts`.
 */
export function getKapsoSettings(): KapsoSettings {
  return buildSettings(snapshotLookup);
}

/** Conexión knex mínima que necesita `loadKapsoSettingsViaPg`. */
export type PgRawConnection = {
  raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: unknown[] }>;
};

/**
 * Camino ASÍNCRONO por `PG_CONNECTION`, para el provider.
 *
 * Memoiza en `lib/settings-cache.ts` con la clave PELADA del namespace (sin
 * sufijo de scope), que es la que `invalidateNamespace()` borra junto con todos
 * los scopes: la ruta de admin que escribe la llama y con eso también se cae esta
 * cache, sin código extra.
 *
 * Desarma el jsonb con `readEntriesFromBlob`, la misma función que usan el camino
 * async del admin y el loader del snapshot. Tener un segundo parser del sobre
 * sería la forma de que el provider y la card discrepen sobre qué es un secreto.
 *
 * Si Postgres no responde o la tabla todavía no existe, cae al camino
 * sincrónico en vez de tirar: una config que no se puede leer nunca debe cortar
 * un envío.
 */
export async function loadKapsoSettingsViaPg(
  pg: PgRawConnection | undefined,
): Promise<KapsoSettings> {
  if (!pg) return getKapsoSettings();
  try {
    const rows = await memoNamespace(WHATSAPP_SETTINGS_NAMESPACE, async () => {
      const result = await pg.raw(
        `SELECT "value"
           FROM "site_setting"
          WHERE "namespace" = ? AND "site_id" IS NULL AND "deleted_at" IS NULL
          LIMIT 1`,
        [WHATSAPP_SETTINGS_NAMESPACE],
      );
      const blob = (result?.rows ?? [])[0] as { value?: unknown } | undefined;
      return readEntriesFromBlob(blob?.value);
    });
    return buildSettings((key) => rows.get(key));
  } catch {
    return getKapsoSettings();
  }
}

/** Credenciales de envío ya resueltas, o `null` si falta alguna de las dos. */
export function toKapsoCredentials(s: KapsoSettings): {
  apiKey: string;
  phoneNumberId: string;
  baseUrl: string;
} | null {
  if (!s.apiKey || !s.phoneNumberId) return null;
  return { apiKey: s.apiKey, phoneNumberId: s.phoneNumberId, baseUrl: s.baseUrl };
}

/** Atajo sincrónico de `toKapsoCredentials` para los call sites sin contenedor. */
export function getKapsoCredentials(): ReturnType<typeof toKapsoCredentials> {
  return toKapsoCredentials(getKapsoSettings());
}

/**
 * Huella de lo que afecta al CLIENTE HTTP de Kapso. El notification provider
 * cachea su cliente, así que lo reconstruye sólo cuando esta huella cambia — no
 * por tiempo, igual que el de Typesense.
 */
export function credentialsFingerprint(s: Pick<KapsoSettings, 'apiKey' | 'baseUrl'>): string {
  return [s.apiKey, s.baseUrl].join('|');
}
