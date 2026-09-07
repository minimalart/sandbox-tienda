import { model } from '@medusajs/framework/utils';

/**
 * BranchCoverage — a delivery/coverage polygon owned by a branch (StoreLocation).
 *
 * Decoupled from Medusa fulfillment: coverage answers "which branch (and thus
 * which sales channel) serves this lat/lng", not "what shipping options apply".
 * Shipping options stay native, configured per stock location.
 *
 * - `polygon`: PolygonPoint[] — `[{ x: lng, y: lat }]` as strings (AEC format).
 * - `priority`: higher wins when a point falls in overlapping coverages.
 * - `active`: only active coverages participate in resolution.
 */
export const BranchCoverage = model
  .define('branch_coverage', {
    id: model.id({ prefix: 'bcov' }).primaryKey(),
    store_location_id: model.text(),
    name: model.text(),
    polygon: model.json(),
    priority: model.number().default(0),
    active: model.boolean().default(true),
  })
  .indexes([
    { on: ['store_location_id'] },
    { on: ['active', 'deleted_at'] },
  ]);

export default BranchCoverage;
