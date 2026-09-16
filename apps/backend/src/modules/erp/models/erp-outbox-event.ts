import { model } from '@medusajs/framework/utils';

/**
 * ErpOutboxEvent — outbox de eventos hacia el ERP (hoy: `sale_created`).
 * `event_key` es la clave idempotente (`sale_created:{provider}:{order_id}`):
 * el unique parcial garantiza una sola notificación por orden aunque el
 * evento de captura llegue N veces. El processor (job cron) toma los
 * `pending|failed` vencidos y aplica backoff hasta `dead_letter`.
 */
export const ErpOutboxEvent = model
  .define('erp_outbox_event', {
    id: model.id({ prefix: 'erpobx' }).primaryKey(),
    event_type: model.text(),
    event_key: model.text(),
    aggregate_type: model.text().default('order'),
    aggregate_id: model.text(),
    provider: model.text(),
    payload: model.json().nullable(),
    status: model
      .enum(['pending', 'processing', 'sent', 'failed', 'dead_letter', 'skipped', 'duplicate'])
      .default('pending'),
    attempts: model.number().default(0),
    next_retry_at: model.dateTime().nullable(),
    claimed_at: model.dateTime().nullable(),
    sent_at: model.dateTime().nullable(),
    external_ref: model.text().nullable(),
    last_error: model.text().nullable(),
    /**
     * El documento TAL CUAL se envió al ERP (en Zeus, el body de
     * `POST /pedidos`). `payload` guarda la INTENCIÓN — qué se vendió — pero los
     * parámetros fiscales (sucursal, depósito, punto de venta, condición de
     * venta, tipo de comprobante) salen de la config recién al enviar, así que
     * sin esta columna no hay forma de saber con qué se emitió un comprobante
     * viejo si la config cambió después.
     */
    request_payload: model.json().nullable(),
    response_payload: model.json().nullable(),
  })
  .indexes([
    { on: ['event_key'], unique: true, where: 'deleted_at IS NULL' },
    { on: ['status', 'next_retry_at'] },
    { on: ['aggregate_id'] },
  ]);
