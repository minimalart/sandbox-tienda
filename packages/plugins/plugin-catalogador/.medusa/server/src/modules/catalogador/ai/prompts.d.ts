import type { CatalogadorConfig } from '../config';
/** Campos de texto soportados por el enriquecimiento IA (PRD §12.1). */
export declare const TEXT_FIELDS: readonly ["subtitle", "description", "meta_title", "meta_description", "keywords", "categories", "tags", "alt_text"];
export type TextField = (typeof TEXT_FIELDS)[number];
export type ProductContext = {
    title: string;
    subtitle?: string | null;
    description?: string | null;
    collection?: string | null;
    brand?: string | null;
    category_paths: string[];
    tag_values: string[];
    variant_skus: string[];
    metadata?: Record<string, unknown> | null;
    has_image: boolean;
};
/**
 * Construye el prompt de sistema + usuario para generar los campos pedidos.
 * `allowedCategories`/`allowedTags` fuerzan a reutilizar entidades existentes.
 */
export declare function buildEnrichmentMessages(opts: {
    config: CatalogadorConfig;
    fields: TextField[];
    product: ProductContext;
    allowedCategories: string[];
    allowedTags: string[];
    imageDataUrl?: string | null;
    externalContext?: string | null;
}): {
    system: string;
    userText: string;
    imageDataUrl?: string | null;
};
