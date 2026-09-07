import type { SubscriberArgs, SubscriberConfig } from '@medusajs/framework';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import type { Logger } from '@medusajs/framework/types';

type OrderRow = {
  id: string;
  cart_id: string | null;
  metadata: Record<string, unknown> | null;
};
type CartRow = { id: string; metadata: Record<string, unknown> | null };

/**
 * Etiqueta la orden con la empresa (B2B) leyendo el contexto del cart:
 * copia company_id/company_name/placed_by_* + context a order.metadata.
 */
export default async function handleOrderCompanyTag({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const orderId = event.data.id;
  if (!orderId) return;
  const logger = container.resolve<Logger>(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve<{
    graph: (input: unknown) => Promise<{ data: unknown[] }>;
  }>(ContainerRegistrationKeys.QUERY);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const loadOrder = async (): Promise<OrderRow | undefined> => {
    const { data } = (await query.graph({
      entity: 'order',
      fields: ['id', 'cart_id', 'metadata'],
      filters: { id: orderId },
    })) as { data: OrderRow[] };
    return data[0];
  };

  try {
    // El link order → cart puede no estar commiteado todavía cuando se emite
    // `order.placed` (se crea en un paso posterior de completeCartWorkflow).
    // Sin cart_id no se puede leer el contexto B2B del cart y la orden quedaba
    // sin etiquetar. Reintentar unas pocas veces evita ese falso negativo.
    // Idempotente: si al final no aparece, no hacemos nada.
    let order = await loadOrder();
    for (let attempt = 0; attempt < 5 && (!order || !order.cart_id); attempt++) {
      await sleep(500);
      order = await loadOrder();
    }
    if (!order || !order.cart_id) return;
    if (order.metadata && order.metadata.company_id) return; // ya etiquetada

    const { data: carts } = (await query.graph({
      entity: 'cart',
      fields: ['id', 'metadata'],
      filters: { id: order.cart_id },
    })) as { data: CartRow[] };
    const cartMeta = (carts[0]?.metadata ?? {}) as Record<string, unknown>;
    if (cartMeta.context !== 'b2b' || !cartMeta.company_id) return;

    const orderService = container.resolve(Modules.ORDER);
    await orderService.updateOrders([
      {
        id: order.id,
        metadata: {
          ...(order.metadata ?? {}),
          context: 'b2b',
          company_id: cartMeta.company_id,
          company_name: cartMeta.company_name ?? null,
          placed_by_customer_id: cartMeta.placed_by_customer_id ?? null,
          placed_by_email: cartMeta.placed_by_email ?? null,
        },
      },
    ]);

    const eventBus = container.resolve(Modules.EVENT_BUS);
    await eventBus.emit({
      name: 'company.order.placed',
      data: { id: order.id, company_id: cartMeta.company_id },
    });
    logger.info(`[Company] Orden ${order.id} etiquetada a empresa ${cartMeta.company_id}`);
  } catch (error) {
    logger.warn(`[Company] No se pudo etiquetar la orden ${orderId}: ${(error as Error).message}`);
  }
}

export const config: SubscriberConfig = { event: 'order.placed' };
