"use server";

import { sdk } from "@lib/config";
import { getAuthHeaders } from "./cookies";

export type ReturnReason = {
  id: string;
  label: string;
  value: string;
  description?: string | null;
};

export type ReturnShippingOption = {
  id: string;
  name: string;
  amount?: number | null;
};

export type CreateReturnItemInput = {
  id: string; // order line-item id
  quantity: number;
  reason_id?: string | null;
  note?: string | null;
};

/** Motivos de devolución que el cliente puede elegir. */
export const listReturnReasons = async (): Promise<ReturnReason[]> => {
  return sdk.client
    .fetch<{ return_reasons: ReturnReason[] }>("/store/return-reasons", {
      method: "GET",
      query: { fields: "id,label,value,description" },
      cache: "no-store",
    })
    .then((r) => r.return_reasons ?? [])
    .catch(() => []);
};

/** Opciones de envío marcadas para devolución (is_return). */
export const listReturnShippingOptions = async (): Promise<ReturnShippingOption[]> => {
  return sdk.client
    .fetch<{ shipping_options: ReturnShippingOption[] }>("/store/shipping-options", {
      method: "GET",
      query: { is_return: true, fields: "id,name,amount" },
      cache: "no-store",
    })
    .then((r) => r.shipping_options ?? [])
    .catch(() => []);
};

/**
 * Crea (y completa) una solicitud de devolución. Ruta de Medusa guest-allowed:
 * necesita order_id + ítems (line-item id) + una return shipping option.
 */
export const createReturn = async (input: {
  order_id: string;
  items: CreateReturnItemInput[];
  return_shipping_option_id: string;
  note?: string | null;
}): Promise<{ success: boolean; error: string | null }> => {
  if (!input.items.length) {
    return { success: false, error: "Elegí al menos un producto para devolver." };
  }
  if (!input.return_shipping_option_id) {
    return { success: false, error: "No hay método de envío de devolución configurado." };
  }
  const headers = { ...(await getAuthHeaders()) };
  return sdk.client
    .fetch("/store/returns", {
      method: "POST",
      headers,
      body: {
        order_id: input.order_id,
        items: input.items.map((i) => ({
          id: i.id,
          quantity: i.quantity,
          reason_id: i.reason_id ?? undefined,
          note: i.note ?? undefined,
        })),
        return_shipping: { option_id: input.return_shipping_option_id },
        note: input.note ?? undefined,
      },
    })
    .then(() => ({ success: true, error: null }))
    .catch((err: { message?: string }) => ({
      success: false,
      error: err?.message ?? "No se pudo crear la devolución.",
    }));
};
