import recommendationEngineDescriptors from '../app-settings/descriptors/recommendation-engine';
import { resolveSettingSync } from '../app-settings/resolve';

/**
 * Configuración OPERATIVA del motor de recomendaciones, con la precedencia
 * **DB > env > default** de `app-settings`.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ HAY DOS CONFIGURACIONES DEL MOTOR Y NO SON LA MISMA. ESTE ARCHIVO ES UNA. │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 *  - ESTE archivo (`site_setting`, namespace `extension:recommendation-engine`)
 *    es la OPERACIÓN: cuánto CPU puede morder un build, cada cuánto vence el memo,
 *    cuántas consultas por IP se aceptan, con qué secreto se firma, y los tres kill
 *    switches. Es de la INSTANCIA y no varía por tienda — ver la nota 3 del
 *    descriptor.
 *  - `config.ts` (`store_setting`, key `recommendations_config`) es el PRODUCTO:
 *    cuántos productos se muestran, qué cadena de fallbacks, los umbrales de envío
 *    gratis, los mensajes. Ese SÍ acepta `site_id` y varía por tienda.
 *
 * Mezclarlas sería la forma de que subir un mensaje de envío gratis en la tienda B
 * cambie el presupuesto de CPU de los jobs de todas.
 *
 * POR QUÉ ES SÓLO SINCRÓNICA, a diferencia de `kapso-whatsapp/settings.ts` y
 * `andreani-fulfillment/settings.ts`, que además tienen un camino async por
 * `PG_CONNECTION`: ese camino existe para consumidores que corren en el contenedor
 * hermético que arma `load-internal.js` —notification providers, fulfillment
 * providers— donde no se puede resolver nada del contenedor padre. El motor de
 * recomendaciones no registra ningún provider: sus consumidores son jobs,
 * subscribers, middlewares HTTP y funciones puras. Todos ven el snapshot de
 * `app-settings/snapshot.ts`, que se llena al arrancar en CADA proceso (server y
 * worker) y se revalida solo cada `APP_SETTINGS_TTL_MS`. Agregar un
 * `loadRecommendationsSettingsViaPg` sería código muerto con una query por medio, y
 * en el rate limit —que corre por request— sería una lectura de Postgres en el
 * camino más caliente de la extensión para leer un número que no cambia.
 *
 * Antes de que corra el loader de `app-settings` esto devuelve lo que hay en
 * `process.env`, o sea que se comporta exactamente como antes de esta migración.
 */

export const RECOMMENDATIONS_SETTINGS_NAMESPACE = recommendationEngineDescriptors.namespace;

export type RecommendationsRuntimeSettings = {
  /** Kill switch de proceso. Se chequea ANTES de resolver cualquier otra cosa. */
  enabled: boolean;
  /** Kill switch de los cuatro jobs. Ya viene combinado con `enabled`. */
  jobsEnabled: boolean;
  /** Payload `debug` en la respuesta PÚBLICA del serve. Nunca en producción. */
  debug: boolean;
  /**
   * `string | null` a propósito: la AUSENCIA es significativa. Sin valor, el
   * llamador cae a `COOKIE_SECRET` y recién si tampoco está desactiva la firma.
   * Ver `serve/request-token.ts:resolveEventSecret`.
   */
  eventSecret: string | null;
  rateLimitPerMinute: number;
  configCacheTtlMs: number;
  buildMaxMs: number;
  buildBatch: number;
  staleMinutes: number;
  aggregateLookbackHours: number;
  purgeBatch: number;
  purgeMaxBatches: number;
};

/**
 * Pisos duros, en runtime.
 *
 * Duplican el `min` de cada descriptor y eso NO es redundante: el `min` lo hace
 * cumplir `coerceAndValidate` al ESCRIBIR desde el admin, pero `coerceFromEnv`
 * documenta explícitamente que no valida rangos —un env fuera de rango tiene que
 * seguir funcionando como antes de la migración—. O sea que el único filtro que ve
 * un `RECOMMENDATIONS_PURGE_BATCH=1` puesto a mano en el panel de deploy es éste.
 *
 * `descriptor.test.ts` cruza estos números contra los `min` del descriptor: si
 * divergen, la card muestra un piso y el runtime aplica otro.
 */
export const RECOMMENDATIONS_FLOORS = {
  rateLimitPerMinute: 10,
  configCacheTtlMs: 1000,
  buildMaxMs: 1000,
  buildBatch: 10,
  staleMinutes: 5,
  aggregateLookbackHours: 2,
  purgeBatch: 100,
  purgeMaxBatches: 1,
} as const;

/**
 * Un número utilizable, o el default.
 *
 * Reemplaza al `Math.max(piso, Number(env) || default)` que estaba repetido en
 * ocho lugares. Hay UN cambio de comportamiento deliberado: aquel idiom usaba `||`,
 * así que un `0` explícito —que es falsy— caía al default; acá `0` es un número
 * finito y se clampea al piso. Es la lectura menos sorprendente de las dos: quien
 * escribe `0` está pidiendo "lo mínimo posible", no "lo que venga por defecto".
 *
 * NO se aplica el `max` del descriptor: sería un techo que la UI hace cumplir al
 * guardar pero que en la migración aparecería de la nada sobre un env que hoy
 * funciona. Los topes que SÍ son de seguridad viven en `envOnly` (los `*_CAP`).
 */
export function clampFloor(value: unknown, floor: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? '').trim());
  if (!Number.isFinite(n)) return Math.max(floor, fallback);
  return Math.max(floor, n);
}

const byKey = new Map(recommendationEngineDescriptors.settings.map((d) => [d.key, d]));

/**
 * El valor efectivo de una clave, o el fallback si ninguna capa lo aportó.
 *
 * Pasa por `resolveSettingSync`, que lee la fila GLOBAL del snapshot y aplica la
 * precedencia completa. Como las doce son `scope: 'instance'`, no hay capa de
 * tienda que perder ni fail-closed que pueda apagar la tienda B por omisión.
 */
function read<T>(key: string, fallback: T): T {
  const descriptor = byKey.get(key);
  if (!descriptor) return fallback;
  const value = resolveSettingSync(descriptor);
  return (value === undefined || value === null ? fallback : value) as T;
}

/** Igual, pero un string vacío o de sólo espacios cuenta como ausente. */
function readOptional(key: string): string | null {
  const value = read<string>(key, '');
  const trimmed = typeof value === 'string' ? value.trim() : String(value ?? '');
  return trimmed === '' ? null : trimmed;
}

const num = (key: string, floor: number, fallback: number): number =>
  clampFloor(read<unknown>(key, undefined), floor, fallback);

/**
 * La configuración operativa completa.
 *
 * No se memoiza acá: `resolveSettingSync` ya lee de un `Map` en memoria y el costo
 * es un puñado de lecturas de hash. Cachear el objeto agregaría un TTL propio
 * encima del del snapshot, o sea dos relojes que pueden discrepar sobre cuándo se
 * ve un cambio del admin.
 */
export function getRecommendationsSettings(): RecommendationsRuntimeSettings {
  const enabled = read('RECOMMENDATIONS_ENABLED', true);
  return {
    enabled,
    // El de los jobs viene combinado a propósito: apagar el motor tiene que apagar
    // también las tareas, y que cada job se acuerde de chequear las dos es la clase
    // de invariante que se rompe cuando alguien agrega el quinto job.
    jobsEnabled: enabled && read('RECOMMENDATIONS_JOBS_ENABLED', true),
    debug: read('RECOMMENDATIONS_DEBUG', false),
    eventSecret: readOptional('RECOMMENDATIONS_EVENT_SECRET'),
    rateLimitPerMinute: num(
      'RECOMMENDATIONS_RATE_LIMIT_PER_MINUTE',
      RECOMMENDATIONS_FLOORS.rateLimitPerMinute,
      120,
    ),
    configCacheTtlMs: num(
      'RECOMMENDATIONS_CONFIG_TTL_MS',
      RECOMMENDATIONS_FLOORS.configCacheTtlMs,
      60_000,
    ),
    buildMaxMs: num('RECOMMENDATIONS_BUILD_MAX_MS', RECOMMENDATIONS_FLOORS.buildMaxMs, 20_000),
    buildBatch: num('RECOMMENDATIONS_BUILD_BATCH', RECOMMENDATIONS_FLOORS.buildBatch, 200),
    staleMinutes: num('RECOMMENDATIONS_STALE_MINUTES', RECOMMENDATIONS_FLOORS.staleMinutes, 30),
    aggregateLookbackHours: num(
      'RECOMMENDATIONS_AGGREGATE_LOOKBACK_HOURS',
      RECOMMENDATIONS_FLOORS.aggregateLookbackHours,
      48,
    ),
    purgeBatch: num('RECOMMENDATIONS_PURGE_BATCH', RECOMMENDATIONS_FLOORS.purgeBatch, 5000),
    purgeMaxBatches: num(
      'RECOMMENDATIONS_PURGE_MAX_BATCHES',
      RECOMMENDATIONS_FLOORS.purgeMaxBatches,
      20,
    ),
  };
}
