import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import { RECOMMENDATION_ENGINE_MODULE } from '..';
import type { StrategyConfig } from '../config';
import type RecommendationEngineModuleService from '../service';
import type { BuildOutcome, VersionRow } from './run-build';
import {
  rankSimilar,
  scoreSimilarity,
  type AvailableSignals,
  type SimilarityInput,
} from './similarity-scoring';

/**
 * Recálculo de similares por atributos del catálogo (PRD §6).
 *
 * Es el build más largo (recorre TODO el catálogo), así que es el único RESUMIBLE: se
 * procesa por lotes de productos origen ordenados por id, se guarda el último id
 * procesado en `version.cursor` y, al agotarse el presupuesto de tiempo del tick, se
 * devuelve `in_progress` para que la próxima corrida siga desde ahí. Eso es lo que
 * permite recalcular un catálogo grande desde un contenedor de 1 vCPU sin bloquear el
 * HTTP server ni pasarse del timeout de un job.
 *
 * Los candidatos se generan por CATEGORÍA compartida: es la señal más fuerte y la que
 * acota el universo. Un producto sin categorías no genera relaciones (no hay con qué
 * compararlo), lo cual es correcto: recomendar por colección sola daría resultados
 * muy pobres.
 *
 * Se lee por `query.graph` y no por SQL crudo a propósito: los nombres de las tablas
 * pivote de tags y categorías no se referencian en SQL en ningún lugar de este repo,
 * así que asumirlos sería adivinar un contrato interno de Medusa.
 */

const PRODUCT_FIELDS = [
  'id',
  'collection_id',
  'type_id',
  'metadata',
  'categories.id',
  'categories.parent_category.id',
  'tags.value',
];

type RawProduct = {
  id: string;
  collection_id?: string | null;
  type_id?: string | null;
  metadata?: Record<string, unknown> | null;
  categories?: Array<{ id?: string | null; parent_category?: { id?: string | null } | null }> | null;
  tags?: Array<{ value?: string | null }> | null;
};

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

/** Misma normalización que el serve: las categorías incluyen a los padres. */
function toSimilarityInput(raw: RawProduct): SimilarityInput & { id: string } {
  const categories = new Set<string>();
  for (const category of raw.categories ?? []) {
    const id = asString(category?.id);
    if (id) categories.add(id);
    const parentId = asString(category?.parent_category?.id);
    if (parentId) categories.add(parentId);
  }
  const brand = asString(raw.metadata?.brand);
  return {
    id: raw.id,
    category_ids: [...categories],
    tag_values: (raw.tags ?? [])
      .map((tag) => asString(tag?.value))
      .filter((value): value is string => value !== null),
    collection_id: asString(raw.collection_id),
    type_id: asString(raw.type_id),
    brand_id: brand ? `metadata:${brand.toLowerCase()}` : null,
  };
}

export type SimilarBuildDeps = {
  /** Instante límite del tick; al pasarlo se devuelve `in_progress`. */
  deadline: number;
  batchSize: number;
  insert: (
    rows: Array<{
      source_product_id: string;
      target_product_id: string;
      relation_type: string;
      score: number;
    }>,
  ) => Promise<number>;
};

export async function buildSimilarRelations(
  container: MedusaContainer,
  version: VersionRow,
  config: StrategyConfig,
  deps: SimilarBuildDeps,
): Promise<BuildOutcome> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const service = container.resolve(
    RECOMMENDATION_ENGINE_MODULE,
  ) as unknown as RecommendationEngineModuleService;

  let cursor = version.cursor;
  let processed = version.processed_count ?? 0;
  let generated = 0;
  let discarded = 0;

  while (Date.now() < deps.deadline) {
    // Lote de productos origen, ordenado por id para que el cursor sea estable.
    const { data: sourceRows } = await query.graph({
      entity: 'product',
      fields: PRODUCT_FIELDS,
      filters: { status: 'published', ...(cursor ? { id: { $gt: cursor } } : {}) },
      pagination: { take: deps.batchSize, skip: 0, order: { id: 'ASC' } },
    });

    const sources = (sourceRows as RawProduct[]).map(toSimilarityInput);
    if (!sources.length) {
      // Catálogo recorrido: la corrida termina y el driver la activa.
      await service.updateRecommendationVersions({
        id: version.id,
        cursor: null,
        processed_count: processed,
      } as never);
      return {
        status: 'activated',
        relations_generated: generated,
        relations_discarded: discarded,
        orders_analyzed: 0,
      };
    }

    // Universo de candidatos del lote: todos los productos que comparten alguna
    // categoría con algún origen. Una sola consulta para todo el lote.
    const categoryIds = [...new Set(sources.flatMap((source) => source.category_ids))];
    let candidates: Array<SimilarityInput & { id: string }> = [];
    if (categoryIds.length) {
      const { data: candidateRows } = await query.graph({
        entity: 'product',
        fields: PRODUCT_FIELDS,
        filters: { status: 'published', categories: { id: categoryIds } },
        pagination: { take: Math.min(2000, categoryIds.length * config.candidate_cap), skip: 0 },
      });
      candidates = (candidateRows as RawProduct[]).map(toSimilarityInput);
    }

    // Señales disponibles en el lote: si el catálogo no usa tags ni marcas, sus pesos
    // se redistribuyen en lugar de bajar todos los scores.
    const available: AvailableSignals = {
      tags: candidates.some((candidate) => candidate.tag_values.length > 0),
      brand: candidates.some((candidate) => candidate.brand_id !== null),
    };

    const rows: Array<{
      source_product_id: string;
      target_product_id: string;
      relation_type: string;
      score: number;
    }> = [];

    for (const source of sources) {
      if (!source.category_ids.length) continue;
      const sourceCategories = new Set(source.category_ids);
      const scored = candidates
        .filter(
          (candidate) =>
            candidate.id !== source.id &&
            candidate.category_ids.some((id) => sourceCategories.has(id)),
        )
        .map((candidate) => ({
          target_product_id: candidate.id,
          score: scoreSimilarity(source, candidate, config.similarity_weights, available),
        }));

      const best = rankSimilar(scored, config.max_relations_per_source);
      discarded += scored.length - best.length;
      rows.push(
        ...best.map((candidate) => ({
          source_product_id: source.id,
          target_product_id: candidate.target_product_id,
          relation_type: 'similar',
          score: candidate.score,
        })),
      );
    }

    generated += await deps.insert(rows);
    processed += sources.length;
    cursor = sources[sources.length - 1]?.id ?? cursor;

    // El cursor se persiste en CADA lote: si el contenedor se reinicia a mitad, no se
    // repite el trabajo ya hecho.
    await service.updateRecommendationVersions({
      id: version.id,
      cursor,
      processed_count: processed,
    } as never);
  }

  // Se agotó el presupuesto del tick: la versión queda en `building` y el drainer la
  // retoma en la próxima corrida.
  return {
    status: 'in_progress',
    relations_generated: generated,
    relations_discarded: discarded,
    orders_analyzed: 0,
  };
}
