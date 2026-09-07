import { model } from '@medusajs/framework/utils';

export const CollectionMetricsDaily = model
  .define('collection_metrics_daily', {
    id: model.id({ prefix: 'colmd' }).primaryKey(),
    bucket: model.text().default('daily'),
    period_start: model.dateTime(),
    period_end: model.dateTime(),
    sales_channel_id: model.text().nullable(),
    country_code: model.text().nullable(),
    currency_code: model.text(),
    collection_id: model.text().nullable(),
    collection_title: model.text().nullable(),
    category_id: model.text().nullable(),
    category_name: model.text().nullable(),
    revenue: model.number().default(0),
    orders: model.number().default(0),
    units_sold: model.number().default(0),
    refunds: model.number().default(0),
    metadata: model.json().nullable(),
    aggregated_at: model.dateTime(),
  })
  .indexes([
    { on: ['bucket', 'period_start'] },
    { on: ['collection_id', 'period_start'] },
    { on: ['category_id', 'period_start'] },
    { on: ['sales_channel_id', 'period_start'] },
    { on: ['currency_code', 'period_start'] },
  ]);
