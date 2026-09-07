import { STORE_CONFIG_MODULE, type StoreConfigLike } from '../../lib/foreign-modules';
import { getCatalogadorSettings } from './settings';
import type { MedusaContainer } from '@medusajs/framework/types';

/**
 * Configuración del Catalogador (PRD §22). Se persiste como un único setting
 * key/value en el módulo store-config (key `catalogador_config`), reutilizando
 * su API genérica `upsertSetting`/`listStoreSettings` — así NO se modifica el
 * código de store-config (la extensión sólo lo declara como dependencia). Los
 * secretos (API keys de barcode/scraping) NUNCA viven en este objeto (PRD §22.4):
 * se resuelven aparte, por `app-settings` (DB cifrada > env), en `settings.ts`.
 */
export const CATALOGADOR_SETTING_KEY = 'catalogador_config';

export type TextAiConfig = {
  model: string; // modelo de OpenRouter para texto/visión
  temperature: number;
  max_tokens: number;
  reasoning_effort: 'minimal' | 'low' | 'medium' | 'high';
  language: string; // idioma de salida (ej. 'es')
  tone: string; // tono general
  max_retries: number;
  /** Prompt base + instrucciones por campo (se versiona por ejecución). */
  base_prompt: string;
  field_prompts: Record<string, string>;
};

export type ImageAiConfig = {
  model: string; // nano banana / Gemini 2.5 Flash Image
  aspect_ratio: '21:9' | '16:9' | '1:1' | '4:3' | '3:4' | '9:16';
  variations: number; // cantidad de variaciones por operación
  max_images_per_product: number;
  base_prompt: string;
  recreate_prompt: string;
  lifestyle_prompt: string;
  background_prompt: string;
  missing_prompt: string;
  preserve_product: boolean; // política de conservación de producto/packaging
  /**
   * Lifestyle editable (PRD §13): habilita la operación `lifestyle_editable`
   * (escena lifestyle + ajuste manual de posición/escala del producto). La
   * posición inicial se mantiene como constante interna en el MVP; sólo la
   * escala inicial es configurable.
   */
  editable_lifestyle_enabled: boolean;
  editable_lifestyle_default_scale: number; // 0-1, ancho del producto / ancho del fondo
};

export type ImageTechnicalConfig = {
  output_format: 'webp';
  webp_quality: number; // 40-90
  max_kb: number; // peso objetivo
  max_dimension: number; // px lado mayor
  min_dimension: number; // px (bajo esto = resolución insuficiente)
  keep_originals: boolean;
};

export type ExternalEnrichmentConfig = {
  barcode_enabled: boolean;
  /**
   * Nombre/id del proveedor de barcode (informativo, para UI y trazas). El
   * endpoint real y su credencial se configuran en los ajustes de la extensión
   * (`CATALOGADOR_BARCODE_API_URL` / `CATALOGADOR_BARCODE_API_KEY`); hoy hay un
   * único proveedor genérico, así que esto no selecciona nada por sí solo.
   */
  barcode_provider: string;
  scraping_enabled: boolean;
  /**
   * Herramienta de scraping/búsqueda web:
   *  - 'tavily': API de Tavily (busca y devuelve el contenido; respeta
   *    include_domains). Requiere CATALOGADOR_TAVILY_API_KEY. RECOMENDADO.
   *  - 'http': fetch directo endurecido anti-SSRF de un template de búsqueda
   *    por dominio (CATALOGADOR_SCRAPE_SEARCH_TEMPLATE).
   */
  scraping_provider: 'tavily' | 'http';
  allowed_domains: string[];
  blocked_domains: string[];
  max_pages_per_product: number;
  timeout_ms: number;
  user_agent: string;
};

export type CatalogRulesConfig = {
  do_not_overwrite_manual: boolean;
  only_fill_empty: boolean;
  allow_improve_existing: boolean;
  reuse_existing_categories: boolean;
  reuse_existing_tags: boolean;
  reuse_existing_brands: boolean;
  forbid_create_categories: boolean;
  forbid_create_tags: boolean;
  forbid_create_brands: boolean;
  keep_original_images: boolean;
  no_auto_replace_main_image: boolean;
  snapshot_before_apply: boolean;
  require_review_generated_images: boolean;
  require_review_low_confidence: boolean;
  /**
   * Umbral de confianza (0-1): con `require_review_low_confidence` activo, los
   * campos propuestos por debajo de este valor NO se auto-aceptan en "aceptar
   * todo" y quedan pendientes de una decisión explícita por campo.
   *
   * El default es 0.5 y NO es un número redondo elegido de arriba: es el único
   * valor que deja al gate discriminando algo con la config real de las tiendas.
   * `evidenceConfidence()` (`ai/enrichment.ts`) sólo puede devolver 0.9 y 0.8 con
   * barcode, y 0.7 con dos páginas web o con foto del producto; con
   * `barcode_enabled` y `scraping_enabled` en false —el default— el piso es 0.55
   * y el techo 0.7. Un umbral de 0.7 contra ese techo difería el 100% de los
   * campos siempre, porque la comparación del endpoint es `confidence < umbral`
   * estricta: "aceptar todo" no podía aceptar nada (ver el cartel de
   * `evidenceConfidence`). Con 0.5, 0.55 y 0.7 pasan, y el gate queda para lo que
   * caiga por debajo — que es donde de verdad hace falta ojo humano.
   *
   * Es un DEFAULT: cada tienda lo puede subir desde "Configuración del
   * Catalogador", y una fila ya guardada le gana (`mergeCatalogadorConfig`).
   */
  low_confidence_threshold: number;
};

export type OperationalLimitsConfig = {
  max_products_per_execution: number;
  max_concurrent_generations: number;
  max_regenerations: number;
  max_retries: number;
  time_budget_per_product_ms: number;
};

export type CatalogadorConfig = {
  text: TextAiConfig;
  image_ai: ImageAiConfig;
  image_technical: ImageTechnicalConfig;
  external: ExternalEnrichmentConfig;
  rules: CatalogRulesConfig;
  limits: OperationalLimitsConfig;
};

/**
 * Defaults sensatos. Los dos modelos sólo se SIEMBRAN desde `app-settings`
 * (DB > env > default): la config guardada del Catalogador los sigue pisando.
 *
 * Es una FUNCIÓN y no una `const` a propósito: como `const` de nivel superior,
 * los modelos se congelaban en el primer import del proceso y guardar en el
 * admin no tenía efecto hasta reiniciar. El costo de rearmar este literal es
 * despreciable al lado de una sola llamada a OpenRouter.
 */
export function getCatalogadorDefaults(): CatalogadorConfig {
  const settings = getCatalogadorSettings();
  return {
    text: {
      // Mismo enfoque que selectio-ia-tool (OpenRouter, modelo multimodal para
      // analizar la imagen del producto). selectio lo tomaba de env; acá se fija
      // un default vision-capable, configurable.
      model: settings.textModel,
      temperature: 0.7,
      max_tokens: 1200,
      reasoning_effort: 'low',
      language: 'es',
      tone: 'claro y comercial',
      max_retries: 2,
      base_prompt:
        'Analizá el producto usando su información existente y, si hay, su imagen. Generá contenido de catálogo en español, claro y comercial. No inventes especificaciones, medidas ni atributos que no puedas inferir con seguridad; si falta información, sé conservador.',
      // Reglas portadas de selectio-ia-tool (generalizadas de juguetes a producto).
      field_prompts: {
        subtitle: 'Subtítulo breve y atractivo (máximo 150 caracteres), sin repetir literalmente el título.',
        description:
          'Descripción del producto en español (máximo 500 caracteres) con características, beneficios y detalles relevantes, basada sólo en información disponible.',
        keywords:
          'Exactamente 8 palabras clave de búsqueda en español. Cada una debe ser UNA SOLA PALABRA (solo letras, sin números, guiones, barras ni espacios). NO incluir género, rango etario, nombres de categorías, marcas, colores genéricos ni materiales genéricos. Deben ser sinónimos, variantes o términos alternativos con los que un usuario buscaría el producto. Si en la imagen se ve el packaging, UNA debe ser exactamente una de: caja, blister, bolsa, pack, tubo, display, ventana.',
        meta_title: 'Meta title SEO (máximo 60 caracteres) con la palabra clave principal.',
        meta_description: 'Meta description SEO (máximo 155 caracteres), persuasiva y con una llamada a la acción sutil.',
      },
    },
    image_ai: {
      // nano-banana (Gemini 2.5 Flash Image), igual que selectio-ia-tool (OPENROUTER_UNIFY_MODEL).
      model: settings.imageModel,
      aspect_ratio: '1:1',
      variations: 2,
      max_images_per_product: 4,
      base_prompt: '',
      // Prompt de estandarización sobre fondo blanco, portado de selectio-ia-tool
      // (PRIMARY_PROMPT), generalizado de "toy" a "product".
      recreate_prompt:
        'You are a professional product catalog designer. Standardize this product photo into a clean, consistent catalog shot. Requirements: PURE WHITE BACKGROUND (#FFFFFF) — no gray, off-white or gradients. Square 1:1 canvas with the complete product fully visible and centered. Fit the entire product so its longest side occupies ~78% of the canvas, with at least 10% clear white padding on every edge. Do not zoom, crop, cut off, or let the product touch the edge. Maintain realistic colors, textures and printed branding from the original. Remove uneven shadows, clutter, measurement arrows, size callouts, spec tables, price tags, stickers or extra text overlays that are not printed on the packaging itself. Preserve only legitimate branding printed on the product/package. Soft natural light. Output a realistic, high-quality e-commerce image on a pure white background.',
      lifestyle_prompt:
        'Create a realistic lifestyle scene featuring this exact product in a natural, appealing context of use. Keep the product faithful to the reference photo (shape, colors, printed branding). Professional e-commerce photography with soft, natural lighting. Do not add text overlays.',
      background_prompt:
        'Place this exact product on the configured background, keeping it faithful to the reference. Studio-quality, 1:1, soft lighting, no text overlays.',
      missing_prompt:
        'Generate a clean product photo based on the product name and any reference, on a pure white background (#FFFFFF), centered, square 1:1.',
      preserve_product: true,
      editable_lifestyle_enabled: true,
      editable_lifestyle_default_scale: 0.25,
    },
    image_technical: {
      output_format: 'webp',
      webp_quality: 82,
      max_kb: 200,
      max_dimension: 1600,
      min_dimension: 500,
      keep_originals: true,
    },
    external: {
      barcode_enabled: false,
      barcode_provider: '',
      scraping_enabled: false,
      scraping_provider: 'tavily',
      allowed_domains: [],
      blocked_domains: [],
      max_pages_per_product: 3,
      timeout_ms: 8000,
      user_agent: 'MercattoCatalogador/1.0',
    },
    rules: {
      do_not_overwrite_manual: true,
      only_fill_empty: false,
      allow_improve_existing: true,
      reuse_existing_categories: true,
      reuse_existing_tags: true,
      reuse_existing_brands: true,
      forbid_create_categories: true,
      forbid_create_tags: true,
      forbid_create_brands: true,
      keep_original_images: true,
      no_auto_replace_main_image: true,
      snapshot_before_apply: true,
      require_review_generated_images: true,
      require_review_low_confidence: true,
      low_confidence_threshold: 0.5,
    },
    limits: {
      max_products_per_execution: 500,
      max_concurrent_generations: 4,
      max_regenerations: 5,
      max_retries: 2,
      time_budget_per_product_ms: 60000,
    },
  };
}

/** Merge superficial por sección sobre defaults (nunca devuelve parcial). */
export function mergeCatalogadorConfig(value: unknown): CatalogadorConfig {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<CatalogadorConfig>;
  const defaults = getCatalogadorDefaults();
  return {
    text: { ...defaults.text, ...(v.text ?? {}) },
    image_ai: { ...defaults.image_ai, ...(v.image_ai ?? {}) },
    image_technical: { ...defaults.image_technical, ...(v.image_technical ?? {}) },
    external: { ...defaults.external, ...(v.external ?? {}) },
    rules: { ...defaults.rules, ...(v.rules ?? {}) },
    limits: { ...defaults.limits, ...(v.limits ?? {}) },
  };
}

// StoreConfigLike y STORE_CONFIG_MODULE viven en `lib/foreign-modules.ts`
// porque el modulo `storeConfig` es AJENO al plugin (vive en el host) y se
// resuelve por string literal en runtime. La razon del `readSetting`
// —vs. `listStoreSettings({ key })`— sigue igual: desde que `store_setting`
// tiene `site_id`, la segunda puede devolver DOS filas (la de la tienda y la
// global) y quedarse con `rows[0]` da un resultado que depende del plan de
// ejecucion.

/** Lee la config efectiva (merge sobre defaults). */
export async function getCatalogadorConfig(container: MedusaContainer, siteId?: string | null): Promise<CatalogadorConfig> {
  const storeConfig = container.resolve(STORE_CONFIG_MODULE) as unknown as StoreConfigLike;
  const row = await storeConfig.readSetting(CATALOGADOR_SETTING_KEY, siteId);
  return mergeCatalogadorConfig(row?.value);
}

/** Persiste la config (merge parcial sobre lo guardado) y devuelve el resultado. */
export async function upsertCatalogadorConfig(
  container: MedusaContainer,
  patch: Partial<CatalogadorConfig>,
  siteId?: string | null,
): Promise<CatalogadorConfig> {
  const storeConfig = container.resolve(STORE_CONFIG_MODULE) as unknown as StoreConfigLike;
  const row = await storeConfig.readSetting(CATALOGADOR_SETTING_KEY, siteId);
  const current = mergeCatalogadorConfig(row?.value);
  const merged = mergeCatalogadorConfig({ ...current, ...patch });
  await storeConfig.upsertSetting(CATALOGADOR_SETTING_KEY, merged, siteId);
  return merged;
}
