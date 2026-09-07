import { model } from '@medusajs/framework/utils';

/**
 * Auditoría de una suscripción (activity log, paridad con reorder-js): quién
 * hizo qué y cuándo. Se escribe best-effort desde rutas store/admin, workflows,
 * job y subscriber — nunca bloquea la operación que la origina.
 */
export const RecurringLog = model
  .define('recurring_log', {
    id: model.id({ prefix: 'rlog' }).primaryKey(),
    recurring_order_id: model.text(),
    // created | paused | resumed | cancelled | skip_set | frequency_changed |
    // address_changed | items_changed | cycle_pending_payment | cycle_success |
    // cycle_failed | cycle_expired | cycle_skipped | cycle_forced |
    // retention_accepted | notification_sent | ...
    event: model.text(),
    actor_type: model.text().default('system'), // customer | admin | system
    actor_id: model.text().nullable(),
    source: model.text().default('internal'),
    correlation_id: model.text().nullable(),
    before_state: model.json().nullable(),
    after_state: model.json().nullable(),
    external_reference: model.text().nullable(),
    // Contexto del evento (reason, cycle_id, order_id, cambios, template, etc).
    data: model.json().nullable(),
  })
  .indexes([{ on: ['recurring_order_id'] }, { on: ['event'] }]);

export default RecurringLog;
