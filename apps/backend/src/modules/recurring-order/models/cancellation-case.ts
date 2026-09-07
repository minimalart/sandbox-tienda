import { model } from '@medusajs/framework/utils';

/**
 * Caso de cancelación (paridad con Cancellation & Retention de reorder-js):
 * la cancelación deja de ser un botón directo y registra motivo + desenlace.
 *
 * `status`:
 * - `requested` → el cliente inició la cancelación (eligió motivo).
 * - `retained`  → aceptó una oferta de retención (descuento próximas entregas).
 * - `paused`    → prefirió pausar en lugar de cancelar.
 * - `skipped`   → prefirió omitir la próxima entrega.
 * - `cancelled` → canceló definitivamente.
 */
export const CancellationCase = model
  .define('cancellation_case', {
    id: model.id({ prefix: 'rcase' }).primaryKey(),
    recurring_order_id: model.text(),
    status: model.text().default('requested'),
    // precio | no_lo_necesito | problemas_entrega | otro
    reason: model.text().nullable(),
    reason_note: model.text().nullable(),
    // Oferta aceptada: {percentage, cycles} (null si no aceptó ninguna).
    retention_offer: model.json().nullable(),
    decided_at: model.dateTime().nullable(),
    metadata: model.json().nullable(),
  })
  .indexes([{ on: ['recurring_order_id'] }, { on: ['status'] }, { on: ['reason'] }]);

export default CancellationCase;
