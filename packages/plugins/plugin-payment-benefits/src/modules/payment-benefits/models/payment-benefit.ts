import { model } from '@medusajs/framework/utils';

/**
 * Beneficio de pago curado. Puede ser MANUAL (editable) o SINCRONIZADO desde un
 * proveedor (read_only=true → los campos oficiales no se editan, solo
 * visibilidad/prioridad/notas/canales).
 *
 * Nunca toca el precio del producto: es informativo (PRD §14).
 * `eligibility` y `conditions` van como JSON para no explotar en tablas/joins.
 * `sales_channel_ids` scopea por demo (patrón banner/brand): vacío = todos.
 */
export const PaymentBenefit = model
  .define('payment_benefit', {
    id: model.id({ prefix: 'pbnf' }).primaryKey(),
    provider_code: model.text().default('manual'),
    external_id: model.text().nullable(),
    title: model.text(),
    description: model.text().nullable(),
    // 'installments' | 'percentage_discount' | 'fixed_discount' | 'refund' | 'cashback' | 'custom'
    benefit_type: model.text().default('custom'),
    // Campos numéricos del beneficio (todos opcionales según el tipo).
    discount_type: model.text().nullable(),
    discount_value: model.number().nullable(),
    max_installments: model.number().nullable(),
    interest_rate: model.number().nullable(),
    max_refund: model.number().nullable(),
    minimum_amount: model.number().nullable(),
    maximum_amount: model.number().nullable(),
    // 'manual' | 'mercadopago' | ...
    source: model.text().default('manual'),
    // Los beneficios sincronizados son de solo lectura en sus campos oficiales.
    read_only: model.boolean().default(false),
    // 'draft' | 'scheduled' | 'active' | 'expired' | 'disabled' | 'sync_error'
    status: model.text().default('draft'),
    priority: model.number().default(0),
    valid_from: model.dateTime().nullable(),
    valid_to: model.dateTime().nullable(),
    // { scope, ids[] }
    eligibility: model.json().nullable(),
    // { card_brand?, issuer?, payment_method?, wallet?, country?, currency? }
    conditions: model.json().nullable(),
    // string[] — vacío/null = todos los canales.
    sales_channel_ids: model.json().nullable(),
    // Observación editable por el admin aun en beneficios read-only.
    admin_notes: model.text().nullable(),
    // El admin puede ocultar un beneficio (incluso sincronizado) sin borrarlo.
    hidden: model.boolean().default(false),
    last_synced_at: model.dateTime().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([
    { on: ['status'] },
    { on: ['provider_code'] },
    { on: ['benefit_type'] },
  ]);

export default PaymentBenefit;
