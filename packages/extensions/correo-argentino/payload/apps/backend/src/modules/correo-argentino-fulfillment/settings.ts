import { SCOPE_SEPARATOR, memoNamespace } from '../../lib/settings-cache';
import type { SiteResolution } from '../../lib/multistore/types';
import correoDescriptors from '../app-settings/descriptors/correo-argentino';
import { resolveEffectiveValue, type AppSettingRow } from '../app-settings/resolve';
import { readEntriesFromBlob } from '../app-settings/site-setting-store';
import { getSnapshotRow } from '../app-settings/snapshot';
import { normalizeCorreoOptions } from './env-options';
import type { CorreoProviderOptions } from './types';

/**
 * Configuración efectiva de Correo Argentino, con la precedencia de
 * `app-settings`.
 *
 * Copia la estructura de `kapso-whatsapp/settings.ts` —dos entradas, un solo
 * `buildSettings()`— y le agrega lo que Kapso no tiene: **la capa de TIENDA**.
 *
 *  - `getCorreoSettings()` — SINCRÓNICA, lee del snapshot que el loader de
 *    `app-settings` llena al arrancar. Es para los call sites sin contenedor
 *    (constructores, funciones sueltas, el fallback de todo lo demás). Ve la
 *    configuración de la INSTANCIA: `global ?? env ?? default`. Nunca la de una
 *    tienda — misma limitación, y por el mismo motivo, que `resolveSettingSync`.
 *
 *  - `loadCorreoSettingsViaPg(pg, resolution)` — ASÍNCRONA, lee `site_setting`
 *    con knex crudo. Es el único camino que ve la configuración POR TIENDA, y el
 *    único que puede usar el provider de fulfillment: su contenedor es hermético
 *    (`load-internal.js` re-exporta seis claves) y `resolve()` de otro módulo tira
 *    siempre.
 *
 * LAS DOS TERMINAN EN `normalizeCorreoOptions()`, que sigue siendo la ÚNICA
 * normalización del módulo. Acá no se parsea nada: se resuelve QUÉ valor gana y
 * se arma el mismo objeto crudo que armaba `loadCorreoOptionsFromEnv()`. Dos
 * normalizaciones significarían que el provider cotiza con una configuración y el
 * workflow de tickets da de alta con otra, y el síntoma —un envío creado con otro
 * origen o serviceType que el cotizado— no apunta a ningún archivo.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ LA CLAVE DE CACHE LLEVA EL SCOPE. NO ES OPCIONAL.                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Con la clave pelada del namespace, la primera request de la tienda A dejaba
 * cacheado SU jsonb y la tienda B leía el de A durante todo el TTL: un leak
 * cross-tenant de credenciales de despacho, con 30 segundos de ventana y sin un
 * solo error. Se usa el mismo formato que `app-settings/service.ts:cacheKey`
 * (`namespace::siteId`), y por eso `invalidateNamespace()` —que borra el prefijo
 * entero— también invalida esto cuando el admin guarda.
 */

export const CORREO_SETTINGS_NAMESPACE = correoDescriptors.namespace;

/** De dónde sale la fila de DB de una key. Es lo único que cambia entre caminos. */
type RowLookup = (key: string) => AppSettingRow | undefined;

const byKey = new Map(correoDescriptors.settings.map((d) => [d.key, d]));

const snapshotLookup: RowLookup = (key) => getSnapshotRow(CORREO_SETTINGS_NAMESPACE, key);

/** Las dos capas de base + la tienda de la request, si hay. */
type SettingsLayers = {
  site?: RowLookup;
  global: RowLookup;
  resolution?: SiteResolution;
};

/**
 * Arma las options crudas y las pasa por el normalizador del módulo.
 *
 * `read` devuelve `unknown` a propósito: la base guarda booleanos y números YA
 * tipados (los coerciona `validate.ts` al escribir), mientras que `process.env`
 * siempre da strings. `normalizeCorreoOptions` ya tolera las dos formas —`readBool`
 * acepta `true` y `"true"`, `readNum` hace `Number(value)`—, así que no hay que
 * stringificar nada de vuelta. Stringificar sería, además, la forma de perder un
 * `false` guardado a propósito.
 */
function buildSettings(layers: SettingsLayers): CorreoProviderOptions {
  const read = (key: string): unknown => {
    const descriptor = byKey.get(key);
    if (!descriptor) return undefined;
    return resolveEffectiveValue(
      descriptor,
      { site: layers.site?.(key), global: layers.global(key) },
      { resolution: layers.resolution },
    );
  };

  return normalizeCorreoOptions({
    hostname: read('CORREO_ARGENTINO_HOSTNAME'),
    micorreoHostname: read('CORREO_ARGENTINO_MICORREO_HOSTNAME'),
    paqarBasePath: read('CORREO_ARGENTINO_PAQAR_BASE_PATH'),
    micorreoBasePath: read('CORREO_ARGENTINO_MICORREO_BASE_PATH'),
    testMode: read('CORREO_ARGENTINO_TEST_MODE'),
    apiKey: read('CORREO_ARGENTINO_API_KEY'),
    agreement: read('CORREO_ARGENTINO_AGREEMENT'),
    sellerId: read('CORREO_ARGENTINO_SELLER_ID'),
    extClient: read('CORREO_ARGENTINO_EXT_CLIENT'),
    micorreo: {
      username: read('CORREO_ARGENTINO_MICORREO_USER'),
      password: read('CORREO_ARGENTINO_MICORREO_PASS'),
      customerId: read('CORREO_ARGENTINO_CUSTOMER_ID'),
    },
    serviceType: read('CORREO_ARGENTINO_SERVICE_TYPE'),
    productCategory: read('CORREO_ARGENTINO_PRODUCT_CATEGORY'),
    productWeightUnit: read('CORREO_ARGENTINO_PRODUCT_WEIGHT_UNIT'),
    sender: {
      name: read('CORREO_ARGENTINO_SENDER_NAME'),
      email: read('CORREO_ARGENTINO_SENDER_EMAIL'),
      phone: read('CORREO_ARGENTINO_SENDER_PHONE'),
      cellphone: read('CORREO_ARGENTINO_SENDER_CELLPHONE'),
      observation: read('CORREO_ARGENTINO_SENDER_OBSERVATION'),
    },
    origin: {
      postalCode: read('CORREO_ARGENTINO_ORIGIN_POSTAL_CODE'),
      street: read('CORREO_ARGENTINO_ORIGIN_STREET'),
      number: read('CORREO_ARGENTINO_ORIGIN_NUMBER'),
      city: read('CORREO_ARGENTINO_ORIGIN_CITY'),
      state: read('CORREO_ARGENTINO_ORIGIN_STATE'),
      floor: read('CORREO_ARGENTINO_ORIGIN_FLOOR'),
      department: read('CORREO_ARGENTINO_ORIGIN_DEPARTMENT'),
    },
    limits: {
      maxWeightG: read('CORREO_ARGENTINO_MAX_WEIGHT_G'),
      maxDimensionCm: read('CORREO_ARGENTINO_MAX_DIMENSION_CM'),
      aforoDivisor: read('CORREO_ARGENTINO_AFORO_DIVISOR'),
    },
    dimensionFallback: {
      enabled: read('CORREO_ARGENTINO_DIMENSION_FALLBACK_ENABLED'),
      length: read('CORREO_ARGENTINO_DIMENSION_FALLBACK_LENGTH'),
      width: read('CORREO_ARGENTINO_DIMENSION_FALLBACK_WIDTH'),
      height: read('CORREO_ARGENTINO_DIMENSION_FALLBACK_HEIGHT'),
      weight: read('CORREO_ARGENTINO_DIMENSION_FALLBACK_WEIGHT'),
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Ajustes que NO son options del provider                                     */
/* -------------------------------------------------------------------------- */

/**
 * Los cinco ajustes que `CorreoProviderOptions` no modela porque no los consume
 * ningún cliente: los leen el subscriber de auto-fulfillment, el workflow de
 * tickets, el job de tracking y el constructor de la URL pública.
 *
 * Van juntos y en el mismo resolver que las options para que haya UNA sola
 * precedencia en el módulo. Antes cada uno leía su `process.env` con su propio
 * `?.trim().toLowerCase() === 'true'`, que es cómo se llega a que el mismo flag
 * signifique cosas distintas en dos archivos.
 */
export type CorreoOperationSettings = {
  autoFulfill: boolean;
  selfGeneratedTrackingNumber: boolean;
  trackingNumberPrefix: string;
  trackingBaseUrl: string;
  trackingBusinessHoursOnly: boolean;
};

function buildOperationSettings(layers: SettingsLayers): CorreoOperationSettings {
  const read = <T>(key: string, fallback: T): T => {
    const descriptor = byKey.get(key);
    if (!descriptor) return fallback;
    const value = resolveEffectiveValue(
      descriptor,
      { site: layers.site?.(key), global: layers.global(key) },
      { resolution: layers.resolution },
    );
    return (value === undefined || value === null ? fallback : value) as T;
  };

  return {
    autoFulfill: read('CORREO_ARGENTINO_AUTO_FULFILL', false),
    selfGeneratedTrackingNumber: read('CORREO_ARGENTINO_SELF_GENERATED_TN', false),
    trackingNumberPrefix: read('CORREO_ARGENTINO_TN_PREFIX', 'MER'),
    trackingBaseUrl: read(
      'CORREO_ARGENTINO_TRACKING_BASE_URL',
      'https://www.correoargentino.com.ar/formularios/e-commerce',
    ),
    trackingBusinessHoursOnly: read('CORREO_ARGENTINO_TRACKING_BUSINESS_HOURS_ONLY', false),
  };
}

/* -------------------------------------------------------------------------- */
/* Camino SINCRÓNICO                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Options de la INSTANCIA, sin capa de tienda.
 *
 * Antes de que corra el loader de `app-settings` devuelve exactamente lo que hay
 * en `process.env`, o sea que se comporta como antes de esta migración.
 */
export function getCorreoSettings(): CorreoProviderOptions {
  return buildSettings({ global: snapshotLookup });
}

/** Los flags de operación de la instancia. Mismo alcance que `getCorreoSettings`. */
export function getCorreoOperationSettings(): CorreoOperationSettings {
  return buildOperationSettings({ global: snapshotLookup });
}

/* -------------------------------------------------------------------------- */
/* Camino ASÍNCRONO por PG_CONNECTION                                          */
/* -------------------------------------------------------------------------- */

/** Conexión knex mínima que necesitan los lectores por SQL crudo. */
export type PgRawConnection = {
  raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: unknown[] }>;
};

const GLOBAL_SCOPE = '*global*';

/** `namespace::siteId`. Idéntico a `app-settings/service.ts`, a propósito. */
const cacheKey = (siteId: string | null): string =>
  `${CORREO_SETTINGS_NAMESPACE}${SCOPE_SEPARATOR}${siteId ?? GLOBAL_SCOPE}`;

/**
 * Las entradas del namespace para UN scope. `siteId === null` = la fila global.
 *
 * Memoizado por scope. Desarma el jsonb con `readEntriesFromBlob`, la misma
 * función que usan el admin y el loader del snapshot: un segundo parser del sobre
 * sería la forma de que el provider y la card discrepen sobre qué es un secreto.
 */
function readScope(
  pg: PgRawConnection,
  siteId: string | null,
): Promise<Map<string, AppSettingRow>> {
  return memoNamespace(cacheKey(siteId), async () => {
    const result = await pg.raw(
      `SELECT "value"
         FROM "site_setting"
        WHERE "namespace" = ?
          AND ${siteId === null ? '"site_id" IS NULL' : '"site_id" = ?'}
          AND "deleted_at" IS NULL
        LIMIT 1`,
      siteId === null
        ? [CORREO_SETTINGS_NAMESPACE]
        : [CORREO_SETTINGS_NAMESPACE, siteId],
    );
    const blob = (result?.rows ?? [])[0] as { value?: unknown } | undefined;
    return readEntriesFromBlob(blob?.value);
  });
}

/**
 * Las dos capas listas para resolver, más la resolución que decide el fail-closed.
 *
 * La lectura de la fila de tienda se hace SÓLO cuando la resolución es de una
 * tienda concreta. Para `singleSite`/`allSites`/`registryAbsent` el `SiteKind` es
 * `'none'` y la capa de tienda se ignoraría igual: pedirla sería un viaje a
 * Postgres cuyo resultado se descarta.
 */
async function loadLayers(
  pg: PgRawConnection,
  resolution: SiteResolution | undefined,
): Promise<SettingsLayers> {
  const siteId = resolution?.status === 'site' ? resolution.site.id : null;
  const global = await readScope(pg, null);
  if (siteId === null) return { global: (key) => global.get(key), resolution };

  const site = await readScope(pg, siteId);
  return {
    site: (key) => site.get(key),
    global: (key) => global.get(key),
    resolution,
  };
}

/**
 * Options de Correo para la tienda de esta llamada.
 *
 * Si Postgres no responde o la tabla todavía no existe, cae al camino sincrónico
 * en vez de tirar: una configuración que no se puede leer nunca debe cortar una
 * cotización ni un despacho — para eso está el fail-closed de la precedencia, que
 * es una decisión de datos, no un error de infraestructura.
 */
export async function loadCorreoSettingsViaPg(
  pg: PgRawConnection | undefined,
  resolution?: SiteResolution,
): Promise<CorreoProviderOptions> {
  if (!pg) return getCorreoSettings();
  try {
    return buildSettings(await loadLayers(pg, resolution));
  } catch {
    return getCorreoSettings();
  }
}

/** Igual que la anterior, para los flags que no son options del provider. */
export async function loadCorreoOperationSettingsViaPg(
  pg: PgRawConnection | undefined,
  resolution?: SiteResolution,
): Promise<CorreoOperationSettings> {
  if (!pg) return getCorreoOperationSettings();
  try {
    return buildOperationSettings(await loadLayers(pg, resolution));
  } catch {
    return getCorreoOperationSettings();
  }
}

/* -------------------------------------------------------------------------- */
/* Huellas de configuración                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Huella de lo que afecta al cliente de PAQAR.
 *
 * Los clientes se cachean por HUELLA y no por tiempo (ver `get-client.ts`). Son
 * exactamente los campos que `PaqarClient` congela en su axios (`baseURL`, el
 * header `Apikey` y el header `agreement`) más el `extClient` que lee de sus
 * options en cada consulta de tracking. Un campo de más en la huella sólo cuesta
 * reconstruir un cliente barato; uno de menos hace que la tienda B siga pegándole
 * a la API con el acuerdo de la tienda A.
 */
export function paqarFingerprint(options: CorreoProviderOptions): string {
  return [
    options.api.paqar.baseUrl,
    options.apiKey,
    options.agreement,
    options.extClient ?? '',
  ].join('|');
}

/**
 * Huella de lo que afecta al cliente de MICORREO.
 *
 * ⚠️ Este es el que justifica que la cache exista. `MiCorreoClient` cachea un JWT
 * por instancia (`clients/micorreo-client.ts:167-168`): construir uno por llamada
 * sería un `POST /token` por cotización, o sea uno por cada vez que el comprador
 * toca el selector de envío. `AndreaniRateLimitError` ya existe en este repo como
 * precedente de que ese patrón muerde.
 */
export function micorreoFingerprint(options: CorreoProviderOptions): string {
  return [
    options.api.micorreo.baseUrl,
    options.micorreo.username,
    options.micorreo.password,
    options.micorreo.customerId,
    options.limits.maxWeightG,
    options.limits.maxDimensionCm,
  ].join('|');
}
