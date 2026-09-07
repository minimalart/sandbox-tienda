import { model } from '@medusajs/framework/utils';

/**
 * Tipo de estrategia. Determina QUÉ algoritmo la construye; la `key` de la fila
 * es lo que referencian los placements y las cadenas de fallback, así que puede
 * haber varias estrategias del mismo `kind` con configuraciones distintas.
 */
export const STRATEGY_KINDS = [
  'manual', // relaciones cargadas por el merchant (no se recalcula)
  'similar', // similares por atributos del catálogo
  'frequently_bought_together', // co-compra sobre órdenes completadas
  'trending', // crecimiento reciente de actividad
  'popular', // más vendidos (el terminal natural de toda cadena)
] as const;

export type StrategyKind = (typeof STRATEGY_KINDS)[number];

/** Cada cuánto se reconstruye la estrategia (PRD §13). */
export const STRATEGY_CADENCES = ['hourly', 'daily', 'manual'] as const;

export type StrategyCadence = (typeof STRATEGY_CADENCES)[number];

/**
 * RecommendationStrategy — configuración de una estrategia (PRD §11.2).
 *
 * Los mínimos estadísticos viven en `config` (json) y no como columnas: son
 * específicos por `kind` (a `popular` no le aplica `min_confidence`) y el PRD
 * pide poder ajustarlos desde el backoffice sin migraciones. El embudo
 * `mergeStrategyConfig` de `config.ts` garantiza que la lectura nunca sea
 * parcial y aplica los topes duros.
 */
export const RecommendationStrategy = model
  .define('recommendation_strategy', {
    id: model.id({ prefix: 'recstr' }).primaryKey(),

    key: model.text(), // referenciada por placements y cadenas de fallback
    name: model.text(),
    kind: model.enum([...STRATEGY_KINDS]),
    enabled: model.boolean().default(true),

    config: model.json().nullable(),
    // Lista ordenada de keys de estrategia a probar cuando esta no llena el
    // límite. El fallback es comportamiento NORMAL (PRD §7), sobre todo en
    // tiendas nuevas: toda cadena por defecto termina en `popular`.
    fallback_chain: model.json().nullable(),

    cadence: model.enum([...STRATEGY_CADENCES]).default('daily'),
    sales_channel_id: model.text().nullable(), // NULL = global

    last_built_at: model.dateTime().nullable(),
    last_status: model.text().nullable(),
    sort_order: model.number().default(0),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['key'], unique: true, where: 'deleted_at IS NULL' },
    { on: ['enabled', 'kind'], where: 'deleted_at IS NULL' },
  ]);

export default RecommendationStrategy;
