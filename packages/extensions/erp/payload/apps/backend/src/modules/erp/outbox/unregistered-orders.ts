import type { ErpSalesTrigger } from '../types';

/**
 * Órdenes que YA deberían estar notificadas al ERP y no tienen ni una fila en
 * el outbox.
 *
 * Es el agujero que dejó el reenvío por estado: `resync` barre las filas
 * existentes (`skipped`/`failed`/`dead_letter`), así que una orden que NUNCA se
 * encoló es invisible para el panel de Ventas. Y no es un caso teórico — es el
 * más caro de los dos:
 *
 * Medido en desdeelsur el 2026-09-10, cruzando `/admin/orders` contra
 * `/admin/erp/outbox-events`: 30 órdenes, 16 filas, y de las 14 sin fila **9
 * tenían el pago capturado**. Todas posteriores al 2026-09-09T18:27:38Z, que es
 * el mismo segundo en que se cortó el último `order-confirmation` de
 * `/admin/notifications`: el event bus se murió y el subscriber de
 * `payment.captured` dejó de correr. Ni mail al comprador, ni venta al ERP, y
 * los crons siguieron andando como si nada.
 *
 * Con el bus caído la ausencia NO deja rastro: no hay fila `pending`, no hay
 * `failed`, no hay error en ningún log del ERP. **Ausencia de fila no es
 * "notificación apagada": puede ser que el evento nunca llegó.** Por eso esto se
 * calcula desde las ÓRDENES y no desde el outbox.
 *
 * Las otras 5 sin fila estaban en `authorized`, y ahí la ausencia es CORRECTA:
 * el trigger es el pago capturado. Ese es justo el falso positivo que este
 * módulo tiene que evitar — una pantalla que ofrezca "encolar" una orden sin
 * cobrar invita a facturar lo que todavía no se pagó.
 */

/** Lo que se necesita saber de una orden para decidir. */
export type OrderEligibilityInput = {
  id: string;
  /** `order.status` de Medusa. */
  status?: string | null;
  /** `order.payment_status` de Medusa. */
  payment_status?: string | null;
  /** `order.fulfillment_status` de Medusa. */
  fulfillment_status?: string | null;
};

export type UnregisteredReason =
  /** Elegible: le corresponde estar notificada y no hay fila. */
  | 'eligible'
  /** La orden está cancelada. */
  | 'order_canceled'
  /** El pago no está capturado (trigger `payment_captured`). */
  | 'not_captured'
  /** No hay fulfillment confirmado (trigger `fulfillment_created`). */
  | 'not_fulfilled';

/**
 * Estados de `payment_status` que cuentan como cobrado.
 *
 * `partially_captured` entra porque el subscriber se dispara con
 * `payment.captured` sin mirar el monto: si una captura parcial encoló la venta
 * cuando el bus estaba vivo, la misma orden tiene que poder recuperarse cuando
 * no lo estaba. Dejarla afuera haría que el panel muestre un universo distinto
 * al que el trigger produce, que es la clase de divergencia que originó todo
 * esto.
 */
const CAPTURED_STATUSES = new Set(['captured', 'partially_captured']);

/** `fulfillment_status` que implica que un humano confirmó el despacho. */
const FULFILLED_STATUSES = new Set([
  'fulfilled',
  'partially_fulfilled',
  'shipped',
  'partially_shipped',
  'delivered',
  'partially_delivered',
]);

/**
 * ¿Esta orden debería tener fila en el outbox?
 *
 * Respeta el trigger CONFIGURADO. Con `fulfillment_created` una orden cobrada y
 * sin despachar no está atrasada: está esperando que alguien confirme el
 * depósito, y ofrecer encolarla saltearía el gate de facturación.
 */
export function classifyUnregisteredOrder(
  order: OrderEligibilityInput,
  trigger: ErpSalesTrigger
): UnregisteredReason {
  if (order.status === 'canceled') return 'order_canceled';

  if (trigger === 'fulfillment_created') {
    return FULFILLED_STATUSES.has(order.fulfillment_status ?? '') ? 'eligible' : 'not_fulfilled';
  }

  return CAPTURED_STATUSES.has(order.payment_status ?? '') ? 'eligible' : 'not_captured';
}

export type UnregisteredOrder = {
  order_id: string;
  display_id?: number | null;
  created_at?: string | null;
  payment_status?: string | null;
  fulfillment_status?: string | null;
  total?: number | null;
};

/**
 * Filtra las órdenes elegibles que no tienen fila, y cuenta por qué se
 * descartó cada una de las otras.
 *
 * `existingOrderIds` son los `aggregate_id` de las filas `sale_created` que ya
 * existen — de cualquier estado. Una orden con fila NO entra acá aunque esté
 * `skipped`: ese caso ya lo cubre el reenvío por estado, y mostrarla en las dos
 * pantallas la haría contar doble.
 */
export function selectUnregisteredOrders(input: {
  orders: Array<OrderEligibilityInput & Omit<UnregisteredOrder, 'order_id'>>;
  existingOrderIds: Iterable<string>;
  trigger: ErpSalesTrigger;
}): {
  orders: UnregisteredOrder[];
  /** Conteo por motivo de descarte, para que el panel pueda explicarse. */
  discarded: Record<string, number>;
} {
  const existing = new Set(input.existingOrderIds);
  const orders: UnregisteredOrder[] = [];
  const discarded: Record<string, number> = {};

  for (const order of input.orders) {
    if (existing.has(order.id)) continue;
    const reason = classifyUnregisteredOrder(order, input.trigger);
    if (reason !== 'eligible') {
      discarded[reason] = (discarded[reason] ?? 0) + 1;
      continue;
    }
    orders.push({
      order_id: order.id,
      display_id: order.display_id ?? null,
      created_at: order.created_at ?? null,
      payment_status: order.payment_status ?? null,
      fulfillment_status: order.fulfillment_status ?? null,
      total: order.total ?? null,
    });
  }

  return { orders, discarded };
}
