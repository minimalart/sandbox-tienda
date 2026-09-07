import { z } from 'zod';
import { RELATION_TYPES, STRATEGY_CADENCES } from '../../../modules/recommendations/models';

/** Validadores de las rutas admin del motor de recomendaciones. */

const id = z.string().trim().min(1).max(120);
const idList = z.array(id).min(1).max(100);

/**
 * Patch parcial de la config global. Las secciones llegan como objetos abiertos
 * porque el embudo real es `mergeRecommendationsConfig`, que normaliza cada campo y
 * aplica los topes duros — duplicar acá esos límites sería mantenerlos en dos
 * lugares y arriesgar que difieran.
 */
export const UpdateRecommendationsConfig = z
  .object({
    enabled: z.boolean().optional(),
    default_result_limit: z.coerce.number().int().optional(),
    default_candidate_limit: z.coerce.number().int().optional(),
    max_chain_length: z.coerce.number().int().optional(),
    min_results: z.coerce.number().int().optional(),
    attribution_window_days: z.coerce.number().int().optional(),
    event_ttl_hours: z.coerce.number().int().optional(),
    event_retention_days: z.coerce.number().int().optional(),
    hourly_metric_retention_days: z.coerce.number().int().optional(),
    keep_versions_per_strategy: z.coerce.number().int().optional(),
    free_shipping: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const UpdateRecommendationStrategy = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    enabled: z.boolean().optional(),
    cadence: z.enum(STRATEGY_CADENCES).optional(),
    config: z.record(z.string(), z.unknown()).optional(),
    fallback_chain: z.array(z.string().trim().min(1)).max(6).optional(),
    sales_channel_id: id.nullish(),
    sort_order: z.coerce.number().int().optional(),
  })
  .strict();

/** Filtros configurables del placement (PRD §8). */
const PlacementFiltersSchema = z
  .object({
    price_min: z.coerce.number().nonnegative().nullish(),
    price_max: z.coerce.number().nonnegative().nullish(),
    same_category: z.boolean().optional(),
    different_category: z.boolean().optional(),
    same_brand: z.boolean().optional(),
    excluded_category_ids: z.array(id).max(100).optional(),
    required_tags: z.array(z.string().trim().min(1)).max(50).optional(),
    excluded_tags: z.array(z.string().trim().min(1)).max(50).optional(),
    metadata_match: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const UpdateRecommendationPlacement = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    enabled: z.boolean().optional(),
    strategy_key: z.string().trim().min(1).max(80).optional(),
    fallback_chain: z.array(z.string().trim().min(1)).max(6).nullish(),
    result_limit: z.coerce.number().int().positive().max(50).optional(),
    candidate_limit: z.coerce.number().int().positive().max(300).optional(),
    filters: PlacementFiltersSchema.nullish(),
    relation_types: z.array(z.enum(RELATION_TYPES)).max(RELATION_TYPES.length).nullish(),
    sales_channel_id: id.nullish(),
    sort_order: z.coerce.number().int().optional(),
  })
  .strict();

/**
 * Una relación manual. `valid_from`/`valid_until` son opcionales (vigencia
 * permanente si no se informan) y llegan como ISO.
 */
export const CreateRecommendationRelation = z
  .object({
    source_product_id: id,
    target_product_id: id,
    relation_type: z.enum(RELATION_TYPES).default('complementary'),
    priority: z.coerce.number().int().optional(),
    is_active: z.boolean().optional(),
    valid_from: z.coerce.date().nullish(),
    valid_until: z.coerce.date().nullish(),
    sales_channel_id: id.nullish(),
  })
  .strict()
  .refine((value) => value.source_product_id !== value.target_product_id, {
    message: 'Un producto no puede relacionarse consigo mismo.',
    path: ['target_product_id'],
  })
  .refine(
    (value) => !value.valid_from || !value.valid_until || value.valid_from <= value.valid_until,
    { message: 'La fecha de inicio no puede ser posterior a la de fin.', path: ['valid_until'] },
  );

export const UpdateRecommendationRelation = z
  .object({
    relation_type: z.enum(RELATION_TYPES).optional(),
    priority: z.coerce.number().int().optional(),
    is_active: z.boolean().optional(),
    valid_from: z.coerce.date().nullish(),
    valid_until: z.coerce.date().nullish(),
    sales_channel_id: id.nullish(),
  })
  .strict();

/**
 * Alta masiva: un producto origen, N destinos. Es la forma que usa la UI —
 * "buscar producto, elegir varios relacionados, guardar" — y evita N requests.
 */
export const BulkCreateRecommendationRelations = z
  .object({
    source_product_id: id,
    target_product_ids: idList,
    relation_type: z.enum(RELATION_TYPES).default('complementary'),
    priority: z.coerce.number().int().optional(),
    sales_channel_id: id.nullish(),
  })
  .strict();

export const ListRecommendationRelationsQuery = z
  .object({
    source_product_id: id.optional(),
    target_product_id: id.optional(),
    relation_type: z.enum(RELATION_TYPES).optional(),
    is_active: z.enum(['true', 'false']).optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
    offset: z.coerce.number().int().nonnegative().optional(),
  })
  .strict();

export const SearchRecommendationProductsQuery = z
  .object({
    q: z.string().trim().max(120).optional(),
    ids: z.union([z.string(), z.array(z.string())]).optional(),
    region_id: id.optional(),
    limit: z.coerce.number().int().positive().max(50).optional(),
    offset: z.coerce.number().int().nonnegative().optional(),
  })
  .strict();

/**
 * Previsualización de un placement: qué productos devolvería el motor HOY.
 *
 * No se reusa el schema store (`api/store/recommendations/validators.ts`) porque los
 * ejes son distintos: acá no hay `cart_id`, `customer_id` ni `session_id` —el preview
 * no pertenece a ninguna sesión de comprador— y `limit` no se acepta para que la
 * previsualización muestre exactamente el `result_limit` configurado en el placement.
 */
export const PreviewRecommendations = z
  .object({
    placement: z.string().trim().min(1).max(80),
    product_id: id.optional(),
    sales_channel_id: id.nullish(),
    region_id: id.optional(),
    /** Sólo lo que el preview necesita simular: la banda de precio del bridge. */
    target_price: z.coerce.number().nonnegative().max(100_000_000).optional(),
  })
  .strict();

export type PreviewRecommendationsInput = z.infer<typeof PreviewRecommendations>;
