import { SCOPE_SEPARATOR, memoNamespace } from '../../lib/settings-cache';
import type { SiteResolution } from '../../lib/multistore/types';
import deliveryDescriptors from '../app-settings/descriptors/delivery';
import { resolveEffectiveValue, type AppSettingRow } from '../app-settings/resolve';
import { readEntriesFromBlob } from '../app-settings/site-setting-store';
import { getSnapshotRow } from '../app-settings/snapshot';

/**
 * Configuración efectiva de Delivery, con la precedencia **DB > env > default**
 * de `app-settings`.
 *
 * Hay DOS entradas y elegir mal es el error clásico. Es la misma estructura que
 * `andreani-fulfillment/settings.ts` y `correo-argentino-fulfillment/settings.ts`,
 * y no por simetría: los tres módulos tienen exactamente el mismo problema —un
 * flag operativo por tienda que se lee desde un subscriber sin request—.
 *
 *  - `getDeliverySettings()` — SINCRÓNICA, lee del snapshot que el loader de
 *    `app-settings` llena al arrancar. Ve la configuración de la INSTANCIA:
 *    `global ?? env ?? default`. Es la de `geocoding.ts:resolveApiKey()`, una
 *    función pura sin contenedor llamada desde el camino de creación de la
 *    DeliveryExecution. Ahí la limitación no muerde, y eso es una propiedad del
 *    DESCRIPTOR y no una casualidad: `GOOGLE_MAPS_API_KEY` es `scope: 'instance'`
 *    a propósito (es la cuenta de Google Cloud de la instalación), así que el
 *    camino sincrónico le da el valor exacto.
 *
 *  - `loadDeliverySettingsViaPg(pg, resolution)` — ASÍNCRONA, lee `site_setting`
 *    con knex crudo y memoiza por scope. Es la ÚNICA que ve la capa de tienda, y
 *    es obligatoria para `OWN_FLEET_AUTO_FULFILL`, que es `defaultScope: 'site'`.
 *
 * El snapshot ya está en memoria y se refresca en cada escritura del admin, así
 * que leer de ahí es gratis. Antes de que el loader lo llene se cae a
 * `process.env`, o sea que se comporta exactamente como antes de esta
 * migración — ver la nota de `app-settings/snapshot.ts`.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ `ownFleetAutoFulfill` YA NO SE LEE POR EL CAMINO SINCRÓNICO.             │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Acá vivía la nota que decía "para que sea de verdad por tienda hay que resolver
 * la tienda desde la ORDEN dentro del subscriber y usar el camino async". Eso ya
 * está hecho: `subscribers/own-fleet-order.ts` resuelve la tienda con
 * `resolveSiteViaSql(order.sales_channel_id)` y lee el flag con
 * `isOwnFleetAutoFulfillEnabledForSite`, igual que `andreani-order.ts:130-137` y
 * `correo-order.ts:139-142`.
 *
 * Lo que se rompía antes no daba error: el descriptor declaraba `site`, la
 * pantalla guardaba por tienda y el subscriber leía la global. La tienda que lo
 * prendía no generaba fulfillments y la que lo apagaba los seguía generando.
 */

export const DELIVERY_SETTINGS_NAMESPACE = deliveryDescriptors.namespace;

export type DeliverySettings = {
  /**
   * Key de Google Maps para el geocoding del BACKEND. `''` si no hay ninguna:
   * el geocoding se saltea sin romper nada, que es el contrato de
   * `geocodeAddress`.
   */
  googleMapsApiKey: string;
  /** Si las compras de flota propia generan fulfillment solas. */
  ownFleetAutoFulfill: boolean;
};

const byKey = new Map(deliveryDescriptors.settings.map((d) => [d.key, d]));

/**
 * De dónde sale la fila de base de una key, más la tienda que decide si la capa
 * de tienda cuenta. Es LO ÚNICO que cambia entre el camino sincrónico y el async
 * — misma forma que `correo-argentino-fulfillment/settings.ts:SettingsLayers`.
 *
 * Sin `site` y sin `resolution`, `resolveEffectiveValue` resuelve exactamente lo
 * que resolvía `resolveSettingSync`: `global ?? env ?? default`. Por eso el
 * cálculo puede ser uno solo y no hay dos precedencias que puedan divergir, que
 * es cómo se llega a que el subscriber lea un flag y la pantalla muestre otro.
 */
type RowLookup = (key: string) => AppSettingRow | undefined;

type SettingsLayers = {
  site?: RowLookup;
  global: RowLookup;
  resolution?: SiteResolution;
};

/** EL cálculo. Único para los dos caminos. */
function buildSettings(layers: SettingsLayers): DeliverySettings {
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
    // `trim()` acá y no en el descriptor: `coerceSecret` NO recorta a propósito
    // (hay secretos que terminan en '='), pero una API key de Google con un
    // salto de línea pegado desde un panel de deploy produce un REQUEST_DENIED
    // que no se parece en nada a "sobra un espacio".
    googleMapsApiKey: read<string>('GOOGLE_MAPS_API_KEY', '').trim(),
    ownFleetAutoFulfill: read<boolean>('OWN_FLEET_AUTO_FULFILL', false),
  };
}

/** La fila global del snapshot en memoria. Es la fuente del camino sincrónico. */
const snapshotLookup: RowLookup = (key) => getSnapshotRow(DELIVERY_SETTINGS_NAMESPACE, key);

/**
 * Camino SINCRÓNICO — configuración de la INSTANCIA.
 *
 * Sin capa de tienda y sin `resolution`, o sea `global ?? env ?? default`: es
 * byte por byte lo que devolvía cuando esto llamaba a `resolveSettingSync`, que
 * hace exactamente esa misma composición sobre el mismo snapshot.
 */
export function getDeliverySettings(): DeliverySettings {
  return buildSettings({ global: snapshotLookup });
}

/** Atajo para el único consumidor que sólo necesita la key. */
export function getGoogleMapsApiKey(): string {
  return getDeliverySettings().googleMapsApiKey;
}

/**
 * Atajo del gate de flota propia, versión INSTANCIA.
 *
 * Se llama `isOwnFleetAutoFulfillEnabled` y no `getOwnFleetAutoFulfill` por el
 * mismo motivo que `isCorreoAutoFulfillEnabled` en
 * `subscribers/correo-order.ts`: se lee como una guarda, no como una lectura de
 * config.
 *
 * ⚠️ `subscribers/own-fleet-order.ts` YA NO la usa — pasó a
 * `isOwnFleetAutoFulfillEnabledForSite`, que es la única que ve la fila de la
 * tienda. Se conserva por sus tests y como forma pura del flag (mismo destino que
 * `isCorreoAutoFulfillEnabled`, que también quedó exportada sin call site de
 * producción). Antes de volver a llamarla desde un camino que SÍ sabe de qué
 * tienda es la orden: no lo hagas, ése es el bug que este archivo acaba de cerrar.
 */
export function isOwnFleetAutoFulfillEnabled(): boolean {
  return getDeliverySettings().ownFleetAutoFulfill;
}

/* -------------------------------------------------------------------------- */
/* Camino ASÍNCRONO por PG_CONNECTION — el único con capa de TIENDA            */
/* -------------------------------------------------------------------------- */

/** Conexión knex mínima que necesita el lector por SQL crudo. */
export type PgRawConnection = {
  raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: unknown[] }>;
};

const GLOBAL_SCOPE = '*global*';

/**
 * `namespace::siteId`. Idéntico a `app-settings/service.ts` y a los dos módulos de
 * carrier, a propósito: `invalidateNamespace()` borra el prefijo entero, así que la
 * ruta del admin que guarda ya limpia esto sin código extra.
 *
 * La clave lleva el scope y NO es opcional. Con la clave pelada del namespace, la
 * primera lectura de la tienda A dejaba cacheado SU jsonb y la tienda B leía el de A
 * durante todo el TTL — el leak cross-tenant que `correo-argentino-fulfillment/
 * settings.ts` documenta, con 30 segundos de ventana y sin un solo error.
 */
const cacheKey = (siteId: string | null): string =>
  `${DELIVERY_SETTINGS_NAMESPACE}${SCOPE_SEPARATOR}${siteId ?? GLOBAL_SCOPE}`;

/** Las entradas del namespace para UN scope. `siteId === null` = la fila global. */
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
        ? [DELIVERY_SETTINGS_NAMESPACE]
        : [DELIVERY_SETTINGS_NAMESPACE, siteId],
    );
    const blob = (result?.rows ?? [])[0] as { value?: unknown } | undefined;
    // El MISMO parser del sobre que usan el admin y el loader del snapshot. Un
    // segundo parser sería la forma de que el subscriber y la card discrepen sobre
    // qué es un secreto.
    return readEntriesFromBlob(blob?.value);
  });
}

/**
 * Configuración de Delivery para la tienda de esta llamada.
 *
 * Sin `resolution` —o con una que no es `status: 'site'`— se comporta igual que el
 * camino sincrónico: `global ?? env ?? default`. La fila de la tienda sólo se pide
 * cuando hay una tienda concreta; para `singleSite`/`allSites`/`registryAbsent` el
 * `SiteKind` es `'none'` y `resolveEffectiveValue` la ignoraría igual, así que
 * pedirla sería un viaje a Postgres cuyo resultado se descarta.
 *
 * Si Postgres no responde o la tabla todavía no existe, cae al camino sincrónico en
 * vez de tirar. Para este flag esa degradación es la correcta y no es casual que
 * coincida con Correo y Andreani: `OWN_FLEET_AUTO_FULFILL` tiene `default: false`,
 * así que "no se pudo leer" termina en "no auto-fulfillar", que es reversible a
 * mano. Un fulfillment de más no lo es.
 */
export async function loadDeliverySettingsViaPg(
  pg: PgRawConnection | undefined,
  resolution?: SiteResolution,
): Promise<DeliverySettings> {
  if (!pg) return getDeliverySettings();

  const siteId = resolution?.status === 'site' ? resolution.site.id : null;

  try {
    const global = await readScope(pg, null);
    if (siteId === null) {
      return buildSettings({ global: (key) => global.get(key), resolution });
    }
    const site = await readScope(pg, siteId);
    return buildSettings({
      site: (key) => site.get(key),
      global: (key) => global.get(key),
      resolution,
    });
  } catch {
    /*
      FAIL-CLOSED de verdad, no `getDeliverySettings()`.

      Antes devolvía eso, con el argumento de que `OWN_FLEET_AUTO_FULFILL` tiene
      `default: false` y por lo tanto "no se pudo leer" terminaba en "no auto-fulfillar".
      **El argumento sólo valía si la fila global y la env también estaban vacías**:
      `getDeliverySettings()` compone `global ?? env ?? default`.

      El caso que lo rompía: instalación que arrancó mono-tienda con el flag PRENDIDO en
      la fila global, agrega la tienda Sur, y Sur lo apaga desde su pantalla. Si el SELECT
      sobre `site_setting` falla —tabla en migración, pool agotado, timeout— este `catch`
      devolvía el valor global, `true`, y se generaba el fulfillment que Sur había apagado.

      Y el `catch` fail-closed del subscriber nunca llegaba a correr, porque el error ya
      lo había tragado esta capa. Dos bloques de comentario razonando sobre la misma
      asimetría —"un auto-fulfill de más no es reversible, despachar a mano sí"— y el que
      decidía contradecía al otro.

      Se devuelven los defaults puros: el único valor que no depende de una fila que no se
      pudo leer.
    */
    return buildSettings({ global: () => undefined, resolution });
  }
}

/**
 * El gate de flota propia PARA UNA TIENDA. Es el que usa el subscriber.
 *
 * Existe como atajo y no como `loadDeliverySettingsViaPg(...).ownFleetAutoFulfill`
 * en el call site por lo mismo que su hermana sincrónica: el subscriber lo evalúa
 * en un `if` y tiene que leerse como una guarda.
 */
export async function isOwnFleetAutoFulfillEnabledForSite(
  pg: PgRawConnection | undefined,
  resolution?: SiteResolution,
): Promise<boolean> {
  return (await loadDeliverySettingsViaPg(pg, resolution)).ownFleetAutoFulfill;
}
