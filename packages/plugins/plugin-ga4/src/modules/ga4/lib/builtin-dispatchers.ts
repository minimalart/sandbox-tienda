import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { formatGACartItems } from './format-ga-items';
import type { Ga4BuiltinKey } from './supported-events';

/**
 * Payload-builders de los eventos ecommerce, portados del plugin
 * @variablevic/google-analytics-medusa (subscribers order-placed / cart-updated /
 * payment-session-created). Cada builder resuelve el client_id desde el metadata
 * y arma los params (items/value/currency) vía query.graph. Devuelve null para
 * saltear (sin client_id, sin entidad, o condición de cambio no aplicable).
 */

export type BuiltGa4Payload = {
  clientId: string;
  userId?: string;
  params: Record<string, unknown>;
};

type QueryLike = {
  graph: (input: {
    entity: string;
    fields: string[];
    filters?: Record<string, unknown>;
    pagination?: { take?: number };
  }) => Promise<{ data: any[] }>;
};

type ContainerLike = { resolve: (key: string) => unknown };

function getQuery(container: ContainerLike): QueryLike {
  return container.resolve(ContainerRegistrationKeys.QUERY) as QueryLike;
}

function clientIdFrom(entity: { metadata?: Record<string, unknown> | null }): string | null {
  const id = entity?.metadata?.ga_client_id;
  return typeof id === 'string' && id ? id : null;
}

// order.placed → purchase
async function buildPurchase(
  container: ContainerLike,
  data: { id: string }
): Promise<BuiltGa4Payload | null> {
  const query = getQuery(container);
  const {
    data: [order],
  } = await query.graph({
    entity: 'order',
    fields: ['*', 'items.*', 'sales_channel_id'],
    filters: { id: data.id },
  });
  if (!order) return null;

  const clientId = clientIdFrom(order);
  if (!clientId) return null;

  return {
    clientId,
    userId: order.customer_id ?? undefined,
    params: {
      transaction_id: order.id,
      value: order.total,
      affiliation: order.sales_channel_id,
      tax: order.tax_total,
      shipping: order.shipping_total,
      currency: order.currency_code,
      items: formatGACartItems(order.items, order),
    },
  };
}

// payment.refunded → refund
// El payload trae SOLO el payment id. Resolvemos el order recorriendo edges ya
// probados en el repo: payment → payment_collection → cart → order. El monto
// refundado no viene en el evento: sumamos payment.refunds[].amount (refund
// acumulado) y caemos a order.total si no hay parcial resoluble.
async function buildRefund(
  container: ContainerLike,
  data: { id: string }
): Promise<BuiltGa4Payload | null> {
  const query = getQuery(container);

  const {
    data: [payment],
  } = await query.graph({
    entity: 'payment',
    fields: ['id', 'refunds.amount', 'payment_collection.id'],
    filters: { id: data.id },
    pagination: { take: 1 },
  });
  const collectionId = payment?.payment_collection?.id;
  if (!collectionId) return null;

  const {
    data: [collection],
  } = await query.graph({
    entity: 'payment_collection',
    fields: ['cart.order.id'],
    filters: { id: collectionId },
    pagination: { take: 1 },
  });
  const orderId = collection?.cart?.order?.id;
  if (!orderId) return null;

  const {
    data: [order],
  } = await query.graph({
    entity: 'order',
    fields: ['*', 'items.*', 'items.variant.*'],
    filters: { id: orderId },
    pagination: { take: 1 },
  });
  if (!order) return null;

  const clientId = clientIdFrom(order);
  if (!clientId) return null;

  const refundedAmount = Array.isArray(payment?.refunds)
    ? payment.refunds.reduce(
        (acc: number, r: { amount?: number } | null) => acc + (r?.amount ?? 0),
        0
      )
    : 0;

  return {
    clientId,
    userId: order.customer_id ?? undefined,
    params: {
      transaction_id: order.id,
      value: refundedAmount > 0 ? refundedAmount : order.total,
      currency: order.currency_code,
      items: formatGACartItems(order.items, order),
    },
  };
}

async function fetchCart(container: ContainerLike, id: string) {
  const query = getQuery(container);
  const {
    data: [cart],
  } = await query.graph({
    entity: 'cart',
    fields: ['*'],
    filters: { id },
    pagination: { take: 1 },
  });
  return cart;
}

// cart.updated (line_items added) → add_to_cart
async function buildAddToCart(
  container: ContainerLike,
  data: { id: string; changes?: any }
): Promise<BuiltGa4Payload | null> {
  const items = data.changes?.line_items?.value;
  if (!items) return null;

  const cart = await fetchCart(container, data.id);
  if (!cart) return null;
  const clientId = clientIdFrom(cart);
  if (!clientId) return null;

  const value = items.reduce(
    (acc: number, it: any) => acc + (it.unit_price ?? 0) * (it.quantity ?? 0),
    0
  );

  return {
    clientId,
    userId: cart.customer_id ?? undefined,
    params: {
      currency: cart.currency_code?.toUpperCase(),
      value,
      items: formatGACartItems(items, cart),
    },
  };
}

// cart.updated (line_items deleted) → remove_from_cart
async function buildRemoveFromCart(
  container: ContainerLike,
  data: { id: string; changes?: any }
): Promise<BuiltGa4Payload | null> {
  const items = data.changes?.line_items?.value;
  if (!items) return null;

  const cart = await fetchCart(container, data.id);
  if (!cart) return null;
  const clientId = clientIdFrom(cart);
  if (!clientId) return null;

  const value = items.reduce(
    (acc: number, it: any) => acc + (it.unit_price ?? 0) * (it.quantity ?? 0),
    0
  );

  return {
    clientId,
    userId: cart.customer_id ?? undefined,
    params: {
      currency: cart.currency_code?.toUpperCase(),
      value,
      items: formatGACartItems(items, cart),
    },
  };
}

// cart.updated (shipping_address) → add_shipping_info
async function buildAddShippingInfo(
  container: ContainerLike,
  data: { id: string; changes?: any }
): Promise<BuiltGa4Payload | null> {
  if (!data.changes?.shipping_address) return null;

  const cart = await fetchCart(container, data.id);
  if (!cart) return null;
  const clientId = clientIdFrom(cart);
  if (!clientId) return null;

  return {
    clientId,
    userId: cart.customer_id ?? undefined,
    params: {
      currency: cart.currency_code?.toUpperCase(),
      value: cart.item_total,
      items: formatGACartItems(cart.items, cart),
    },
  };
}

// payment-session.created → add_payment_info
async function buildAddPaymentInfo(
  container: ContainerLike,
  data: { id: string; payment_session?: { payment_collection_id?: string } }
): Promise<BuiltGa4Payload | null> {
  const collectionId = data.payment_session?.payment_collection_id;
  if (!collectionId) return null;

  const query = getQuery(container);
  const {
    data: [paymentCollection],
  } = await query.graph({
    entity: 'payment_collection',
    fields: ['cart.id'],
    filters: { id: collectionId },
    pagination: { take: 1 },
  });
  if (!paymentCollection?.cart?.id) return null;

  const {
    data: [cart],
  } = await query.graph({
    entity: 'cart',
    fields: ['*', 'items.*', 'items.variant.*'],
    filters: { id: paymentCollection.cart.id },
    pagination: { take: 1 },
  });
  if (!cart) return null;

  const clientId = clientIdFrom(cart);
  if (!clientId) return null;

  return {
    clientId,
    userId: cart.customer_id ?? undefined,
    params: {
      currency: cart.currency_code?.toUpperCase(),
      value: cart.item_total,
      items: cart.items ? formatGACartItems(cart.items, cart) : [],
    },
  };
}

export const BUILTIN_BUILDERS: Record<
  Ga4BuiltinKey,
  (container: ContainerLike, data: any) => Promise<BuiltGa4Payload | null>
> = {
  purchase: buildPurchase,
  refund: buildRefund,
  add_to_cart: buildAddToCart,
  remove_from_cart: buildRemoveFromCart,
  add_shipping_info: buildAddShippingInfo,
  add_payment_info: buildAddPaymentInfo,
};
