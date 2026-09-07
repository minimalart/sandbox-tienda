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
 * Copia el snapshot fiscal de cart.metadata → order.metadata al colocar la orden.
 * La orden conserva los datos EXACTOS de la compra (inmutable: editar/borrar el
 * perfil luego no la cambia).
 */
export default async function handleOrderBillingSnapshot({
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
    // Sin cart_id no hay snapshot y la orden quedaba sin invoice_type (afecta a
    // B2B → tipo de documento fiscal ARCA). Reintentar unas pocas veces evita ese
    // falso negativo. Idempotente: si al final no aparece, no hacemos nada.
    let order = await loadOrder();
    for (let attempt = 0; attempt < 5 && (!order || !order.cart_id); attempt++) {
      await sleep(500);
      order = await loadOrder();
    }
    if (!order || !order.cart_id) return;

    // Idempotencia: si ya tiene el snapshot, no reescribir.
    if (order.metadata && 'invoice_type' in order.metadata) return;

    const { data: carts } = (await query.graph({
      entity: 'cart',
      fields: ['id', 'metadata'],
      filters: { id: order.cart_id },
    })) as { data: CartRow[] };

    const cartMeta = (carts[0]?.metadata ?? {}) as Record<string, unknown>;
    const invoice_type = cartMeta.invoice_type ?? 'final_consumer';
    const billing_profile_id = cartMeta.billing_profile_id ?? null;
    const billing_snapshot = cartMeta.billing_snapshot ?? null;

    const orderService = container.resolve(Modules.ORDER);
    await orderService.updateOrders([
      {
        id: order.id,
        metadata: {
          ...(order.metadata ?? {}),
          invoice_type,
          billing_profile_id,
          billing_snapshot,
        },
      },
    ]);

    const eventBus = container.resolve(Modules.EVENT_BUS);
    await eventBus.emit({
      name: 'order.billing_snapshot_created',
      data: { id: order.id, invoice_type },
    });

    logger.info(
      `[BillingSnapshot] Order ${order.id} → invoice_type=${invoice_type}`,
    );
  } catch (error) {
    logger.warn(
      `[BillingSnapshot] No se pudo copiar el snapshot para la orden ${orderId}: ${(error as Error).message}`,
    );
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
};
