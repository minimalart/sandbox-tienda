import { model } from '@medusajs/framework/utils';

/**
 * BranchDelivery — per-branch delivery settings (one row per branch).
 *
 * Informational in V1: it does NOT replace Medusa shipping options (those stay
 * native, per stock location). It captures the branch's delivery windows and
 * lead time so the storefront can show "delivers in N hours" / available days.
 *
 * - `timezone`: IANA tz (e.g. 'America/Argentina/Buenos_Aires').
 * - `lead_time_hours`: hours from order to dispatch/delivery.
 * - `schedules`: delivery windows, reusing the BusinessHours shape produced by
 *   the admin BusinessHoursEditor, plus an optional per-day cap:
 *   Record<day, { closed: boolean; is24Hours: boolean; slots: { open; close }[]; maxPerDay?: number | null }>.
 *   `maxPerDay` is the max deliveries the branch takes that day (informational
 *   in V1; checkout-time enforcement is not wired yet).
 */
export const BranchDelivery = model
  .define('branch_delivery', {
    id: model.id({ prefix: 'bdel' }).primaryKey(),
    store_location_id: model.text(),
    timezone: model.text().nullable(),
    lead_time_hours: model.number().nullable(),
    active: model.boolean().default(true),
    schedules: model.json().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([{ on: ['store_location_id'] }]);

export default BranchDelivery;
