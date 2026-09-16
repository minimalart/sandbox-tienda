"use server";

import { sdk } from "@lib/config";
import { getTenant } from "@lib/site-config/resolver";
import medusaError from "@lib/util/medusa-error";
import { transferRequestSchema } from "@lib/validation/order";
import type { HttpTypes } from "@medusajs/types";
import { getAuthHeaders } from "./cookies";

export const retrieveOrder = async (
  id: string,
  skipSalesChannelCheck = false,
) => {
  const headers = {
    ...(await getAuthHeaders()),
  };

  // Obtener tenant actual para validar sales channel (solo si no se omite la verificación)
  const tenant = await getTenant();
  const salesChannelId = tenant.medusa.salesChannelId;

  return sdk.client
    .fetch<HttpTypes.StoreOrderResponse>(`/store/orders/${id}`, {
      method: "GET",
      query: {
        fields:
          "+metadata,+custom_display_id,*payment_collections.payments,*items,*items.metadata,*items.variant,+items.variant.metadata,*items.product,+items.product.metadata,+fulfillments,+fulfillments.tracking_links",
      },
      headers,
      cache: "no-store",
    })
    .then(({ order }) => {
      // Si skipSalesChannelCheck es true, omitir la validación (útil para páginas de confirmación)
      // De lo contrario, validar que la orden pertenezca al sales channel del tenant actual
      if (
        !skipSalesChannelCheck &&
        order.sales_channel_id &&
        order.sales_channel_id !== salesChannelId
      ) {
        return null;
      }
      return order;
    })
    .catch((err) => medusaError(err));
};

export const listOrders = async (
  limit = 10,
  offset = 0,
  filters?: Record<string, any>,
) => {
  const headers = {
    ...(await getAuthHeaders()),
  };

  // Obtener tenant actual para filtrar por sales channel
  const tenant = await getTenant();
  const salesChannelId = tenant.medusa.salesChannelId;

  return sdk.client
    .fetch<HttpTypes.StoreOrderListResponse>("/store/orders", {
      method: "GET",
      query: {
        limit: 100, // Obtener más órdenes para filtrar por sales channel
        offset,
        order: "-created_at",
        fields:
          "*items,+items.metadata,*items.variant,+items.variant.metadata,*items.product,+items.product.metadata,sales_channel_id,total,currency_code,display_id,custom_display_id,created_at",
        ...filters,
      },
      headers,
      cache: "no-store",
    })
    .then((response) => {
      // Asegurar que orders sea un array
      const orders = response.orders || [];

      // Filtrar órdenes por sales_channel_id del tenant actual
      // El Store API no acepta sales_channel_id como query param, así que filtramos después
      const filteredOrders = orders.filter((order) => {
        // Si la orden no tiene sales_channel_id, podría ser una orden antigua (legacy)
        // Por ahora, mostramos órdenes que:
        // 1. Tengan el sales_channel_id correcto, O
        // 2. No tengan sales_channel_id (para compatibilidad con órdenes antiguas)
        return (
          !order.sales_channel_id || order.sales_channel_id === salesChannelId
        );
      });

      // Aplicar límite después del filtro y asegurar que siempre retorne un array
      return filteredOrders.slice(0, limit);
    })
    .catch((err) => {
      // Si hay un error, retornar array vacío en lugar de lanzar
      console.error("[listOrders] Error fetching orders:", err);
      return [];
    });
};

/** Orden que es de este cliente pero todavía no está atada a su cuenta. */
export type ClaimableOrder = {
  id: string;
  display_id: number | null;
  created_at: string | null;
  total: number | null;
  currency_code: string | null;
};

/**
 * Órdenes compradas como invitado con el email de esta cuenta.
 *
 * Cuando alguien compra como invitado usando un email que ya tiene cuenta,
 * Medusa cuelga la orden de un customer INVITADO con id propio, y
 * `GET /store/orders` filtra por `customer_id` — la compra no aparece nunca en
 * "Mis pedidos" (DESDEELSUR-61 / BUG-07). Este listado es lo que permite que la
 * persona se entere de que la orden existe; vincularla la sigue haciendo
 * `createTransferRequest`, el flujo de Medusa que confirma por mail.
 *
 * Devuelve `[]` ante cualquier error a propósito: es un bloque extra de la
 * página de pedidos y no tiene por qué tirar abajo el listado normal.
 */
export const listClaimableOrders = async (): Promise<ClaimableOrder[]> => {
  const headers = { ...(await getAuthHeaders()) };
  if (!headers.authorization) return [];

  return sdk.client
    .fetch<{ orders: ClaimableOrder[] }>(
      "/store/customers/me/claimable-orders",
      { method: "GET", headers, cache: "no-store" },
    )
    .then((response) => response.orders ?? [])
    .catch(() => []);
};

export const createTransferRequest = async (
  state: {
    success: boolean;
    error: string | null;
    order: HttpTypes.StoreOrder | null;
  },
  formData: FormData,
): Promise<{
  success: boolean;
  error: string | null;
  order: HttpTypes.StoreOrder | null;
}> => {
  const parsed = transferRequestSchema.safeParse({
    order_id: formData.get("order_id"),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Order ID is required",
      order: null,
    };
  }

  const { order_id: id } = parsed.data;

  const headers = await getAuthHeaders();

  return await sdk.store.order
    .requestTransfer(
      id,
      {},
      {
        fields: "id, email",
      },
      headers,
    )
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch((err) => ({ success: false, error: err.message, order: null }));
};

export const acceptTransferRequest = async (id: string, token: string) => {
  const headers = await getAuthHeaders();

  return await sdk.store.order
    .acceptTransfer(id, { token }, {}, headers)
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch((err) => ({ success: false, error: err.message, order: null }));
};

export const declineTransferRequest = async (id: string, token: string) => {
  const headers = await getAuthHeaders();

  return await sdk.store.order
    .declineTransfer(id, { token }, {}, headers)
    .then(({ order }) => ({ success: true, error: null, order }))
    .catch((err) => ({ success: false, error: err.message, order: null }));
};
