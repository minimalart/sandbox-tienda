import { model } from '@medusajs/framework/utils';
import { DemoStore } from './demo-store';

/**
 * Tracks one product-import run for a demo store. The async import job updates
 * the counters as batches are created so the admin can poll progress; failures
 * are sampled into `error_log` (surfaced as a log in Fase 2).
 */
export const ImportJob = model.define('demo_import_job', {
  id: model.id({ prefix: 'imp' }).primaryKey(),
  source_type: model.enum(['woocommerce', 'vtex', 'shopify', 'sales_channel']),
  source_url: model.text(),
  target_count: model.number().nullable(),
  status: model.enum(['pending', 'running', 'completed', 'failed']).default('pending'),
  total_products: model.number().default(0),
  fetched_products: model.number().default(0),
  imported_products: model.number().default(0),
  linked_products: model.number().default(0),
  skipped_products: model.number().default(0),
  failed_products: model.number().default(0),
  duration_ms: model.number().default(0),
  error_log: model.json().nullable(),
  run_log: model.json().nullable(),
  started_at: model.dateTime().nullable(),
  finished_at: model.dateTime().nullable(),
  demo_store: model.belongsTo(() => DemoStore, { mappedBy: 'import_jobs' }),
});
