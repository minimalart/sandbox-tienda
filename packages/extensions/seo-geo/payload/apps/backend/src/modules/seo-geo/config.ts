import { STORE_CONFIG_MODULE } from '../store-config';
import type { MedusaContainer } from '@medusajs/framework/types';
import { normalizeOpenGraph, OPEN_GRAPH_DEFAULTS, type OpenGraphConfig } from './open-graph';

export type { OpenGraphConfig } from './open-graph';

/**
 * Configuración del módulo SEO & GEO (PRD §19/§20). Se persiste como un único
 * setting key/value en store-config (key `seo_geo_config`), reutilizando su API
 * genérica `upsertSetting`/`listStoreSettings` — mismo criterio que el
 * Catalogador, sin tocar el código de store-config. Los secretos (API keys de
 * LLM/embeddings, futuras integraciones externas) viven en env, NUNCA acá.
 */
export const SEO_GEO_SETTING_KEY = 'seo_geo_config';

/** Presupuesto y comportamiento del crawler del storefront. */
export type CrawlConfig = {
  max_pages: number; // tope de páginas por auditoría
  /**
   * Tope de FICHAS DE PRODUCTO dentro de ese presupuesto.
   *
   * Las semillas salen del sitemap, que en un catálogo real es casi todo fichas
   * (5.211 URLs en Mercatto). Sin esta cuota las 150 páginas del presupuesto se
   * gastan en fichas que comparten el MISMO template —o sea, el mismo hallazgo
   * repetido 150 veces— y el crawl nunca llega a la home, a /store, a las
   * categorías ni al blog, que es donde los hallazgos se diferencian.
   *
   * El catálogo no se pierde: catálogo y GEO puntúan los productos leyéndolos de
   * la base (`geo/load-products.ts`), sin crawlear una sola ficha.
   */
  max_product_pages: number;
  max_depth: number; // profundidad máxima de crawl
  concurrency: number; // requests en paralelo
  per_request_timeout_ms: number; // timeout por fetch (patrón withTimeout del sitemap)
  respect_robots: boolean;
  use_sitemap: boolean;
  user_agent: string;
};

/** Qué motores corren en una auditoría (PRD §9/§10). */
export type EngineToggles = {
  technical: boolean;
  architecture: boolean;
  catalog: boolean;
  geo: boolean;
  commercial: boolean; // stub en MVP (V3)
  performance: boolean; // stub en MVP (V3)
};

/** Umbrales del motor técnico (portados de open-seo, PRD §9). */
export type TechnicalThresholds = {
  title_min: number;
  title_max: number;
  meta_description_min: number;
  meta_description_max: number;
  thin_content_words: number;
  slow_response_ms: number;
  deep_page_depth: number;
  redirect_chain_max: number;
};

/**
 * Pesos de las dimensiones del AI Visibility Score (PRD §11). Deben sumar ~1;
 * el scoring normaliza igual. El score GEO es heurístico (sin LLM por producto).
 */
export type GeoWeights = {
  comprehension: number;
  coverage: number;
  authority: number;
  comparability: number;
  structured_data: number;
  depth: number;
};

/** Umbrales del scoring GEO heurístico (PRD §10). */
export type GeoThresholds = {
  sufficient_score: number; // ≥ este score = "información suficiente" (AI Coverage)
  min_description_words: number; // debajo = comprensión pobre
  min_attributes: number; // atributos/variantes para comparabilidad
  min_use_case_signals: number;
};

/** Simulador IA / RAG sobre el catálogo (PRD §12). No incluye secretos. */
export type SimulatorConfig = {
  enabled: boolean;
  llm_model: string; // modelo de chat (OpenRouter)
  embedding_model: string;
  top_k: number; // productos recuperados por consulta
  min_similarity: number; // umbral para considerar "recuperable"
};

/** Automatización de auditorías programadas (PRD §19). */
export type AutomationConfig = {
  enabled: boolean;
  frequency: 'off' | 'weekly' | 'monthly';
};

export type SeoGeoConfig = {
  crawl: CrawlConfig;
  /**
   * Cómo se ve un link de la tienda compartido en redes. Vive acá y no en
   * store-config porque es SEO —la card es lo que decide si alguien entra— y
   * porque así hereda el eje por tienda de esta config sin ningún trabajo: cada
   * tienda tiene su fila, y la que no tiene hereda la global.
   */
  open_graph: OpenGraphConfig;
  engines: EngineToggles;
  technical: TechnicalThresholds;
  geo_weights: GeoWeights;
  geo_thresholds: GeoThresholds;
  simulator: SimulatorConfig;
  automation: AutomationConfig;
};

/**
 * Topes duros del presupuesto de crawl. El pipeline entero corre DENTRO del web
 * service (1 vCPU compartido con el HTTP server y los health checks): en el
 * incidente 2026-07-23 una auditoría con 500 páginas × concurrencia 8 clavó el
 * CPU al 100%, DO mató el contenedor en loop y el sitio estuvo caído el día
 * entero. Estos caps se aplican en mergeSeoGeoConfig — el embudo por el que pasa
 * TODA config efectiva (defaults, config guardada del store y el snapshot de
 * config de una auditoría re-encolada) — para que ningún valor persistido pueda
 * volver a tumbarlo. Ajustables por env sólo si el service crece de tamaño.
 */
export const CRAWL_HARD_CAPS = {
  max_pages: Math.max(1, Number(process.env.SEO_GEO_MAX_PAGES_CAP) || 150),
  concurrency: Math.max(1, Number(process.env.SEO_GEO_CONCURRENCY_CAP) || 2),
};

/** Defaults sensatos. El env sólo siembra modelos, no los obliga. */
export const SEO_GEO_DEFAULTS: SeoGeoConfig = {
  crawl: {
    max_pages: 120,
    max_product_pages: 20,
    max_depth: 5,
    concurrency: 2,
    per_request_timeout_ms: 12_000,
    respect_robots: true,
    use_sitemap: true,
    user_agent: 'MercattoSeoBot/1.0 (+seo-geo audit)',
  },
  engines: {
    technical: true,
    architecture: true,
    catalog: true,
    geo: true,
    commercial: false,
    performance: false,
  },
  technical: {
    title_min: 10,
    title_max: 60,
    meta_description_min: 70,
    meta_description_max: 160,
    thin_content_words: 150,
    slow_response_ms: 1500,
    deep_page_depth: 5,
    redirect_chain_max: 2,
  },
  geo_weights: {
    comprehension: 0.25,
    coverage: 0.15,
    authority: 0.1,
    comparability: 0.2,
    structured_data: 0.2,
    depth: 0.1,
  },
  geo_thresholds: {
    sufficient_score: 70,
    min_description_words: 40,
    min_attributes: 3,
    min_use_case_signals: 1,
  },
  simulator: {
    enabled: true,
    llm_model: process.env.SEO_GEO_LLM_MODEL?.trim() || 'openai/gpt-5-mini',
    embedding_model: process.env.EMBEDDINGS_MODEL?.trim() || 'openai/text-embedding-3-small',
    top_k: 8,
    min_similarity: 0.35,
  },
  automation: {
    enabled: false,
    frequency: 'off',
  },
  open_graph: OPEN_GRAPH_DEFAULTS,
};

/** Merge superficial por sección sobre defaults (nunca devuelve parcial). */
export function mergeSeoGeoConfig(value: unknown): SeoGeoConfig {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<SeoGeoConfig>;
  const crawl = { ...SEO_GEO_DEFAULTS.crawl, ...(v.crawl ?? {}) };
  crawl.max_pages = Math.min(crawl.max_pages, CRAWL_HARD_CAPS.max_pages);
  // La cuota nunca puede ser mayor que el presupuesto: un valor más alto no
  // agranda nada y se leería como que el tope de páginas no aplica a las fichas.
  crawl.max_product_pages = Math.max(0, Math.min(crawl.max_product_pages, crawl.max_pages));
  crawl.concurrency = Math.min(crawl.concurrency, CRAWL_HARD_CAPS.concurrency);
  return {
    crawl,
    engines: { ...SEO_GEO_DEFAULTS.engines, ...(v.engines ?? {}) },
    technical: { ...SEO_GEO_DEFAULTS.technical, ...(v.technical ?? {}) },
    geo_weights: { ...SEO_GEO_DEFAULTS.geo_weights, ...(v.geo_weights ?? {}) },
    geo_thresholds: { ...SEO_GEO_DEFAULTS.geo_thresholds, ...(v.geo_thresholds ?? {}) },
    simulator: { ...SEO_GEO_DEFAULTS.simulator, ...(v.simulator ?? {}) },
    automation: { ...SEO_GEO_DEFAULTS.automation, ...(v.automation ?? {}) },
    // Normaliza y no spreadea: es la única sección cuyos valores salen del backend
    // hacia una etiqueta que renderiza un tercero (WhatsApp, X, Slack), así que un
    // string vacío, un espacio o una URL `javascript:` guardados tienen que morir acá
    // y no en el storefront.
    open_graph: normalizeOpenGraph(v.open_graph),
  };
}

type StoreConfigLike = {
  /**
   * `readSetting` y NO `listStoreSettings({ key })`: desde que `store_setting` tiene
   * `site_id`, la segunda puede devolver DOS filas —la de la tienda y la global— y
   * quedarse con `rows[0]` da un resultado que depende del plan de ejecución.
   */
  readSetting: (key: string, siteId?: string | null) => Promise<{ value: unknown } | undefined>;
  upsertSetting: (key: string, value: unknown, siteId?: string | null) => Promise<unknown>;
};

/** Lee la config efectiva (merge sobre defaults). */
export async function getSeoGeoConfig(container: MedusaContainer, siteId?: string | null): Promise<SeoGeoConfig> {
  const storeConfig = container.resolve(STORE_CONFIG_MODULE) as unknown as StoreConfigLike;
  const row = await storeConfig.readSetting(SEO_GEO_SETTING_KEY, siteId);
  return mergeSeoGeoConfig(row?.value);
}

/** Persiste la config (merge parcial sobre lo guardado) y devuelve el resultado. */
export async function upsertSeoGeoConfig(
  container: MedusaContainer,
  patch: Partial<SeoGeoConfig>,
  siteId?: string | null,
): Promise<SeoGeoConfig> {
  const storeConfig = container.resolve(STORE_CONFIG_MODULE) as unknown as StoreConfigLike;
  const row = await storeConfig.readSetting(SEO_GEO_SETTING_KEY, siteId);
  const current = mergeSeoGeoConfig(row?.value);
  const merged = mergeSeoGeoConfig({ ...current, ...patch });
  await storeConfig.upsertSetting(SEO_GEO_SETTING_KEY, merged, siteId);
  return merged;
}
