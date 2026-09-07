import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';

/**
 * Rollup de eventos a métricas (PRD §13.4/§11.6).
 *
 * Delete-then-insert por período dentro de UNA transacción, con ids deterministas por
 * md5 de la tupla de dimensiones — mismo patrón que
 * `workflows/aggregate-commerce-metrics.ts`. Eso lo hace IDEMPOTENTE: recorrer una
 * ventana rodante recalcula los períodos recientes, así que una cancelación o un evento
 * que llegó tarde se autocorrige sin lógica de reconciliación aparte.
 *
 * Los ratios (CTR, conversión, ticket promedio) NO se guardan: se calculan al leer.
 * Guardar un promedio de promedios es la forma clásica de reportar números que no cierran
 * cuando el usuario filtra.
 */

type KnexLike = {
  transaction: <T>(handler: (trx: TrxLike) => Promise<T>) => Promise<T>;
};
type TrxLike = {
  raw: (sql: string, bindings?: unknown[]) => Promise<{ rows?: unknown[]; rowCount?: number }>;
};

export type AggregateInput = {
  bucket: 'hourly' | 'daily';
  from: Date;
  to: Date;
};

export type AggregateResult = {
  bucket: string;
  periods_deleted: number;
  rows_inserted: number;
};

/**
 * SQL del rollup.
 *
 * Detalle que importa: `influenced_orders` e `influenced_order_revenue` salen de un CTE
 * que DEDUPLICA a una fila por (período, dimensiones, orden) antes de sumar. Sin eso, una
 * orden con tres productos recomendados se contaría tres veces y el ticket promedio de
 * órdenes influenciadas saldría dividido por tres.
 */
const buildAggregateSql = (bucket: 'hourly' | 'daily'): string => {
  const truncUnit = bucket === 'hourly' ? 'hour' : 'day';
  return `
    with scoped as (
      select
        date_trunc('${truncUnit}', occurred_at) as period_start,
        placement, strategy_key, resolved_strategy_key, sales_channel_id, currency_code,
        event, product_id, order_id, quantity, revenue, attribution, served_product_ids,
        metadata
      from "recommendation_event"
      where deleted_at is null
        and voided_at is null
        and occurred_at >= ?
        and occurred_at < ?
    ),
    -- Una fila por (período, dimensiones, orden) para no contar la misma orden tantas
    -- veces como productos recomendados tenga.
    influenced as (
      select period_start, placement, strategy_key, resolved_strategy_key, sales_channel_id,
             currency_code, order_id,
             max((metadata->>'order_total')::numeric) as order_total
      from scoped
      where event = 'recommendation_purchased' and order_id is not null
      group by 1,2,3,4,5,6,7
    ),
    influenced_totals as (
      select period_start, placement, strategy_key, resolved_strategy_key, sales_channel_id,
             currency_code,
             count(*)::int as influenced_orders,
             coalesce(sum(order_total), 0) as influenced_order_revenue
      from influenced
      group by 1,2,3,4,5,6
    ),
    funnel as (
      select period_start, placement, strategy_key, resolved_strategy_key, sales_channel_id,
             currency_code,
             count(*) filter (where event = 'recommendation_served')::int as served,
             coalesce(sum(jsonb_array_length(served_product_ids)) filter (where event = 'recommendation_served'), 0)::int as served_items,
             count(*) filter (where event = 'recommendation_viewed')::int as viewed,
             count(*) filter (where event = 'recommendation_clicked')::int as clicked,
             count(*) filter (where event = 'recommendation_added_to_cart')::int as added_to_cart,
             count(*) filter (where event = 'recommendation_purchased')::int as purchased,
             coalesce(sum(quantity) filter (where event = 'recommendation_purchased'), 0)::int as units_purchased,
             coalesce(sum(revenue) filter (where event = 'recommendation_purchased' and attribution = 'direct'), 0) as attributed_revenue,
             coalesce(sum(revenue) filter (where event = 'recommendation_purchased' and attribution = 'assisted'), 0) as assisted_revenue
      from scoped
      group by 1,2,3,4,5,6
    )
    insert into "recommendation_metric" (
      id, bucket, period_start, period_end, placement, strategy_key, resolved_strategy_key,
      sales_channel_id, currency_code, served, served_items, viewed, clicked, added_to_cart,
      purchased, units_purchased, attributed_revenue, assisted_revenue, influenced_orders,
      influenced_order_revenue, aggregated_at, created_at, updated_at
    )
    select
      'recmet_' || md5(
        ? || f.period_start::text || coalesce(f.placement,'') || coalesce(f.strategy_key,'') ||
        coalesce(f.resolved_strategy_key,'') || coalesce(f.sales_channel_id,'') || coalesce(f.currency_code,'')
      ),
      ?,
      f.period_start,
      f.period_start + interval '1 ${truncUnit}',
      f.placement, f.strategy_key, f.resolved_strategy_key, f.sales_channel_id, f.currency_code,
      f.served, f.served_items, f.viewed, f.clicked, f.added_to_cart, f.purchased,
      f.units_purchased, f.attributed_revenue, f.assisted_revenue,
      coalesce(i.influenced_orders, 0), coalesce(i.influenced_order_revenue, 0),
      now(), now(), now()
    from funnel f
    left join influenced_totals i
      on i.period_start = f.period_start
      and coalesce(i.placement,'') = coalesce(f.placement,'')
      and coalesce(i.strategy_key,'') = coalesce(f.strategy_key,'')
      and coalesce(i.resolved_strategy_key,'') = coalesce(f.resolved_strategy_key,'')
      and coalesce(i.sales_channel_id,'') = coalesce(f.sales_channel_id,'')
      and coalesce(i.currency_code,'') = coalesce(f.currency_code,'')
    returning id
  `;
};

/** Recalcula las métricas de una ventana. Idempotente. */
export async function aggregateRecommendationMetrics(
  container: MedusaContainer,
  input: AggregateInput,
): Promise<AggregateResult> {
  const knex = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as unknown as KnexLike;

  return knex.transaction(async (trx) => {
    // Delete-then-insert: es lo que hace el recálculo idempotente. Se borra el rango
    // completo del bucket antes de reinsertarlo.
    const deleted = await trx.raw(
      `delete from "recommendation_metric"
       where bucket = ?
         and period_start >= ?
         and period_start < ?
       returning id`,
      [input.bucket, input.from, input.to],
    );

    const inserted = await trx.raw(buildAggregateSql(input.bucket), [
      input.from,
      input.to,
      input.bucket,
      input.bucket,
    ]);

    return {
      bucket: input.bucket,
      periods_deleted: (deleted?.rows ?? []).length,
      rows_inserted: (inserted?.rows ?? []).length,
    };
  });
}

export const __testing = { buildAggregateSql };
