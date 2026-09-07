import seoGeoDescriptors from '../app-settings/descriptors/seo-geo';
import { resolveSettingSync } from '../app-settings/resolve';

/**
 * Configuración efectiva de SEO & GEO, con la precedencia
 * **DB > env > default** de `app-settings`.
 *
 * Es SINCRÓNICA porque los cuatro consumidores son `const` de nivel superior o
 * funciones sin contenedor: la pausa entre lotes en `crawler/crawl.ts`, los
 * minutos de huérfana en `jobs/seo-audit-run.ts`, el batch de `jobs/seo-embed-catalog.ts`
 * y `getChatModel()` en `ai/openrouter.ts`, que se llama desde dentro de
 * `chatComplete` sin acceso a la request. Lee del snapshot que el loader de
 * `app-settings` llena al arrancar; hasta entonces cae a `process.env`, o sea
 * que se comporta exactamente como antes de esta migración.
 *
 * Copia literal del patrón de `modules/typesense/settings.ts`.
 *
 * NO cubre las credenciales ni las URLs compartidas (`OPENROUTER_*`,
 * `EMBEDDINGS_*`, `STOREFRONT_URL`): esas siguen leyéndose de `process.env` allí
 * donde se usan, y el descriptor las declara en `envOnly` con el motivo. Ver la
 * cabecera de `app-settings/descriptors/seo-geo.ts`.
 */

export type SeoGeoSettings = {
  /** Modelo de chat de OpenRouter para el Simulador y las Correcciones. */
  llmModel: string;
  /** Pausa entre lotes del crawl (ms). Cede el event loop al HTTP server. */
  batchPauseMs: number;
  /** Minutos sin progreso tras los que una auditoría `running` es huérfana. */
  staleMinutes: number;
  /** Productos que embebe cada pasada del job de embeddings. */
  embedBatch: number;
};

const DEFAULTS: SeoGeoSettings = {
  llmModel: 'openai/gpt-5-mini',
  batchPauseMs: 250,
  staleMinutes: 30,
  embedBatch: 100,
};

const byKey = new Map(seoGeoDescriptors.settings.map((d) => [d.key, d]));

function read<T>(key: string, fallback: T): T {
  const descriptor = byKey.get(key);
  if (!descriptor) return fallback;
  const value = resolveSettingSync(descriptor);
  return (value === undefined || value === null ? fallback : value) as T;
}

export function getSeoGeoSettings(): SeoGeoSettings {
  return {
    // `|| DEFAULTS` de más: `coerceFromEnv` ya descarta el env vacío, pero una
    // fila guardada con string vacío llegaría como '' y dejaría el modelo sin
    // nombre — un 400 del proveedor en vez de una caída al default.
    llmModel: read('SEO_GEO_LLM_MODEL', DEFAULTS.llmModel).trim() || DEFAULTS.llmModel,
    // `Math.max` y no sólo el `min` del descriptor: el descriptor valida lo que
    // se GUARDA desde el admin, y esto también corre sobre lo que venga del env,
    // que no pasa por ninguna validación.
    batchPauseMs: Math.max(0, read('SEO_GEO_BATCH_PAUSE_MS', DEFAULTS.batchPauseMs)),
    staleMinutes: Math.max(1, read('SEO_GEO_STALE_MINUTES', DEFAULTS.staleMinutes)),
    embedBatch: Math.max(1, read('SEO_GEO_EMBED_BATCH', DEFAULTS.embedBatch)),
  };
}
