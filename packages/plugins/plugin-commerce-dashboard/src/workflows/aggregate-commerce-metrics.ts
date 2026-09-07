import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowResponse,
} from '@medusajs/framework/workflows-sdk';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

export type AggregateCommerceMetricsInput = {
  from: string;
  to: string;
  bucket?: 'daily' | 'hourly';
  currency_code?: string;
};

const columnSet = async (knex: any, table: string): Promise<Set<string>> => {
  const rows = await knex('information_schema.columns')
    .select('column_name')
    .where({ table_schema: 'public', table_name: table });
  return new Set(rows.map((row: { column_name: string }) => row.column_name));
};

const aggregateCommerceMetricsStep = createStep(
  'aggregate-commerce-metrics',
  async (input: AggregateCommerceMetricsInput, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const knex: any = container.resolve('__pg_connection__');
    const bucket = input.bucket ?? 'daily';
    const grain = bucket === 'hourly' ? 'hour' : 'day';
    const interval = bucket === 'hourly' ? '1 hour' : '1 day';
    const from = new Date(input.from);
    const to = new Date(input.to);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new Error('Invalid aggregation date range');
    }
    if (!(await knex.schema.hasTable('order'))) {
      throw new Error('Cannot aggregate commerce metrics: order table not found');
    }

    // País (opcional): solo si hay order_address + shipping_address_id.
    const orderColumns = await columnSet(knex, 'order');
    const hasOrderAddress =
      (await knex.schema.hasTable('order_address')) &&
      orderColumns.has('shipping_address_id');
    const countryJoin = hasOrderAddress
      ? 'LEFT JOIN order_address a ON a.id = o.shipping_address_id'
      : '';
    const countryExpr = hasOrderAddress ? 'LOWER(a.country_code)' : 'NULL::text';

    // Totales reales de Medusa v2: viven en order_summary.totals (JSONB), tomando
    // el summary de mayor versión. Soporta number plano o BigNumber {value}.
    const totalExpr = (key: string) =>
      `COALESCE((os.totals->'${key}'->>'value')::numeric, (os.totals->>'${key}')::numeric, 0)`;

    // CTE de órdenes base, reutilizado por commerce y product.
    const baseOrdersCte = `
      base_orders AS (
        SELECT
          o.id AS order_id,
          o.version AS order_version,
          date_trunc(?, o.created_at) AS period_start,
          date_trunc(?, o.created_at) + (?::interval) AS period_end,
          NULLIF(o.sales_channel_id, '') AS sales_channel_id,
          ${countryExpr} AS country_code,
          LOWER(o.currency_code) AS currency_code,
          o.customer_id AS customer_id,
          ${totalExpr('current_order_total')} AS order_total,
          ${totalExpr('refunded_total')} AS refunded_total
        FROM "order" o
        LEFT JOIN LATERAL (
          SELECT s.totals
          FROM order_summary s
          WHERE s.order_id = o.id AND s.deleted_at IS NULL
          ORDER BY s.version DESC
          LIMIT 1
        ) os ON TRUE
        ${countryJoin}
        WHERE o.deleted_at IS NULL
          AND o.created_at >= ?
          AND o.created_at <= ?
          AND COALESCE(o.is_draft_order, FALSE) = FALSE
          AND (o.status IS NULL OR o.status::text NOT IN ('canceled', 'cancelled', 'draft'))
          AND (?::text IS NULL OR LOWER(o.currency_code) = LOWER(?::text))
      )`;
    // Params del CTE (en orden): grain, grain, interval, from, to, currency, currency.
    const baseParams = [grain, grain, interval, from, to, input.currency_code ?? null, input.currency_code ?? null];

    await knex.transaction(async (trx: any) => {
      for (const table of [
        'commerce_metrics_daily',
        'product_metrics_daily',
        'collection_metrics_daily',
        'customer_metrics_daily',
      ]) {
        await trx(table)
          .where('bucket', bucket)
          .where('period_start', '>=', from)
          .where('period_start', '<=', to)
          .delete();
      }

      // 1) PRODUCT primero (units_sold real desde order_item.quantity).
      await trx.raw(
        `
        WITH ${baseOrdersCte},
        items AS (
          SELECT
            bo.*,
            li.product_id AS product_id,
            li.product_title AS product_title,
            li.product_handle AS product_handle,
            COALESCE(oi.quantity::numeric, 0) AS quantity,
            (COALESCE(oi.quantity::numeric, 0) * COALESCE(li.unit_price::numeric, 0)) AS line_total
          FROM base_orders bo
          JOIN order_item oi
            ON oi.order_id = bo.order_id
           AND oi.version = bo.order_version
           AND oi.deleted_at IS NULL
          JOIN order_line_item li
            ON li.id = oi.item_id
           AND li.deleted_at IS NULL
        ),
        item_products AS (
          SELECT
            i.*,
            p.collection_id AS collection_id,
            col.title AS collection_title,
            pc.product_category_id AS category_id,
            cat.name AS category_name
          FROM items i
          LEFT JOIN product p ON p.id = i.product_id AND p.deleted_at IS NULL
          LEFT JOIN product_collection col ON col.id = p.collection_id
          LEFT JOIN LATERAL (
            SELECT pcp.product_category_id
            FROM product_category_product pcp
            WHERE pcp.product_id = i.product_id
            LIMIT 1
          ) pc ON TRUE
          LEFT JOIN product_category cat ON cat.id = pc.product_category_id
        )
        INSERT INTO product_metrics_daily (
          id, bucket, period_start, period_end, sales_channel_id, country_code, currency_code,
          product_id, product_title, product_handle, collection_id, collection_title, category_id, category_name,
          revenue, orders, units_sold, refunds, metadata, aggregated_at, created_at, updated_at
        )
        SELECT
          'pmd_' || md5(? || period_start::text || COALESCE(sales_channel_id, '') || COALESCE(country_code, '') || currency_code || product_id),
          ?, period_start, MIN(period_end), sales_channel_id, country_code, currency_code,
          product_id, MAX(product_title), MAX(product_handle), MAX(collection_id), MAX(collection_title), MAX(category_id), MAX(category_name),
          SUM(line_total), COUNT(DISTINCT order_id), SUM(quantity), 0,
          jsonb_build_object('source', 'aggregateCommerceMetricsWorkflow'),
          NOW(), NOW(), NOW()
        FROM item_products
        WHERE product_id IS NOT NULL
        GROUP BY period_start, sales_channel_id, country_code, currency_code, product_id
        `,
        [...baseParams, bucket, bucket],
      );

      // 2) COMMERCE (revenue/orders/refunds/customers). units_sold se completa en (3).
      await trx.raw(
        `
        WITH ${baseOrdersCte},
        customer_first_order AS (
          SELECT o.customer_id AS customer_id, MIN(o.created_at) AS first_order_at
          FROM "order" o
          WHERE o.deleted_at IS NULL
            AND o.customer_id IS NOT NULL
            AND COALESCE(o.is_draft_order, FALSE) = FALSE
            AND (o.status IS NULL OR o.status::text NOT IN ('canceled', 'cancelled', 'draft'))
          GROUP BY o.customer_id
        )
        INSERT INTO commerce_metrics_daily (
          id, bucket, period_start, period_end, sales_channel_id, country_code, currency_code,
          revenue, orders, aov, units_sold, new_customers, returning_customers, refunds,
          conversion_proxy, repeat_purchase_rate, metadata, aggregated_at, created_at, updated_at
        )
        SELECT
          'cmd_' || md5(? || period_start::text || COALESCE(sales_channel_id, '') || COALESCE(country_code, '') || currency_code),
          ?, period_start, MIN(period_end), sales_channel_id, country_code, currency_code,
          SUM(order_total),
          COUNT(DISTINCT order_id),
          CASE WHEN COUNT(DISTINCT order_id) > 0 THEN SUM(order_total) / COUNT(DISTINCT order_id) ELSE 0 END,
          0,
          COUNT(DISTINCT bo.customer_id) FILTER (WHERE cfo.first_order_at >= period_start AND cfo.first_order_at < period_end),
          COUNT(DISTINCT bo.customer_id) FILTER (WHERE cfo.first_order_at < period_start),
          SUM(refunded_total),
          COUNT(DISTINCT order_id),
          CASE
            WHEN COUNT(DISTINCT bo.customer_id) > 0
              THEN COUNT(DISTINCT bo.customer_id) FILTER (WHERE cfo.first_order_at < period_start)::numeric / COUNT(DISTINCT bo.customer_id)
            ELSE 0
          END,
          jsonb_build_object('source', 'aggregateCommerceMetricsWorkflow', 'future', jsonb_build_object('ai_insights', false, 'forecasting', false, 'campaign_attribution', false)),
          NOW(), NOW(), NOW()
        FROM base_orders bo
        LEFT JOIN customer_first_order cfo ON cfo.customer_id = bo.customer_id
        GROUP BY period_start, sales_channel_id, country_code, currency_code
        `,
        [...baseParams, bucket, bucket],
      );

      // 3) Completar units_sold de commerce desde product_metrics (ya insertado).
      await trx.raw(
        `
        UPDATE commerce_metrics_daily cmd
        SET units_sold = p.units_sold, updated_at = NOW()
        FROM (
          SELECT bucket, period_start, sales_channel_id, country_code, currency_code, SUM(units_sold) AS units_sold
          FROM product_metrics_daily
          WHERE bucket = ? AND period_start >= ? AND period_start <= ? AND deleted_at IS NULL
          GROUP BY bucket, period_start, sales_channel_id, country_code, currency_code
        ) p
        WHERE cmd.bucket = p.bucket
          AND cmd.period_start = p.period_start
          AND COALESCE(cmd.sales_channel_id, '') = COALESCE(p.sales_channel_id, '')
          AND COALESCE(cmd.country_code, '') = COALESCE(p.country_code, '')
          AND cmd.currency_code = p.currency_code
          AND cmd.deleted_at IS NULL
        `,
        [bucket, from, to],
      );

      // 4) COLLECTION (derivado de product_metrics).
      await trx.raw(
        `
        INSERT INTO collection_metrics_daily (
          id, bucket, period_start, period_end, sales_channel_id, country_code, currency_code,
          collection_id, collection_title, category_id, category_name,
          revenue, orders, units_sold, refunds, metadata, aggregated_at, created_at, updated_at
        )
        SELECT
          'colmd_' || md5(bucket || period_start::text || COALESCE(sales_channel_id, '') || COALESCE(country_code, '') || currency_code || COALESCE(collection_id, '') || COALESCE(category_id, '')),
          bucket, period_start, MIN(period_end), sales_channel_id, country_code, currency_code,
          collection_id, MAX(collection_title), category_id, MAX(category_name),
          SUM(revenue), SUM(orders), SUM(units_sold), SUM(refunds),
          jsonb_build_object('source', 'aggregateCommerceMetricsWorkflow'),
          NOW(), NOW(), NOW()
        FROM product_metrics_daily
        WHERE bucket = ? AND period_start >= ? AND period_start <= ? AND deleted_at IS NULL
        GROUP BY bucket, period_start, sales_channel_id, country_code, currency_code, collection_id, category_id
        `,
        [bucket, from, to],
      );

      // 5) CUSTOMER (derivado de commerce_metrics).
      await trx.raw(
        `
        INSERT INTO customer_metrics_daily (
          id, bucket, period_start, period_end, sales_channel_id, country_code, currency_code,
          new_customers, returning_customers, customers_with_orders, repeat_customers, repeat_purchase_rate,
          metadata, aggregated_at, created_at, updated_at
        )
        SELECT
          'cumd_' || md5(bucket || period_start::text || COALESCE(sales_channel_id, '') || COALESCE(country_code, '') || currency_code),
          bucket, period_start, period_end, sales_channel_id, country_code, currency_code,
          new_customers, returning_customers, new_customers + returning_customers, returning_customers, repeat_purchase_rate,
          jsonb_build_object('source', 'aggregateCommerceMetricsWorkflow'),
          NOW(), NOW(), NOW()
        FROM commerce_metrics_daily
        WHERE bucket = ? AND period_start >= ? AND period_start <= ? AND deleted_at IS NULL
        `,
        [bucket, from, to],
      );
    });

    logger.info(
      `[commerce-dashboard] aggregated ${bucket} snapshots from ${input.from} to ${input.to}`,
    );
    return new StepResponse({ from: input.from, to: input.to, bucket });
  },
);

export const aggregateCommerceMetricsWorkflow = createWorkflow(
  'aggregate-commerce-metrics',
  (input: AggregateCommerceMetricsInput) => {
    const result = aggregateCommerceMetricsStep(input);
    return new WorkflowResponse(result);
  },
);
