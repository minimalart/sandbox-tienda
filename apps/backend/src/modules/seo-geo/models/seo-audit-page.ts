import { model } from '@medusajs/framework/utils';

/** Clasificación del fetch: ok / bloqueado (WAF/bot) / error de red. */
export const FETCH_CLASSES = ['ok', 'blocked', 'error'] as const;

export type FetchClass = (typeof FETCH_CLASSES)[number];

/**
 * SeoAuditPage — snapshot SEO de una URL crawleada (PRD §6). Una fila por URL
 * por auditoría. Modelo portado del `auditPages` de open-seo (MIT) adaptado a
 * MikroORM: guarda una representación estructurada de la página, no el HTML
 * crudo. Sobre este snapshot corren los motores técnico y de arquitectura.
 */
export const SeoAuditPage = model
  .define('seo_audit_page', {
    id: model.id({ prefix: 'seopg' }).primaryKey(),
    audit_id: model.text(),
    url: model.text(),

    // Respuesta HTTP
    status_code: model.number().nullable(),
    fetch_class: model.enum([...FETCH_CLASSES]).default('ok'),
    response_time_ms: model.number().nullable(),
    content_type: model.text().nullable(),

    // Indexabilidad
    canonical_url: model.text().nullable(),
    canonical_header: model.text().nullable(),
    robots_meta: model.text().nullable(),
    x_robots_tag: model.text().nullable(),
    is_indexable: model.boolean().default(true),
    in_sitemap: model.boolean().default(false),

    // Metadatos
    title: model.text().nullable(),
    meta_description: model.text().nullable(),
    og_title: model.text().nullable(),
    og_description: model.text().nullable(),
    og_image: model.text().nullable(),

    // Estructura de encabezados. heading_order guarda la secuencia numérica de
    // niveles (para detectar saltos H2→H4).
    h1_count: model.number().default(0),
    h2_count: model.number().default(0),
    h3_count: model.number().default(0),
    h4_count: model.number().default(0),
    h5_count: model.number().default(0),
    h6_count: model.number().default(0),
    heading_order: model.json().nullable(),

    // Contenido
    word_count: model.number().default(0),
    content_hash: model.text().nullable(),

    // Imágenes / enlaces / datos estructurados
    images_total: model.number().default(0),
    images_missing_alt: model.number().default(0),
    internal_link_count: model.number().default(0),
    external_link_count: model.number().default(0),
    has_structured_data: model.boolean().default(false),
    structured_data_types: model.json().nullable(),
    hreflang_tags: model.json().nullable(),

    // Grafo de crawl
    crawl_depth: model.number().default(0),
    // Clasificación de la página (home/category/collection/product/cms/blog/...)
    page_type: model.text().nullable(),
    // Entidad de Medusa asociada, si se pudo resolver (product_id, category_id…)
    entity_type: model.text().nullable(),
    entity_id: model.text().nullable(),
  })
  .indexes([
    { on: ['audit_id'], where: 'deleted_at IS NULL' },
    { on: ['audit_id', 'url'], unique: true, where: 'deleted_at IS NULL' },
    { on: ['content_hash'], where: 'deleted_at IS NULL' },
  ]);

export default SeoAuditPage;
