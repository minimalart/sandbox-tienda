import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import { getRecommendationsConfig } from '../config';
import { getRecommendationsSettings } from '../settings';

/**
 * Retención de datos (PRD §13.5).
 *
 *   eventos crudos      → 45 días
 *   métricas horarias   → 90 días
 *   métricas diarias    → permanentes
 *
 * Los borrados son DUROS y por lotes. Duros porque un soft-delete no libera espacio y
 * el punto de la retención es justamente que la tabla de eventos —la de mayor volumen
 * de la extensión— no crezca sin techo. Por lotes con un tope por corrida porque un
 * `DELETE` de millones de filas toma locks largos y en un contenedor de 1 vCPU eso se
 * ve como un incidente.
 *
 * Es idempotente y reentrante: si una corrida no alcanza a limpiar todo, la siguiente
 * sigue donde quedó.
 */

type KnexLike = {
  raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: unknown[]; rowCount?: number }>;
};

export type PurgeResult = {
  events_deleted: number;
  hourly_metrics_deleted: number;
  stale_relations_deleted: number;
  batches: number;
  /** `true` si se agotó el presupuesto de lotes y quedó trabajo pendiente. */
  truncated: boolean;
};

const rowsAffected = (result: { rows?: unknown[]; rowCount?: number }): number =>
  (result?.rows?.length ?? result?.rowCount ?? 0) as number;

/**
 * Borra en lotes hasta agotar o hasta el tope. Devuelve el total y si quedó cortado.
 *
 * El `DELETE ... WHERE id IN (SELECT ... LIMIT n)` es lo que acota el lock: sin el
 * subselect con LIMIT, Postgres tomaría el conjunto entero de una.
 *
 * `batchSize` viaja como PARÁMETRO y ya no se lee de un `const` de módulo: tiene que
 * ser el mismo número que va en el `LIMIT ?` del SQL, porque el corte por lote
 * incompleto se apoya en esa igualdad. Pasarlo explícito es lo que impide que un
 * cambio en la configuración desincronice las dos mitades de esa comparación.
 */
async function deleteInBatches(
  knex: KnexLike,
  sql: string,
  bindings: unknown[],
  budget: { remaining: number },
  batchSize: number,
): Promise<{ deleted: number; batches: number; truncated: boolean }> {
  let deleted = 0;
  let batches = 0;

  while (budget.remaining > 0) {
    const result = await knex.raw(sql, bindings);
    const affected = rowsAffected(result);
    batches++;
    budget.remaining--;
    deleted += affected;
    // Un lote incompleto significa que no queda nada más que borrar.
    if (affected < batchSize) return { deleted, batches, truncated: false };
  }

  return { deleted, batches, truncated: true };
}

export async function purgeRecommendationData(container: MedusaContainer): Promise<PurgeResult> {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as unknown as KnexLike;
  const config = await getRecommendationsConfig(container);
  // Se resuelven UNA vez por corrida y no por lote: si alguien guarda un tamaño de
  // lote distinto mientras la purga está corriendo, cambiarlo a mitad de camino
  // rompería el corte por lote incompleto (`affected < batchSize`) y la purga
  // seguiría pidiendo lotes al vacío hasta agotar el presupuesto.
  const { purgeBatch, purgeMaxBatches } = getRecommendationsSettings();
  const budget = { remaining: purgeMaxBatches };

  // 1. Eventos crudos vencidos.
  const events = await deleteInBatches(
    knex,
    `delete from "recommendation_event"
     where id in (
       select id from "recommendation_event"
       where occurred_at < now() - (? || ' days')::interval
       limit ?
     )`,
    [config.event_retention_days, purgeBatch],
    budget,
    purgeBatch,
  );

  // 2. Métricas horarias vencidas. Las DIARIAS no se purgan nunca: son el histórico
  //    de largo plazo y ocupan poco.
  const hourly = await deleteInBatches(
    knex,
    `delete from "recommendation_metric"
     where id in (
       select id from "recommendation_metric"
       where bucket = 'hourly'
         and period_start < now() - (? || ' days')::interval
       limit ?
     )`,
    [config.hourly_metric_retention_days, purgeBatch],
    budget,
    purgeBatch,
  );

  // 3. Relaciones de versiones viejas. Cada build de similares escribe una generación
  //    completa del catálogo, así que sin esto la tabla crece de forma lineal en el
  //    tiempo. Se conservan las últimas N versiones por estrategia (la activa
  //    incluida) para poder volver atrás.
  const relations = await deleteInBatches(
    knex,
    `delete from "recommendation_relation"
     where id in (
       select r.id
       from "recommendation_relation" r
       join (
         select id, strategy_key,
                row_number() over (partition by strategy_key order by created_at desc) as rn
         from "recommendation_version"
       ) v on v.id = r.version_id
       where r.version_id is not null
         and v.rn > ?
       limit ?
     )`,
    [config.keep_versions_per_strategy, purgeBatch],
    budget,
    purgeBatch,
  );

  return {
    events_deleted: events.deleted,
    hourly_metrics_deleted: hourly.deleted,
    stale_relations_deleted: relations.deleted,
    batches: events.batches + hourly.batches + relations.batches,
    truncated: events.truncated || hourly.truncated || relations.truncated,
  };
}

export const __testing = { deleteInBatches };
