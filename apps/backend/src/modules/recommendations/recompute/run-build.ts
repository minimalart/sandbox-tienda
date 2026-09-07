import { randomBytes } from 'node:crypto';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import { RECOMMENDATION_ENGINE_MODULE } from '..';
import { mergeStrategyConfig, type StrategyConfig } from '../config';
import { getRecommendationsSettings } from '../settings';
import { GLOBAL_SOURCE_PRODUCT_ID } from '../models';
import type RecommendationEngineModuleService from '../service';
import { qualifyPairs, type PairCounts } from './fbt-math';
import { buildPairCountsSql, buildUnitsSql } from './orders-sql';
import { buildSimilarRelations } from './similar';
import { activateVersion } from './swap';

/**
 * Driver de los recálculos (PRD §12/§13).
 *
 * Una corrida = una fila `recommendation_version`. La fila en estado `building` es a
 * la vez la entrada de cola (la crea el scheduler) y el log de la corrida (PRD §20).
 *
 * Contrato de tiempo: `runBuild` respeta un presupuesto en milisegundos y puede
 * terminar SIN completar, dejando la versión en `building` con su `cursor` para que la
 * próxima corrida siga. Eso es lo que permite recalcular todo un catálogo desde un
 * contenedor de 1 vCPU compartido con el HTTP server, sin bloquearlo.
 */

const newRelationId = (): string => `recrel_${randomBytes(12).toString('base64url')}`;

type KnexLike = {
  raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: unknown[]; rowCount?: number }>;
};

export type VersionRow = {
  id: string;
  strategy_key: string;
  sales_channel_id: string | null;
  cursor: string | null;
  processed_count: number;
  started_at: string | Date | null;
  config_snapshot: unknown;
};

export type BuildOutcome = {
  status: 'activated' | 'in_progress' | 'skipped_insufficient_data' | 'failed';
  relations_generated: number;
  relations_discarded: number;
  orders_analyzed: number;
  message?: string;
};

/** Fila de relación lista para insertar. */
type RelationInsert = {
  source_product_id: string;
  target_product_id: string;
  relation_type: string;
  score: number;
  support?: number | null;
  confidence?: number | null;
  lift?: number | null;
  co_occurrences?: number | null;
};

const knexOf = (container: MedusaContainer): KnexLike =>
  container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as unknown as KnexLike;

/**
 * Inserta relaciones de una versión.
 *
 * `ON CONFLICT DO NOTHING` sobre el índice único `(version_id, source, target)`: hace
 * el build REENTRANTE. Si una corrida se corta después de escribir la mitad de un
 * lote, la siguiente reprocesa ese lote sin duplicar nada.
 */
async function insertRelations(
  container: MedusaContainer,
  versionId: string,
  strategyKey: string,
  origin: string,
  rows: RelationInsert[],
): Promise<number> {
  if (!rows.length) return 0;

  const columns = [
    'id',
    'source_product_id',
    'target_product_id',
    'relation_type',
    'strategy_key',
    'origin',
    'version_id',
    'score',
    'support',
    'confidence',
    'lift',
    'co_occurrences',
    'is_active',
  ];

  const placeholders = rows.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ');
  const bindings = rows.flatMap((row) => [
    newRelationId(),
    row.source_product_id,
    row.target_product_id,
    row.relation_type,
    strategyKey,
    origin,
    versionId,
    row.score,
    row.support ?? null,
    row.confidence ?? null,
    row.lift ?? null,
    row.co_occurrences ?? null,
    true,
  ]);

  const result = await knexOf(container).raw(
    `insert into "recommendation_relation" (${columns.map((c) => `"${c}"`).join(', ')})
     values ${placeholders}
     on conflict ("version_id", "source_product_id", "target_product_id")
       where "deleted_at" is null and "version_id" is not null
     do nothing
     returning "id"`,
    bindings,
  );

  return (result?.rows?.length ?? result?.rowCount ?? 0) as number;
}

/** Co-compra: una sola query de conteos + los gates en Node. */
async function buildFrequentlyBoughtTogether(
  container: MedusaContainer,
  version: VersionRow,
  config: StrategyConfig,
): Promise<BuildOutcome> {
  const result = await knexOf(container).raw(buildPairCountsSql(), [
    config.lookback_days,
    version.sales_channel_id,
    version.sales_channel_id,
    config.max_basket_size,
    config.min_co_occurrences,
    // Se pide margen sobre el tope final: los gates de confianza y lift descartan
    // algunos y sin margen se quedaría corto.
    config.max_relations_per_source * 2,
  ]);

  const rows = (result?.rows ?? []) as Array<Record<string, unknown>>;
  const totalOrders = Number(rows[0]?.total_orders ?? 0);

  const pairs: PairCounts[] = rows.map((row) => ({
    source_product_id: row.source_product_id as string,
    target_product_id: row.target_product_id as string,
    co_occurrences: Number(row.co_occurrences ?? 0),
    source_orders: Number(row.source_orders ?? 0),
    target_orders: Number(row.target_orders ?? 0),
  }));

  const { qualified, discarded, insufficient_data } = qualifyPairs(pairs, totalOrders, config);

  if (insufficient_data) {
    // "No hay datos suficientes" NO es lo mismo que "éxito con cero relaciones": en el
    // primer caso la versión no se activa y la anterior sigue sirviendo. Activar una
    // versión vacía apagaría la estrategia en el storefront.
    return {
      status: 'skipped_insufficient_data',
      relations_generated: 0,
      relations_discarded: discarded,
      orders_analyzed: totalOrders,
      message: `Se analizaron ${totalOrders} órdenes y el mínimo configurado es ${config.min_orders_analyzed}.`,
    };
  }

  const generated = await insertRelations(
    container,
    version.id,
    version.strategy_key,
    'orders',
    qualified.map((metrics) => ({
      source_product_id: metrics.source_product_id,
      target_product_id: metrics.target_product_id,
      relation_type: 'bought_together',
      // La CONFIANZA es el score: responde a "quien compra esto, qué compra".
      score: metrics.confidence,
      support: metrics.support,
      confidence: metrics.confidence,
      lift: metrics.lift,
      co_occurrences: metrics.co_occurrences,
    })),
  );

  return {
    status: 'activated',
    relations_generated: generated,
    relations_discarded: discarded,
    orders_analyzed: totalOrders,
  };
}

/**
 * Populares y tendencia: relaciones "globales" (sin producto de origen).
 *
 * Se guardan bajo el sentinela `__global__` para reusar la misma tabla y el mismo
 * índice del serve.
 */
async function buildGlobalRanking(
  container: MedusaContainer,
  version: VersionRow,
  config: StrategyConfig,
  kind: 'popular' | 'trending',
): Promise<BuildOutcome> {
  const knex = knexOf(container);
  const limit = Math.max(config.max_relations_per_source, 50);

  const currentDays =
    kind === 'trending' ? Math.max(1, Math.ceil(config.window_hours / 24)) : config.lookback_days;

  const current = await knex.raw(buildUnitsSql(), [
    currentDays,
    version.sales_channel_id,
    version.sales_channel_id,
    config.min_units,
    limit,
  ]);
  const currentRows = (current?.rows ?? []) as Array<{ product_id: string; units: string | number; orders: number }>;

  let scored: RelationInsert[];

  if (kind === 'popular') {
    const max = Math.max(...currentRows.map((row) => Number(row.units)), 1);
    scored = currentRows.map((row) => ({
      source_product_id: GLOBAL_SOURCE_PRODUCT_ID,
      target_product_id: row.product_id,
      relation_type: 'similar',
      // Score normalizado a [0,1] para que sea comparable con el de otras
      // estrategias cuando conviven en una misma cadena.
      score: Number(row.units) / max,
    }));
  } else {
    // Tendencia = crecimiento contra la ventana INMEDIATAMENTE anterior. Se pide el
    // doble de ventana y se resta, en lugar de dos queries.
    const previous = await knex.raw(buildUnitsSql(), [
      currentDays * 2,
      version.sales_channel_id,
      version.sales_channel_id,
      0,
      limit * 4,
    ]);
    const previousRows = (previous?.rows ?? []) as Array<{ product_id: string; units: string | number }>;
    const twoWindows = new Map(previousRows.map((row) => [row.product_id, Number(row.units)]));

    scored = currentRows
      .map((row) => {
        const currentUnits = Number(row.units);
        const priorUnits = Math.max(0, (twoWindows.get(row.product_id) ?? currentUnits) - currentUnits);
        // `GREATEST(prior, 1)` evita dividir por cero y evita que un producto que pasó
        // de 0 a 1 unidad domine el ranking con crecimiento infinito.
        const growth = (currentUnits - priorUnits) / Math.max(priorUnits, 1);
        return {
          source_product_id: GLOBAL_SOURCE_PRODUCT_ID,
          target_product_id: row.product_id,
          relation_type: 'similar',
          score: growth,
        };
      })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score || a.target_product_id.localeCompare(b.target_product_id))
      .slice(0, limit);
  }

  if (!scored.length) {
    return {
      status: 'skipped_insufficient_data',
      relations_generated: 0,
      relations_discarded: 0,
      orders_analyzed: currentRows.length,
      message: 'No hay ventas suficientes en la ventana configurada.',
    };
  }

  const generated = await insertRelations(
    container,
    version.id,
    version.strategy_key,
    'orders',
    scored,
  );

  return {
    status: 'activated',
    relations_generated: generated,
    relations_discarded: currentRows.length - scored.length,
    orders_analyzed: currentRows.length,
  };
}

/**
 * Ejecuta una corrida y deja la versión en su estado final.
 *
 * Nunca lanza: cualquier error deja la versión en `failed` con el detalle, y la versión
 * anterior sigue activa y sirviendo. Un recálculo roto NO puede dejar al storefront
 * sin recomendaciones.
 */
export async function runBuild(
  container: MedusaContainer,
  version: VersionRow,
): Promise<BuildOutcome> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const service = container.resolve(
    RECOMMENDATION_ENGINE_MODULE,
  ) as unknown as RecommendationEngineModuleService;

  // Presupuesto y lote se congelan al ARRANCAR la corrida, igual que la config de la
  // estrategia unas líneas más abajo: una corrida que a mitad de camino cambiara de
  // deadline dejaría un cursor que no se corresponde con el trabajo que dijo haber
  // hecho. El valor nuevo rige desde la próxima corrida, que con el drainer cada 10
  // minutos es a lo sumo la de dentro de un rato.
  const { buildMaxMs, buildBatch } = getRecommendationsSettings();

  const startedAt = Date.now();
  const deadline = startedAt + buildMaxMs;

  try {
    const strategy = (await service.listRecommendationStrategies(
      { key: version.strategy_key },
      { take: 1 },
    )) as unknown as Array<{ kind: string; config: unknown }>;

    const kind = strategy[0]?.kind;
    if (!kind) throw new Error(`La estrategia "${version.strategy_key}" no existe.`);

    // La config se congela al arrancar: si el merchant cambia los mínimos a mitad de
    // una corrida, esa corrida sigue con los que empezó.
    const config = mergeStrategyConfig(version.config_snapshot ?? strategy[0]?.config);

    let outcome: BuildOutcome;
    switch (kind) {
      case 'frequently_bought_together':
        outcome = await buildFrequentlyBoughtTogether(container, version, config);
        break;
      case 'popular':
      case 'trending':
        outcome = await buildGlobalRanking(container, version, config, kind);
        break;
      case 'similar':
        outcome = await buildSimilarRelations(container, version, config, {
          deadline,
          batchSize: buildBatch,
          insert: (rows) => insertRelations(container, version.id, version.strategy_key, 'catalog', rows),
        });
        break;
      case 'manual':
        // Las manuales no se recalculan: la corrida se cierra sin hacer nada.
        outcome = {
          status: 'skipped_insufficient_data',
          relations_generated: 0,
          relations_discarded: 0,
          orders_analyzed: 0,
          message: 'Las relaciones manuales no se recalculan.',
        };
        break;
      default:
        throw new Error(`Tipo de estrategia no soportado: ${kind}`);
    }

    const durationMs = Date.now() - startedAt;

    if (outcome.status === 'in_progress') {
      // Queda en `building`: la próxima corrida sigue desde el cursor.
      return outcome;
    }

    if (outcome.status === 'skipped_insufficient_data') {
      await service.updateRecommendationVersions({
        id: version.id,
        status: 'ready',
        finished_at: new Date(),
        duration_ms: durationMs,
        relations_generated: outcome.relations_generated,
        relations_discarded: outcome.relations_discarded,
        orders_analyzed: outcome.orders_analyzed,
        error_summary: outcome.message ? { reason: outcome.message } : null,
      } as never);
      logger.info(
        `[recommendations-build] ${version.strategy_key}: sin activar — ${outcome.message ?? 'datos insuficientes'}`,
      );
      return outcome;
    }

    await service.updateRecommendationVersions({
      id: version.id,
      status: 'ready',
      finished_at: new Date(),
      duration_ms: durationMs,
      relations_generated: outcome.relations_generated,
      relations_discarded: outcome.relations_discarded,
      orders_analyzed: outcome.orders_analyzed,
    } as never);

    await activateVersion(container, {
      version_id: version.id,
      strategy_key: version.strategy_key,
      sales_channel_id: version.sales_channel_id,
      duration_ms: durationMs,
    });

    await service.updateRecommendationStrategies({
      id: (
        (await service.listRecommendationStrategies({ key: version.strategy_key }, { take: 1 })) as unknown as Array<{
          id: string;
        }>
      )[0]?.id,
      last_built_at: new Date(),
      last_status: 'active',
    } as never);

    logger.info(
      `[recommendations-build] ${version.strategy_key}: ${outcome.relations_generated} relaciones activadas en ${durationMs}ms`,
    );
    return outcome;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // La versión anterior queda intacta y sigue sirviendo (PRD §12).
    await service
      .updateRecommendationVersions({
        id: version.id,
        status: 'failed',
        finished_at: new Date(),
        duration_ms: Date.now() - startedAt,
        error_summary: { message },
      } as never)
      .catch(() => undefined);
    logger.error(`[recommendations-build] ${version.strategy_key} falló: ${message}`);
    return {
      status: 'failed',
      relations_generated: 0,
      relations_discarded: 0,
      orders_analyzed: 0,
      message,
    };
  }
}
