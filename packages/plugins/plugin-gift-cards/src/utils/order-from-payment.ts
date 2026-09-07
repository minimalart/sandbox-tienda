import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';

/**
 * Resuelve el order_id a partir del payload `{ id: payment_id }` de
 * `payment.captured` (el evento de Medusa v2 no trae la orden): payment →
 * payment_collection_id → link `order_payment_collection` → order_id. Mismo
 * camino de 2 saltos que usa el core y que ya usa
 * src/subscribers/erp-payment-captured.ts.
 *
 * Devuelve undefined si el pago no existe, no tiene payment_collection o la
 * colección todavía no está linkeada a una orden (captura que llega antes de
 * completar el cart): esa carrera la cubre la pata `order.placed` del caller.
 */
export async function resolveOrderIdFromPayment(
  container: MedusaContainer,
  paymentId: string
): Promise<string | undefined> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data: payments } = (await query.graph({
    entity: 'payment',
    fields: ['id', 'payment_collection_id'],
    filters: { id: paymentId },
  })) as { data: Array<{ payment_collection_id: string | null }> };
  const paymentCollectionId = payments[0]?.payment_collection_id;
  if (!paymentCollectionId) return undefined;

  const { data: links } = (await query.graph({
    entity: 'order_payment_collection',
    fields: ['order_id'],
    filters: { payment_collection_id: paymentCollectionId },
  })) as { data: Array<{ order_id: string | null }> };
  return links[0]?.order_id ?? undefined;
}
