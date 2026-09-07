import { model } from '@medusajs/framework/utils';

export const CommerceMetricsDaily = model
  .define('commerce_metrics_daily', {
    id: model.id({ prefix: 'cmd' }).primaryKey(),
    bucket: model.text().default('daily'),
    period_start: model.dateTime(),
    period_end: model.dateTime(),
    sales_channel_id: model.text().nullable(),
    country_code: model.text().nullable(),
    currency_code: model.text(),
    revenue: model.number().default(0),
    orders: model.number().default(0),
    aov: model.number().default(0),
    units_sold: model.number().default(0),
    new_customers: model.number().default(0),
    returning_customers: model.number().default(0),
    refunds: model.number().default(0),
    conversion_proxy: model.number().default(0),
    repeat_purchase_rate: model.number().default(0),
    metadata: model.json().nullable(),
    aggregated_at: model.dateTime(),
  })
  .indexes([
    { on: ['bucket', 'period_start'] },
    { on: ['sales_channel_id', 'period_start'] },
    { on: ['country_code', 'period_start'] },
    { on: ['currency_code', 'period_start'] },
  ]);
