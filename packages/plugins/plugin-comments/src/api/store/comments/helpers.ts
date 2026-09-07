import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaContainer } from '@medusajs/framework/types';

type QueryLike = {
  graph: (input: unknown) => Promise<{ data: unknown[] }>;
};

/** Display name snapshot for a customer ("First Last" / email fallback). */
export async function getCustomerName(
  container: MedusaContainer,
  customerId: string,
): Promise<string | null> {
  const query = container.resolve<QueryLike>(ContainerRegistrationKeys.QUERY);
  const { data } = (await query.graph({
    entity: 'customer',
    fields: ['first_name', 'last_name', 'email'],
    filters: { id: customerId },
  })) as { data: { first_name?: string; last_name?: string; email?: string }[] };
  const c = data[0];
  if (!c) return null;
  const name = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
  return name || c.email || null;
}

/**
 * Returns true when the customer has received (delivered) the given product:
 * an order containing the product where the matching line item belongs to a
 * fulfillment that has been marked delivered (`delivered_at` set). This is the
 * "pedido entregado" gate for writing reviews — stricter than just "paid".
 */
export async function hasDeliveredPurchase(
  container: MedusaContainer,
  customerId: string,
  productId: string,
): Promise<boolean> {
  const query = container.resolve<QueryLike>(ContainerRegistrationKeys.QUERY);
  const { data } = (await query.graph({
    entity: 'order',
    fields: [
      'id',
      'items.id',
      'items.product_id',
      'fulfillments.delivered_at',
      'fulfillments.items.line_item_id',
    ],
    filters: { customer_id: customerId },
  })) as {
    data: {
      items: { id: string; product_id: string | null }[] | null;
      fulfillments:
        | {
            delivered_at: string | Date | null;
            items: { line_item_id: string }[] | null;
          }[]
        | null;
    }[];
  };

  for (const order of data) {
    // Line items that are part of a delivered fulfillment.
    const deliveredLineItemIds = new Set<string>();
    for (const f of order.fulfillments ?? []) {
      if (!f.delivered_at) continue;
      for (const fi of f.items ?? []) {
        deliveredLineItemIds.add(fi.line_item_id);
      }
    }
    if (deliveredLineItemIds.size === 0) continue;
    // The target product must be one of those delivered line items.
    const delivered = (order.items ?? []).some(
      (it) => it.product_id === productId && deliveredLineItemIds.has(it.id),
    );
    if (delivered) return true;
  }
  return false;
}
