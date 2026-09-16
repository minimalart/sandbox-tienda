import type { ErpOutboxStatus } from '../types';

/**
 * ¿Se puede volver a mandar esta venta al ERP?
 *
 * Decisión PURA (testeable sin container) que separa "reintentar" de
 * "resincronizar", que NO son lo mismo:
 *
 * - **Reintentar** era lo único que existía (`requeueOutboxEvent`): sólo
 *   `failed`/`dead_letter`, y reusaba el payload guardado.
 * - **Resincronizar** vuelve a ARMAR el payload desde la orden y encola. Es la
 *   única forma de recuperar una fila `skipped`, porque el payload de un
 *   `skipped` no es una venta: es `{ reason: 'sales_notify_disabled' }`.
 *
 * Y `skipped` es justamente el estado que dejaba ventas muertas para siempre:
 * `enqueueSaleForOrder` corta ante CUALQUIER fila con el mismo `event_key`, así
 * que una orden que entró con la notificación apagada no la vuelve a encolar
 * nadie — ni prender el toggle después, ni el cron, ni el retry manual. Medido
 * en desdeelsur el 2026-09-09: 16 de 16 filas del outbox en `skipped` con
 * `reason: sales_notify_disabled`, cero enviadas, y `sales_notify_enabled` ya
 * en `true`. Esas 16 ventas no iban a llegar a Zeus nunca.
 *
 * Los dos estados que exigen `force` lo exigen por la misma razón, y no es
 * cosmética: **el ERP puede facturar dos veces**. Zeus deduplica por
 * `id_ecommerce` y devuelve 409 (`duplicate`), pero Bsale y Contabilium NO
 * tienen idempotencia real, así que reenviar un `sent` ahí emite el comprobante
 * de nuevo. Por eso el default es no tocarlos y el `force` es una decisión
 * explícita de quien mira el ERP del otro lado.
 */

export type ResyncOutcome =
  /** Se rearma el payload y la fila vuelve a `pending`. */
  | { action: 'requeue'; reason: ResyncRequeueReason }
  /** No se toca. `reason` es lo que se le muestra al operador. */
  | { action: 'noop'; reason: ResyncNoopReason };

export type ResyncRequeueReason =
  /** Quedó salteada (notificación apagada cuando entró la venta). */
  | 'skipped'
  /** Falló y está esperando reintento automático; se adelanta. */
  | 'failed'
  /** Agotó los reintentos. */
  | 'dead_letter'
  /** Ya estaba en el ERP, y alguien pidió mandarla igual. */
  | 'forced_sent'
  | 'forced_duplicate';

export type ResyncNoopReason =
  /** Ya está en la cola esperando al processor. */
  | 'already_pending'
  /** El processor la tiene tomada en este momento. */
  | 'in_flight'
  /** Ya se envió; hace falta `force`. */
  | 'already_sent'
  /** El ERP dijo que ya la tenía; hace falta `force`. */
  | 'already_duplicate';

export function decideResync(input: {
  /** Estado actual de la fila, o `null` si la orden no tiene fila en el outbox. */
  status: ErpOutboxStatus | null;
  /** El operador aceptó el riesgo de reenviar algo ya enviado. */
  force: boolean;
}): ResyncOutcome {
  const { status, force } = input;

  // Sin fila: la venta nunca se encoló (el subscriber no corrió, o la orden es
  // anterior a la instalación del ERP). Encolar es exactamente lo que hay que
  // hacer, y no necesita `force`: no hay nada en el ERP que se pueda duplicar.
  if (status === null) return { action: 'requeue', reason: 'skipped' };

  switch (status) {
    case 'skipped':
      return { action: 'requeue', reason: 'skipped' };
    case 'failed':
      return { action: 'requeue', reason: 'failed' };
    case 'dead_letter':
      return { action: 'requeue', reason: 'dead_letter' };

    // `pending`/`processing` NO son un error del que haya que recuperarse: la
    // venta ya está en camino. Reencolar un `processing` es peor que no hacer
    // nada — le saca la fila de abajo al processor que la está enviando y puede
    // terminar en dos POST al ERP.
    case 'pending':
      return { action: 'noop', reason: 'already_pending' };
    case 'processing':
      return { action: 'noop', reason: 'in_flight' };

    case 'sent':
      return force
        ? { action: 'requeue', reason: 'forced_sent' }
        : { action: 'noop', reason: 'already_sent' };
    case 'duplicate':
      return force
        ? { action: 'requeue', reason: 'forced_duplicate' }
        : { action: 'noop', reason: 'already_duplicate' };
  }
}

/**
 * Estados que la acción MASIVA barre por default.
 *
 * `skipped` está adentro y es el punto de todo esto. `sent`/`duplicate` quedan
 * afuera a propósito: una acción masiva no puede ser la que refacture el mes.
 */
export const RESYNC_BULK_STATUSES: readonly ErpOutboxStatus[] = [
  'skipped',
  'failed',
  'dead_letter',
] as const;

/** ¿Este estado lo barre la acción masiva sin `force`? */
export function isBulkResyncable(status: ErpOutboxStatus): boolean {
  return RESYNC_BULK_STATUSES.includes(status);
}
