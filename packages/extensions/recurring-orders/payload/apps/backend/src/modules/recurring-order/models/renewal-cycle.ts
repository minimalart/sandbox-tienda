import { model } from '@medusajs/framework/utils';
import { RecurringOrder } from './recurring-order';
import { RenewalAttempt } from './renewal-attempt';

/**
 * Una ejecución programada de la suscripción. El scheduler toma ciclos
 * `scheduled`/`failed` vencidos con `processed_at IS NULL` (un `failed` con
 * `processed_at` seteado es terminal, ya no se reintenta). En `manual_link` el
 * ciclo queda en `pending_payment` con el carrito generado y expira a
 * `expires_at` si el cliente no confirma.
 */
export const RenewalCycle = model
  .define('renewal_cycle', {
    id: model.id({ prefix: 'rcyc' }).primaryKey(),
    recurring_order: model.belongsTo(() => RecurringOrder, { mappedBy: 'cycles' }),
    scheduled_at: model.dateTime(),
    // Cuándo terminó la ejecución (carrito generado / fallo terminal / skip).
    processed_at: model.dateTime().nullable(),
    status: model.text().default('scheduled'),
    // Carrito de renovación generado (modo manual_link).
    cart_id: model.text().nullable(),
    generated_order_id: model.text().nullable(),
    payment_status: model.text().nullable(),
    // Referencia del cobro para modos automáticos (Fase 2).
    payment_reference: model.text().nullable(),
    provider_payment_id: model.text().nullable(),
    idempotency_key: model.text().nullable(),
    expected_amount: model.bigNumber().nullable(),
    charged_amount: model.bigNumber().nullable(),
    quote_snapshot: model.json().nullable(),
    quote_hash: model.text().nullable(),
    inventory_reservation_ids: model.json().nullable(),
    forecasted_at: model.dateTime().nullable(),
    quoted_at: model.dateTime().nullable(),
    reserved_at: model.dateTime().nullable(),
    paid_at: model.dateTime().nullable(),
    refunded_at: model.dateTime().nullable(),
    order_created_at: model.dateTime().nullable(),
    retry_until: model.dateTime().nullable(),
    confirmation_url: model.text().nullable(),
    expires_at: model.dateTime().nullable(),
    reminder_sent_at: model.dateTime().nullable(),
    attempt_count: model.number().default(0),
    last_error: model.text().nullable(),
    // { skipped_items: [...], totals: {...} }
    metadata: model.json().nullable(),
    attempts: model.hasMany(() => RenewalAttempt, { mappedBy: 'renewal_cycle' }),
  })
  .indexes([
    { on: ['status', 'scheduled_at'] },
    { on: ['cart_id'] },
    { on: ['idempotency_key'] },
    { on: ['provider_payment_id'] },
  ]);

export default RenewalCycle;
