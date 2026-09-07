import type { MedusaContainer } from '@medusajs/framework/types';
import { STORE_CONFIG_MODULE } from '../store-config';
import type { StrategyKind } from './models';
import { getRecommendationsSettings } from './settings';

/**
 * Configuración de PRODUCTO del motor de recomendaciones. Se persiste como un
 * único setting key/value en store-config (key `recommendations_config`), reusando
 * su API genérica `upsertSetting`/`listStoreSettings` — mismo criterio que seo-geo
 * y el Catalogador. Así agregar una perilla no necesita migración.
 *
 * La configuración OPERATIVA —kill switches, presupuestos de CPU, rate limit y el
 * secreto de firma— NO vive acá sino en `settings.ts`, sobre `site_setting`. La
 * separación es deliberada y está explicada ahí: esto es qué se le muestra al
 * comprador, aquello es cuánto puede gastar la instalación.
 */
export const RECOMMENDATIONS_SETTING_KEY = 'recommendations_config';

/**
 * Kill switch de proceso, chequeado ANTES de resolver cualquier cosa (incluida la
 * lectura de config). Sigue siendo una vía de escape cuando la base está en
 * problemas: `getRecommendationsSettings()` lee del snapshot en memoria, no de
 * store-config, y si el snapshot nunca se llenó cae a `process.env`.
 *
 * Los tres helpers se conservan como funciones y con el nombre que ya tenían
 * porque los importan siete archivos —subscribers, jobs, rutas y el serve— y
 * porque tienen que resolverse en CADA llamada: apagar el motor desde el admin
 * tiene que pegar sin reiniciar.
 */
export const recommendationsEnvEnabled = (): boolean => getRecommendationsSettings().enabled;

/** Kill switch de los 4 jobs. Apagar el motor entero los apaga también. */
export const recommendationsJobsEnabled = (): boolean => getRecommendationsSettings().jobsEnabled;

/** Devuelve el payload de `debug` en la respuesta del serve (nunca en prod). */
export const recommendationsDebugEnabled = (): boolean => getRecommendationsSettings().debug;

/**
 * Barra de envío gratis (PRD §17).
 *
 * `threshold` es SÓLO informativo: el umbral efectivo se deriva siempre de las
 * shipping options reales del carrito (regla `item_total` con `amount === 0`),
 * porque el PRD §17 prohíbe mostrar un umbral promocional que no coincida con las
 * condiciones reales de envío. Sirve para detectar y avisar discrepancias en el
 * backoffice, no para pisar el valor derivado.
 */
export type FreeShippingConfig = {
  enabled: boolean;
  threshold: number | null; // informativo / detección de discrepancia
  currency_code: string | null;
  message_in_progress: string; // admite el placeholder {amount}
  message_completed: string;
  show_bridge_products: boolean;
  bridge_product_limit: number;
  // Banda de precio de los bridge products, como factores del monto faltante.
  // El ejemplo del PRD (falta $8.000 → elegible $6.000–$12.000) es ASIMÉTRICO,
  // así que son dos factores y no una tolerancia única.
  bridge_lower_factor: number;
  bridge_upper_factor: number;
};

export type RecommendationsConfig = {
  enabled: boolean; // toggle del backoffice (el de env manda por encima)
  default_result_limit: number;
  default_candidate_limit: number;
  max_chain_length: number;
  min_results: number; // resultados mínimos antes de pasar al fallback siguiente
  attribution_window_days: number;
  event_ttl_hours: number; // vigencia de un request_id para aceptar eventos
  event_retention_days: number; // eventos crudos
  hourly_metric_retention_days: number; // métricas horarias (las diarias no se purgan)
  keep_versions_per_strategy: number; // versiones superseded que se conservan
  free_shipping: FreeShippingConfig;
};

/**
 * Topes duros. El motor corre DENTRO del web service (1 vCPU compartido con el
 * HTTP server y los health checks): en el incidente 2026-07-23 una auditoría de
 * seo-geo con presupuesto alto clavó el CPU al 100% y DO mató el contenedor en
 * loop. Se aplican en `mergeRecommendationsConfig` —el embudo por el que pasa
 * TODA config efectiva— para que ningún valor persistido pueda volver a tumbarlo.
 *
 * SIGUEN LEYÉNDOSE DE `process.env` Y NO DE `app-settings`, a diferencia de todo
 * lo demás del módulo, y está declarado como `envOnly` en el descriptor: acotan
 * valores que el merchant edita en la misma pantalla de recomendaciones. Un tope
 * editable desde la UI que acota no acota nada — ante "me lo guardó en 24" el
 * primer reflejo es subir el tope, que es justo lo que impide repetir el
 * incidente. Cambiarlos requiere un deploy que alguien tiene que aprobar.
 */
export const RECOMMENDATIONS_HARD_CAPS = {
  result_limit: Math.max(1, Number(process.env.RECOMMENDATIONS_RESULT_LIMIT_CAP) || 24),
  candidate_limit: Math.max(1, Number(process.env.RECOMMENDATIONS_CANDIDATE_LIMIT_CAP) || 60),
  bridge_candidate_limit: Math.max(1, Number(process.env.RECOMMENDATIONS_BRIDGE_CANDIDATE_LIMIT_CAP) || 150),
  max_chain_length: 4,
};

export const RECOMMENDATIONS_DEFAULTS: RecommendationsConfig = {
  enabled: true,
  default_result_limit: 8,
  default_candidate_limit: 30,
  // 4 y no 3: las cadenas sembradas más largas tienen exactamente 4 tiers
  // (ej. `manual → frequently_bought_together → similar → popular`) y con 3 se
  // truncaba el terminal `popular` en la mitad de los placements. Eso rompía en
  // silencio la garantía de que una tienda sin órdenes ni relaciones manuales
  // igual vea recomendaciones el día 1, justo en los placements que arrancan en
  // `manual`/`frequently_bought_together` — o sea los que están vacíos al principio.
  // Subirlo no cuesta round trips: los candidatos de TODA la cadena vienen en una
  // sola query (ver serve/candidates.ts). Lo cubre el test de seed/defaults.
  max_chain_length: 4,
  min_results: 1,
  attribution_window_days: 7,
  event_ttl_hours: 48,
  event_retention_days: 45,
  hourly_metric_retention_days: 90,
  keep_versions_per_strategy: 2,
  free_shipping: {
    enabled: true,
    threshold: null,
    currency_code: null,
    message_in_progress: 'Te faltan {amount} para obtener envío gratis.',
    message_completed: 'Ya tenés envío gratis.',
    show_bridge_products: true,
    bridge_product_limit: 4,
    bridge_lower_factor: 0.75,
    bridge_upper_factor: 1.5,
  },
};

const clampInt = (value: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), min), max);
};

const clampFloat = (value: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
};

const asBool = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const trimToDefault = (value: unknown, fallback: string): string => {
  const v = typeof value === 'string' ? value.trim() : '';
  return v === '' ? fallback : v;
};

const trimToNull = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t === '' ? null : t;
};

const nullableAmount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) && n >= 0 ? n : null;
};

function mergeFreeShipping(raw: unknown): FreeShippingConfig {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = RECOMMENDATIONS_DEFAULTS.free_shipping;
  const lower = clampFloat(v.bridge_lower_factor, d.bridge_lower_factor, 0.1, 1);
  return {
    enabled: asBool(v.enabled, d.enabled),
    threshold: nullableAmount(v.threshold),
    currency_code: trimToNull(v.currency_code),
    message_in_progress: trimToDefault(v.message_in_progress, d.message_in_progress),
    message_completed: trimToDefault(v.message_completed, d.message_completed),
    show_bridge_products: asBool(v.show_bridge_products, d.show_bridge_products),
    bridge_product_limit: clampInt(v.bridge_product_limit, d.bridge_product_limit, 1, 12),
    bridge_lower_factor: lower,
    // El factor superior nunca puede quedar por debajo del inferior: una banda
    // invertida haría que el filtro de precio descarte todo en silencio.
    bridge_upper_factor: clampFloat(v.bridge_upper_factor, d.bridge_upper_factor, lower, 5),
  };
}

/** Merge sobre defaults + topes duros. Nunca devuelve un valor parcial. */
export function mergeRecommendationsConfig(value: unknown): RecommendationsConfig {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const d = RECOMMENDATIONS_DEFAULTS;
  const defaultLimit = clampInt(v.default_result_limit, d.default_result_limit, 1, RECOMMENDATIONS_HARD_CAPS.result_limit);
  return {
    enabled: asBool(v.enabled, d.enabled),
    default_result_limit: defaultLimit,
    default_candidate_limit: clampInt(
      v.default_candidate_limit,
      d.default_candidate_limit,
      defaultLimit,
      RECOMMENDATIONS_HARD_CAPS.candidate_limit,
    ),
    max_chain_length: clampInt(
      v.max_chain_length,
      d.max_chain_length,
      1,
      RECOMMENDATIONS_HARD_CAPS.max_chain_length,
    ),
    min_results: clampInt(v.min_results, d.min_results, 1, defaultLimit),
    attribution_window_days: clampInt(v.attribution_window_days, d.attribution_window_days, 1, 90),
    event_ttl_hours: clampInt(v.event_ttl_hours, d.event_ttl_hours, 1, 720),
    event_retention_days: clampInt(v.event_retention_days, d.event_retention_days, 7, 400),
    hourly_metric_retention_days: clampInt(
      v.hourly_metric_retention_days,
      d.hourly_metric_retention_days,
      7,
      400,
    ),
    keep_versions_per_strategy: clampInt(v.keep_versions_per_strategy, d.keep_versions_per_strategy, 1, 10),
    free_shipping: mergeFreeShipping(v.free_shipping),
  };
}

// ---------------------------------------------------------------------------
// Config por estrategia (columna `config` json de recommendation_strategy)
// ---------------------------------------------------------------------------

/**
 * Config efectiva de una estrategia. Los campos no aplicables a un `kind` se
 * ignoran (a `popular` no le importa `min_confidence`), pero el merge devuelve
 * siempre la forma completa para que el código de build no tenga que chequear
 * `undefined` en cada gate.
 */
export type StrategyConfig = {
  lookback_days: number;
  // Mínimos de evidencia del PRD §6: una relación automática sólo es elegible
  // cuando alcanza el mínimo. El lift NO se usa como criterio único porque con
  // muestras chicas produce resultados poco confiables (PRD §6 y §26).
  min_orders_analyzed: number;
  min_co_occurrences: number;
  min_confidence: number;
  min_lift: number;
  max_relations_per_source: number;
  // Tope de tamaño de canasta para el self-join de co-compra: el costo es
  // O(Σ basket²) y una orden B2B de 200 líneas aporta 40.000 pares por sí sola.
  max_basket_size: number;
  // trending
  window_hours: number;
  min_units: number;
  // similar: pesos de las señales de catálogo (se normalizan al scorear, y se
  // redistribuyen si una señal no está disponible en el esquema).
  similarity_weights: {
    category: number;
    tags: number;
    collection: number;
    type: number;
    brand: number;
  };
  candidate_cap: number; // candidatos por producto origen en el build de similares
};

export const STRATEGY_CONFIG_DEFAULTS: StrategyConfig = {
  lookback_days: 180,
  min_orders_analyzed: 50,
  min_co_occurrences: 3,
  min_confidence: 0.1,
  min_lift: 1,
  max_relations_per_source: 20,
  max_basket_size: 40,
  window_hours: 168,
  min_units: 3,
  similarity_weights: { category: 0.4, tags: 0.25, collection: 0.15, type: 0.1, brand: 0.1 },
  candidate_cap: 60,
};

/**
 * Topes duros del build (misma razón que los del serve: 1 vCPU, y misma razón
 * para seguir en `process.env`: acotan el `max_basket_size` que el merchant edita
 * por estrategia).
 */
export const STRATEGY_HARD_CAPS = {
  max_basket_size: Math.max(2, Number(process.env.RECOMMENDATIONS_BASKET_CAP) || 60),
  max_relations_per_source: 50,
  candidate_cap: 200,
  lookback_days: 730,
};

/** Merge de la config de una estrategia sobre defaults + topes duros. */
export function mergeStrategyConfig(value: unknown): StrategyConfig {
  const v = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const d = STRATEGY_CONFIG_DEFAULTS;
  const w = (v.similarity_weights && typeof v.similarity_weights === 'object'
    ? v.similarity_weights
    : {}) as Record<string, unknown>;
  return {
    lookback_days: clampInt(v.lookback_days, d.lookback_days, 1, STRATEGY_HARD_CAPS.lookback_days),
    min_orders_analyzed: clampInt(v.min_orders_analyzed, d.min_orders_analyzed, 1, 100_000),
    min_co_occurrences: clampInt(v.min_co_occurrences, d.min_co_occurrences, 1, 1000),
    min_confidence: clampFloat(v.min_confidence, d.min_confidence, 0, 1),
    min_lift: clampFloat(v.min_lift, d.min_lift, 0, 1000),
    max_relations_per_source: clampInt(
      v.max_relations_per_source,
      d.max_relations_per_source,
      1,
      STRATEGY_HARD_CAPS.max_relations_per_source,
    ),
    max_basket_size: clampInt(
      v.max_basket_size,
      d.max_basket_size,
      2,
      STRATEGY_HARD_CAPS.max_basket_size,
    ),
    window_hours: clampInt(v.window_hours, d.window_hours, 1, 24 * 90),
    min_units: clampInt(v.min_units, d.min_units, 1, 100_000),
    similarity_weights: {
      category: clampFloat(w.category, d.similarity_weights.category, 0, 1),
      tags: clampFloat(w.tags, d.similarity_weights.tags, 0, 1),
      collection: clampFloat(w.collection, d.similarity_weights.collection, 0, 1),
      type: clampFloat(w.type, d.similarity_weights.type, 0, 1),
      brand: clampFloat(w.brand, d.similarity_weights.brand, 0, 1),
    },
    candidate_cap: clampInt(v.candidate_cap, d.candidate_cap, 1, STRATEGY_HARD_CAPS.candidate_cap),
  };
}

/** Cadencia implícita por tipo de estrategia (PRD §13). */
export const DEFAULT_CADENCE_BY_KIND: Record<StrategyKind, 'hourly' | 'daily' | 'manual'> = {
  manual: 'manual',
  similar: 'daily',
  frequently_bought_together: 'daily',
  trending: 'hourly',
  popular: 'daily',
};

// ---------------------------------------------------------------------------
// Persistencia
// ---------------------------------------------------------------------------

type StoreConfigLike = {
  /**
   * `readSetting` y NO `listStoreSettings({ key })`: desde que `store_setting` tiene
   * `site_id`, la segunda puede devolver DOS filas —la de la tienda y la global— y
   * quedarse con `rows[0]` da un resultado que depende del plan de ejecución.
   */
  readSetting: (key: string, siteId?: string | null) => Promise<{ value: unknown } | undefined>;
  upsertSetting: (key: string, value: unknown, siteId?: string | null) => Promise<unknown>;
};

const storeConfigOf = (container: MedusaContainer): StoreConfigLike =>
  container.resolve(STORE_CONFIG_MODULE) as unknown as StoreConfigLike;

/** Lee la config efectiva (merge sobre defaults, nunca parcial). */
export async function getRecommendationsConfig(
  container: MedusaContainer, siteId?: string | null,
): Promise<RecommendationsConfig> {
  const row = await storeConfigOf(container).readSetting(RECOMMENDATIONS_SETTING_KEY, siteId);
  return mergeRecommendationsConfig(row?.value);
}

/** Persiste un patch parcial sobre lo guardado y devuelve el resultado mergeado. */
export async function upsertRecommendationsConfig(
  container: MedusaContainer,
  patch: Partial<RecommendationsConfig>,
  siteId?: string | null,
): Promise<RecommendationsConfig> {
  const storeConfig = storeConfigOf(container);
  const row = await storeConfig.readSetting(RECOMMENDATIONS_SETTING_KEY, siteId);
  const current = mergeRecommendationsConfig(row?.value);
  const merged = mergeRecommendationsConfig({
    ...current,
    ...patch,
    // El merge superficial pisaría la sección entera con el patch parcial.
    free_shipping: { ...current.free_shipping, ...(patch.free_shipping ?? {}) },
  });
  await storeConfig.upsertSetting(RECOMMENDATIONS_SETTING_KEY, merged, siteId);
  return merged;
}
