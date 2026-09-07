import { model } from '@medusajs/framework/utils';
import { RecurringOrderItem } from './recurring-order-item';
import { RenewalCycle } from './renewal-cycle';

/**
 * Suscripción de reposición de un cliente: qué items, con qué frecuencia, a qué
 * dirección y cómo se cobra. Guarda snapshots (dirección, precios informativos)
 * pero cada renovación relee stock/precios/promos en vivo armando un carrito
 * real del canal. `next_execution_at` es informativo/consultable; la agenda
 * operativa vive en los `renewal_cycle`.
 */
export const RecurringOrder = model
  .define('recurring_order', {
    id: model.id({ prefix: 'rord' }).primaryKey(),
    customer_id: model.text(),
    email: model.text().nullable(),
    phone: model.text().nullable(),
    // Scoping multi-tenant: el carrito de renovación se crea en este canal.
    sales_channel_id: model.text(),
    region_id: model.text().nullable(),
    country_code: model.text().nullable(),
    currency_code: model.text().nullable(),
    status: model.text().default('active'),
    plan_id: model.text().nullable(),
    plan_version: model.number().nullable(),
    offer_id: model.text().nullable(),
    plan_snapshot: model.json().nullable(),
    // Cómo se resuelve el cobro de cada renovación (ver payment/types.ts).
    payment_mode: model.text().default('manual_link'),
    // Datos del medio de pago para modos automáticos (Fase 2: preapproval_id, etc).
    payment_context: model.json().nullable(),
    payment_provider: model.text().default('manual'),
    external_subscription_id: model.text().nullable(),
    financial_status: model.text().default('manual'),
    next_billing_at: model.dateTime().nullable(),
    cycles_completed: model.number().default(0),
    terms_accepted_at: model.dateTime().nullable(),
    terms_version: model.text().nullable(),
    provider_state: model.json().nullable(),
    frequency_interval: model.text(),
    frequency_count: model.number().default(1),
    next_execution_at: model.dateTime().nullable(),
    last_execution_at: model.dateTime().nullable(),
    paused_at: model.dateTime().nullable(),
    cancelled_at: model.dateTime().nullable(),
    // El próximo ciclo se saltea (una sola vez); lo consume el scheduler.
    skip_next_cycle: model.boolean().default(false),
    // Ciclos fallidos/expirados seguidos; al superar el máximo la suscripción cae a `failed`.
    consecutive_failures: model.number().default(0),
    shipping_address: model.json(),
    billing_address: model.json().nullable(),
    // Opción de envío preferida; si ya no está disponible se usa la más barata.
    shipping_option_id: model.text().nullable(),
    // `origin` ('pdp'|'cart'), políticas futuras, etc.
    metadata: model.json().nullable(),
    items: model.hasMany(() => RecurringOrderItem, { mappedBy: 'recurring_order' }),
    cycles: model.hasMany(() => RenewalCycle, { mappedBy: 'recurring_order' }),
  })
  .indexes([
    { on: ['customer_id'] },
    { on: ['status'] },
    { on: ['sales_channel_id'] },
    { on: ['next_execution_at'] },
    { on: ['plan_id'] },
    { on: ['external_subscription_id'] },
    { on: ['financial_status'] },
  ]);

export default RecurringOrder;
