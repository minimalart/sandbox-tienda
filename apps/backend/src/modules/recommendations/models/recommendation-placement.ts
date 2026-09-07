import { model } from '@medusajs/framework/utils';

/** Placements de la V1 (PRD §11.3). El storefront pide recomendaciones por key. */
export const PLACEMENT_KEYS = [
  'product-detail-similar',
  'product-detail-complementary',
  'product-detail-fbt',
  'cart-recommendations',
  'free-shipping-bridge',
  'recently-viewed',
] as const;

export type PlacementKey = (typeof PLACEMENT_KEYS)[number];

/**
 * RecommendationPlacement — dónde y cómo se piden recomendaciones (PRD §11.3).
 *
 * `candidate_limit` es la pieza que evita respuestas incompletas: se leen muchos
 * más candidatos que el `result_limit` pedido porque los filtros operativos
 * (stock, canal, precio, ya-en-el-carrito) se aplican al SERVIR, no al
 * precalcular, y pueden descartar buena parte del set (PRD §8).
 *
 * Los nombres son los del PRD §11.3 y no `limit`/`overfetch`: además de ser
 * fieles, `limit` es palabra reservada en SQL y obligaría a citarla en cada query
 * cruda del serve.
 */
export const RecommendationPlacement = model
  .define('recommendation_placement', {
    id: model.id({ prefix: 'recplc' }).primaryKey(),

    key: model.text(),
    name: model.text(),
    enabled: model.boolean().default(true),

    strategy_key: model.text(),
    // Override de la cadena de la estrategia. NULL = se usa la de la estrategia.
    fallback_chain: model.json().nullable(),

    result_limit: model.number().default(8),
    candidate_limit: model.number().default(30),

    // Filtros configurables del PRD §8 (los obligatorios no se configuran:
    // están cableados en serve/filters.ts).
    filters: model.json().nullable(),
    // Qué tipos de relación manual levanta este placement (ej. el placement de
    // complementarios no debería traer `alternative`).
    relation_types: model.json().nullable(),

    sales_channel_id: model.text().nullable(),
    sort_order: model.number().default(0),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['key'], unique: true, where: 'deleted_at IS NULL' },
    { on: ['enabled'], where: 'deleted_at IS NULL' },
  ]);

export default RecommendationPlacement;
