import type { Candidate } from '../types';

/**
 * Carga de candidatos: UNA query para toda la cadena de fallbacks.
 *
 * La idea central es que probar el fallback no cueste otro round trip. En lugar de
 * consultar la estrategia 1, ver si alcanzó, consultar la 2, etc., se traen los
 * `candidate_limit` mejores candidatos de CADA eslabón en una sola pasada, con un
 * `row_number() over (partition by strategy_key)`. Después el filtrado y la
 * elección del eslabón son JS puro sobre un set acotado.
 *
 * Todos los predicados están cubiertos por el índice
 * `IDX_recommendation_relation_serve (strategy_key, source_product_id, is_active,
 * version_id) where deleted_at is null`.
 */

/** Un eslabón de la cadena, ya resuelto a (estrategia, versión activa). */
export type CandidateTier = {
  strategy_key: string;
  /**
   * Versión activa de la estrategia, o null si es manual. Las estrategias
   * automáticas SIN versión activa no se piden (no pueden tener candidatos), así
   * que este campo nunca es null para una estrategia no manual.
   */
  version_id: string | null;
  is_manual: boolean;
};

export type LoadCandidatesParams = {
  /** `product_id` del origen y/o el sentinela global. */
  sources: string[];
  tiers: CandidateTier[];
  /** Tipos de relación que levanta el placement (sólo aplica al tier manual). */
  relation_types?: string[] | null;
  sales_channel_id?: string | null;
  candidate_limit: number;
};

type KnexLike = {
  raw: (sql: string, bindings?: unknown[]) => Promise<{ rows: unknown[] }>;
};

type CandidateRow = {
  target_product_id: string;
  strategy_key: string;
  relation_type: string;
  priority: number | string;
  score: number | string;
  confidence: number | string | null;
  co_occurrences: number | string | null;
  version_id: string | null;
};

/** Placeholders `?` para una lista, para no depender de cómo knex expande arrays. */
const placeholders = (count: number): string => Array.from({ length: count }, () => '?').join(', ');

/**
 * Arma la cláusula OR de la cadena y sus bindings.
 *
 * El tier manual se identifica por `version_id is null` (las relaciones manuales
 * viven fuera del versionado) y es el único al que se le aplica el filtro de tipos
 * de relación: `relation_types` del placement expresa qué relaciones CARGADAS A
 * MANO levanta, mientras que en las automáticas el tipo lo pone el algoritmo.
 */
function buildTierClauses(
  tiers: CandidateTier[],
  relationTypes: string[] | null | undefined,
): { sql: string; bindings: unknown[] } {
  const clauses: string[] = [];
  const bindings: unknown[] = [];

  for (const tier of tiers) {
    if (tier.is_manual) {
      const hasTypes = Array.isArray(relationTypes) && relationTypes.length > 0;
      clauses.push(
        `(r.strategy_key = ? and r.version_id is null${
          hasTypes ? ` and r.relation_type in (${placeholders(relationTypes.length)})` : ''
        })`,
      );
      bindings.push(tier.strategy_key);
      if (hasTypes) bindings.push(...relationTypes);
      continue;
    }
    // Estrategia automática: sólo la versión activa. Las relaciones de una versión
    // en construcción son invisibles acá — de ahí que el swap no tenga ventana de
    // lectura a medio construir.
    if (!tier.version_id) continue;
    clauses.push('(r.strategy_key = ? and r.version_id = ?)');
    bindings.push(tier.strategy_key, tier.version_id);
  }

  return { sql: clauses.join(' or '), bindings };
}

const toNumber = (value: unknown, fallback = 0): number => {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : fallback;
};

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
};

/**
 * Devuelve los candidatos de todos los eslabones pedidos, hasta
 * `candidate_limit` por eslabón, ya ordenados por el criterio de ranking.
 *
 * Se lee muy por encima del límite de resultados porque los filtros operativos
 * (stock, canal, precio, carrito) se aplican después y pueden descartar buena parte
 * del set — sin ese margen la respuesta sale incompleta (PRD §8).
 */
export async function loadCandidates(
  knex: KnexLike,
  params: LoadCandidatesParams,
): Promise<Candidate[]> {
  if (!params.sources.length || !params.tiers.length) return [];

  const tierClauses = buildTierClauses(params.tiers, params.relation_types);
  if (!tierClauses.sql) return [];

  const bindings: unknown[] = [
    ...params.sources,
    params.sales_channel_id ?? null,
    ...tierClauses.bindings,
    Math.max(1, Math.floor(params.candidate_limit)),
  ];

  const sql = `
    with ranked as (
      select
        r.target_product_id,
        r.strategy_key,
        r.relation_type,
        r.priority,
        r.score,
        r.confidence,
        r.co_occurrences,
        r.version_id,
        row_number() over (
          partition by r.strategy_key
          order by r.priority desc, r.score desc, r.co_occurrences desc nulls last, r.target_product_id
        ) as rn
      from recommendation_relation r
      where r.deleted_at is null
        and r.is_active = true
        and r.source_product_id in (${placeholders(params.sources.length)})
        and (r.valid_from is null or r.valid_from <= now())
        and (r.valid_until is null or r.valid_until >= now())
        and (r.sales_channel_id is null or r.sales_channel_id = ?)
        and (${tierClauses.sql})
    )
    select target_product_id, strategy_key, relation_type, priority, score, confidence,
           co_occurrences, version_id
    from ranked
    where rn <= ?
  `;

  const result = await knex.raw(sql, bindings);
  const rows = (result?.rows ?? []) as CandidateRow[];

  return rows.map((row) => ({
    target_product_id: row.target_product_id,
    strategy_key: row.strategy_key,
    relation_type: row.relation_type,
    priority: toNumber(row.priority),
    score: toNumber(row.score),
    confidence: toNullableNumber(row.confidence),
    co_occurrences: toNullableNumber(row.co_occurrences),
    version_id: row.version_id,
  }));
}

/** Exportado sólo para los tests del armado de la cláusula. */
export const __testing = { buildTierClauses, placeholders };
