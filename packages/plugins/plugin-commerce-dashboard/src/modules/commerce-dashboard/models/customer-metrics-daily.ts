import { model } from '@medusajs/framework/utils';

export const CustomerMetricsDaily = model
  .define('customer_metrics_daily', {
    id: model.id({ prefix: 'cumd' }).primaryKey(),
    bucket: model.text().default('daily'),
    period_start: model.dateTime(),
    period_end: model.dateTime(),
    sales_channel_id: model.text().nullable(),
    country_code: model.text().nullable(),
    currency_code: model.text(),
    new_customers: model.number().default(0),
    returning_customers: model.number().default(0),
    customers_with_orders: model.number().default(0),
    repeat_customers: model.number().default(0),
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
