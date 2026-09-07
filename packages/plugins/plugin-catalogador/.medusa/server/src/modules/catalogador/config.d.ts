import type { MedusaContainer } from '@medusajs/framework/types';
/**
 * Configuración del Catalogador (PRD §22). Se persiste como un único setting
 * key/value en el módulo store-config (key `catalogador_config`), reutilizando
 * su API genérica `upsertSetting`/`listStoreSettings` — así NO se modifica el
 * código de store-config (la extensión sólo lo declara como dependencia). Los
 * secretos (API keys de barcode/scraping) NUNCA viven en este objeto (PRD §22.4):
 * se resuelven aparte, por `app-settings` (DB cifrada > env), en `settings.ts`.
 */
export declare const CATALOGADOR_SETTING_KEY = "catalogador_config";
export type TextAiConfig = {
    model: string;
    temperature: number;
    max_tokens: number;
    reasoning_effort: 'minimal' | 'low' | 'medium' | 'high';
    language: string;
    tone: string;
    max_retries: number;
    /** Prompt base + instrucciones por campo (se versiona por ejecución). */
    base_prompt: string;
    field_prompts: Record<string, string>;
};
export type ImageAiConfig = {
    model: string;
    aspect_ratio: '21:9' | '16:9' | '1:1' | '4:3' | '3:4' | '9:16';
    variations: number;
    max_images_per_product: number;
    base_prompt: string;
    recreate_prompt: string;
    lifestyle_prompt: string;
    background_prompt: string;
    missing_prompt: string;
    preserve_product: boolean;
    /**
     * Lifestyle editable (PRD §13): habilita la operación `lifestyle_editable`
     * (escena lifestyle + ajuste manual de posición/escala del producto). La
     * posición inicial se mantiene como constante interna en el MVP; sólo la
     * escala inicial es configurable.
     */
    editable_lifestyle_enabled: boolean;
    editable_lifestyle_default_scale: number;
};
export type ImageTechnicalConfig = {
    output_format: 'webp';
    webp_quality: number;
    max_kb: number;
    max_dimension: number;
    min_dimension: number;
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
export declare function getCatalogadorDefaults(): CatalogadorConfig;
/** Merge superficial por sección sobre defaults (nunca devuelve parcial). */
export declare function mergeCatalogadorConfig(value: unknown): CatalogadorConfig;
/** Lee la config efectiva (merge sobre defaults). */
export declare function getCatalogadorConfig(container: MedusaContainer, siteId?: string | null): Promise<CatalogadorConfig>;
/** Persiste la config (merge parcial sobre lo guardado) y devuelve el resultado. */
export declare function upsertCatalogadorConfig(container: MedusaContainer, patch: Partial<CatalogadorConfig>, siteId?: string | null): Promise<CatalogadorConfig>;
