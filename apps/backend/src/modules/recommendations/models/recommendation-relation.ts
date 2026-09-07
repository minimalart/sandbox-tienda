import { model } from '@medusajs/framework/utils';

/**
 * Sentinela de `source_product_id` para las estrategias que NO tienen producto
 * de origen (trending, popular, bridge). Así esas estrategias reusan la misma
 * tabla y —más importante— el mismo índice del serve
 * `(strategy_key, source_product_id, is_active, version_id)`, en lugar de
 * necesitar una tabla o un índice aparte con `source_product_id IS NULL`.
 */
export const GLOBAL_SOURCE_PRODUCT_ID = '__global__';

/** Tipos de relación del PRD §6.1 (los 6 primeros los elige el merchant). */
export const RELATION_TYPES = [
  'complementary',
  'similar',
  'accessory',
  'replacement',
  'alternative',
  'upgrade',
  'bought_together', // generado por la estrategia de co-compra
  'viewed_together', // reservado (aún no se calcula en la V1)
] as const;

export type RelationType = (typeof RELATION_TYPES)[number];

/** Quién produjo la relación (PRD §11.1 `origin`). */
export const RELATION_ORIGINS = [
  'merchant', // creada a mano en el backoffice
  'catalog', // derivada de atributos del catálogo (similares)
  'orders', // derivada de órdenes completadas (co-compra, popular, trending)
  'behavior', // derivada de eventos de navegación
  'rules',
  'import',
  'ai',
] as const;

export type RelationOrigin = (typeof RELATION_ORIGINS)[number];

/**
 * RecommendationRelation — una arista producto→producto, manual o calculada.
 *
 * Las manuales tienen `version_id = NULL` y NO participan del versionado
 * automático: nunca quedan `superseded` por un recálculo. Las calculadas
 * pertenecen a una `RecommendationVersion` y son invisibles para el serve hasta
 * que esa versión pasa a `active` (ahí está el swap atómico: no hay ventana de
 * lectura a medio construir).
 *
 * `strategy_key` es la key de la estrategia (no su `kind`), para que un merchant
 * pueda tener dos estrategias del mismo tipo con configuraciones distintas y la
 * cadena de fallbacks —que es una lista de keys— resuelva directo contra este
 * campo en un solo hit de índice.
 */
export const RecommendationRelation = model
  .define('recommendation_relation', {
    id: model.id({ prefix: 'recrel' }).primaryKey(),

    source_product_id: model.text(), // `__global__` para estrategias sin origen
    target_product_id: model.text(),
    relation_type: model.enum([...RELATION_TYPES]).default('complementary'),

    strategy_key: model.text(),
    origin: model.enum([...RELATION_ORIGINS]).default('merchant'),
    // NULL = manual (fuera del versionado). Con valor = pertenece a ese lote.
    version_id: model.text().nullable(),

    priority: model.number().default(0), // orden manual; gana sobre `score`
    score: model.number().default(0), // ranking automático (confidence/similitud/growth)

    // Evidencia estadística (sólo en relaciones de co-compra). Se guarda para
    // poder explicar la recomendación y para auditar los mínimos del PRD §6.
    support: model.number().nullable(),
    confidence: model.number().nullable(),
    lift: model.number().nullable(),
    co_occurrences: model.number().nullable(),

    is_active: model.boolean().default(true),
    valid_from: model.dateTime().nullable(),
    valid_until: model.dateTime().nullable(),

    sales_channel_id: model.text().nullable(), // NULL = todos los canales
    created_by: model.text().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([
    // El índice del serve: cubre TODOS los predicados de la query de candidatos.
    { on: ['strategy_key', 'source_product_id', 'is_active', 'version_id'], where: 'deleted_at IS NULL' },
    // Dedupe de relaciones manuales (una por origen+destino+tipo).
    {
      on: ['source_product_id', 'target_product_id', 'relation_type'],
      unique: true,
      where: 'deleted_at IS NULL AND version_id IS NULL',
    },
    // Idempotencia del build: un par por versión.
    {
      on: ['version_id', 'source_product_id', 'target_product_id'],
      unique: true,
      where: 'deleted_at IS NULL AND version_id IS NOT NULL',
    },
    { on: ['version_id'] }, // swap + purga
    { on: ['target_product_id'], where: 'deleted_at IS NULL' }, // lookup inverso / limpieza de huérfanas
  ]);

export default RecommendationRelation;
