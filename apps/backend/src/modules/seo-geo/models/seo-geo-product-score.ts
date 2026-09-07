import { model } from '@medusajs/framework/utils';

/**
 * SeoGeoProductScore — score GEO heurístico de un producto en una auditoría
 * (PRD §10/§11/§13). Los subscores (0-100) salen de señales objetivas
 * calculadas desde los datos de Medusa (completitud, entidades, comparabilidad,
 * FAQ, datos estructurados, profundidad de contenido), SIN LLM por producto —
 * así escala a catálogos de decenas de miles de productos y es determinista para
 * el historial. Las flags de gaps permiten agregar hallazgos GEO rápidamente
 * (ej. "540 productos no indican materiales", PRD §14).
 */
export const SeoGeoProductScore = model
  .define('seo_geo_product_score', {
    id: model.id({ prefix: 'seogeo' }).primaryKey(),
    audit_id: model.text(),
    product_id: model.text(),

    // Score GEO global 0-100 y sus componentes
    score: model.number().default(0),
    comprehension: model.number().default(0),
    coverage: model.number().default(0),
    authority: model.number().default(0),
    comparability: model.number().default(0),
    structured_data: model.number().default(0),
    depth: model.number().default(0),

    // Flags de gaps (para agregación de hallazgos GEO)
    has_use_cases: model.boolean().default(false),
    has_materials: model.boolean().default(false),
    is_comparable: model.boolean().default(false),
    has_faq: model.boolean().default(false),
    has_benefits: model.boolean().default(false),
    has_compatibilities: model.boolean().default(false),

    // Señales crudas usadas en el cálculo (longitud de descripción, nº de
    // atributos, presencia de GTIN/SKU, freshness) — para explicar el score.
    signals: model.json().nullable(),
  })
  .indexes([
    { on: ['audit_id'], where: 'deleted_at IS NULL' },
    { on: ['audit_id', 'product_id'], unique: true, where: 'deleted_at IS NULL' },
    { on: ['product_id'], where: 'deleted_at IS NULL' },
  ]);

export default SeoGeoProductScore;
