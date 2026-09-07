"use server";

import { sdk } from "@lib/config";
import { getActiveSalesChannelId, getAuthHeaders } from "./cookies";

export type RecurringFrequencyInterval = "day" | "week" | "month";

export type RecurringOrderStatus =
  | "active"
  | "paused"
  | "pending_payment"
  | "failed"
  | "cancelled"
  | "completed";

export type RecurringAddress = {
  first_name?: string | null;
  last_name?: string | null;
  address_1: string;
  address_2?: string | null;
  company?: string | null;
  postal_code?: string | null;
  city?: string | null;
  province?: string | null;
  country_code: string;
  phone?: string | null;
};

export type RecurringOrderItem = {
  id: string;
  product_id: string;
  variant_id: string;
  quantity: number;
  product_snapshot?: {
    title?: string | null;
    variant_title?: string | null;
    sku?: string | null;
    handle?: string | null;
    thumbnail?: string | null;
  } | null;
  pricing_snapshot?: {
    unit_price?: number | null;
    currency_code?: string | null;
    captured_at?: string | null;
  } | null;
};

export type RenewalCycle = {
  id: string;
  scheduled_at: string;
  processed_at?: string | null;
  status:
    | "scheduled"
    | "forecasted"
    | "quoted"
    | "inventory_reserved"
    | "awaiting_authorization"
    | "awaiting_charge"
    | "paid"
    | "order_created"
    | "retrying_stock"
    | "past_due"
    | "refunded"
    | "canceled"
    | "processing"
    | "pending_payment"
    | "success"
    | "failed"
    | "skipped";
  cart_id?: string | null;
  generated_order_id?: string | null;
  payment_status?: string | null;
  confirmation_url?: string | null;
  expires_at?: string | null;
  last_error?: string | null;
};

export type RecurringOrder = {
  id: string;
  status: RecurringOrderStatus;
  payment_mode: string;
  financial_status?: string | null;
  sales_channel_id?: string | null;
  plan_id?: string | null;
  offer_id?: string | null;
  plan_snapshot?: SubscriptionPlanSnapshot | null;
  frequency_interval: RecurringFrequencyInterval;
  frequency_count: number;
  next_execution_at?: string | null;
  last_execution_at?: string | null;
  skip_next_cycle: boolean;
  currency_code?: string | null;
  country_code?: string | null;
  shipping_address: RecurringAddress;
  created_at: string;
  items?: RecurringOrderItem[];
  cycles?: RenewalCycle[];
  /** Oferta de retención del canal (el detalle la expone para el modal de cancelar). */
  retention_offer?: { percentage: number; cycles: number } | null;
  available_offers?: SubscriptionPlanOffer[];
  provider_state?: {
    authorization_url?: string | null;
    schedule_reauthorization_required?: boolean;
    [key: string]: unknown;
  } | null;
  metadata?: Record<string, unknown> | null;
};

export type SubscriptionPlanOffer = {
  id: string;
  label?: string | null;
  frequency_interval: RecurringFrequencyInterval;
  frequency_count: number;
  discount_type: "none" | "percentage" | "fixed_amount" | "fixed_price";
  discount_value: number;
  currency_code?: string | null;
};

export type SubscriptionPlanSnapshot = {
  id: string;
  name: string;
  version: number;
  price_policy: "dynamic" | "fixed";
  minimum_cycles: number;
  offer: SubscriptionPlanOffer;
};

export type SubscriptionPlan = {
  id: string;
  name: string;
  version: number;
  purchase_mode: "one_time_and_subscription" | "subscription_only";
  price_policy: "dynamic" | "fixed";
  trial_days: number;
  minimum_cycles: number;
  offers: SubscriptionPlanOffer[];
  eligible_product_ids: string[];
};

export async function getSubscriptionPlans(input: {
  productIds?: string[];
  variantIds?: string[];
}): Promise<{ plans: SubscriptionPlan[]; automatic_payments_enabled: boolean }> {
  try {
    const salesChannelId = await getActiveSalesChannelId();
    return await sdk.client.fetch("/store/subscription-plans", {
      method: "GET",
      query: {
        ...(input.productIds?.length ? { product_ids: input.productIds.join(",") } : {}),
        ...(input.variantIds?.length ? { variant_ids: input.variantIds.join(",") } : {}),
        ...(salesChannelId ? { sales_channel_id: salesChannelId } : {}),
      },
      cache: "no-store",
    });
  } catch {
    return { plans: [], automatic_payments_enabled: false };
  }
}

async function authed() {
  const h = await getAuthHeaders();
  return Object.keys(h).length ? h : null;
}

export type RecurringDiscount = {
  interval: RecurringFrequencyInterval;
  count: number;
  percentage: number;
};

export type RecurringEligibility = {
  /** Subconjunto elegible de los ids consultados. */
  eligible: string[];
  /** Descuentos de suscripción por producto (% por frecuencia), si hay oferta. */
  discounts: Record<string, RecurringDiscount[]>;
};

/**
 * Qué productos pueden suscribirse en el canal activo (scope all/selected
 * configurado en el admin) y con qué descuento por frecuencia. Endpoint
 * público: gobierna la visibilidad del botón también para visitantes anónimos;
 * el backend re-exige elegibilidad al crear y aplica el descuento real en cada
 * renovación. Best-effort: ante error devuelve vacío (botón oculto, nunca roto).
 */
export async function getRecurringEligibilityDetail(
  productIds: string[],
): Promise<RecurringEligibility> {
  const ids = Array.from(new Set(productIds.filter(Boolean)));
  if (!ids.length) return { eligible: [], discounts: {} };
  try {
    const salesChannelId = await getActiveSalesChannelId();
    const { enabled, eligible_product_ids, discounts } = await sdk.client.fetch<{
      enabled: boolean;
      eligible_product_ids: string[];
      discounts?: Record<string, RecurringDiscount[]>;
    }>("/store/recurring-eligibility", {
      method: "GET",
      query: {
        product_ids: ids.join(","),
        ...(salesChannelId ? { sales_channel_id: salesChannelId } : {}),
      },
      cache: "no-store",
    });
    if (!enabled) return { eligible: [], discounts: {} };
    return { eligible: eligible_product_ids, discounts: discounts ?? {} };
  } catch {
    return { eligible: [], discounts: {} };
  }
}

/** Ids elegibles a secas (compatibilidad con los llamadores existentes). */
export async function getRecurringEligibility(
  productIds: string[],
): Promise<string[]> {
  return (await getRecurringEligibilityDetail(productIds)).eligible;
}

/** Mis suscripciones, filtradas por el sales channel del tenant activo. */
export async function listMyRecurringOrders(filters?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<{ recurring_orders: RecurringOrder[]; count: number }> {
  const headers = await authed();
  if (!headers) return { recurring_orders: [], count: 0 };
  try {
    const salesChannelId = await getActiveSalesChannelId();
    return await sdk.client.fetch("/store/recurring-orders", {
      method: "GET",
      query: {
        ...(salesChannelId ? { sales_channel_id: salesChannelId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.limit ? { limit: filters.limit } : {}),
        ...(filters?.offset ? { offset: filters.offset } : {}),
      },
      headers,
      cache: "no-store",
    });
  } catch {
    return { recurring_orders: [], count: 0 };
  }
}

/** Detalle de una suscripción (items + últimos ciclos). Null si no existe/ajena. */
export async function retrieveRecurringOrder(
  id: string,
): Promise<RecurringOrder | null> {
  const headers = await authed();
  if (!headers) return null;
  try {
    const { recurring_order } = await sdk.client.fetch<{
      recurring_order: RecurringOrder;
    }>(`/store/recurring-orders/${id}`, {
      method: "GET",
      headers,
      cache: "no-store",
    });
    return recurring_order;
  } catch {
    return null;
  }
}

export type CreateRecurringOrderInput = {
  items: { variant_id: string; quantity: number }[];
  frequency_interval?: RecurringFrequencyInterval;
  frequency_count?: number;
  plan_id?: string | null;
  offer_id?: string | null;
  payment_mode?: "manual_link" | "mercadopago_auto";
  terms_accepted?: boolean;
  terms_version?: string;
  country_code?: string | null;
  /** Id de una dirección guardada del customer… */
  address_id?: string | null;
  /** …o la dirección inline (p. ej. la del carrito). */
  shipping_address?: RecurringAddress | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Alta de una suscripción (desde la PDP o el carrito). El canal sale del tenant
 * activo; el backend valida el toggle del demo y snapshotea precios.
 */
export async function createRecurringOrder(
  input: CreateRecurringOrderInput,
): Promise<
  {
    recurring_order: RecurringOrder;
    authorization?: { url: string; cycle_id: string } | null;
    error?: never;
  } | { error: string }
> {
  const headers = await authed();
  if (!headers) return { error: "Necesitás iniciar sesión para suscribirte." };
  const salesChannelId = await getActiveSalesChannelId();
  if (!salesChannelId) return { error: "No se pudo resolver la tienda." };
  try {
    return await sdk.client.fetch("/store/recurring-orders", {
      method: "POST",
      body: {
        ...input,
        sales_channel_id: salesChannelId,
      },
      headers,
    });
  } catch (e) {
    return {
      error:
        (e as { message?: string }).message ??
        "No se pudo crear la compra recurrente.",
    };
  }
}

export type UpdateRecurringOrderInput = {
  frequency_interval?: RecurringFrequencyInterval;
  frequency_count?: number;
  shipping_address?: RecurringAddress;
  items?: { id?: string; variant_id?: string; quantity: number }[];
};

async function action(
  id: string,
  path: "" | "/pause" | "/resume" | "/cancel" | "/skip-next" | "/retention",
  body: Record<string, unknown> = {},
): Promise<{
  recurring_order?: RecurringOrder;
  authorization_url?: string;
  error?: string;
}> {
  const headers = await authed();
  if (!headers) return { error: "Sesión expirada." };
  try {
    return await sdk.client.fetch(`/store/recurring-orders/${id}${path}`, {
      method: "POST",
      body,
      headers,
    });
  } catch (e) {
    return {
      error:
        (e as { message?: string }).message ?? "No se pudo completar la acción.",
    };
  }
}

export async function updateRecurringOrder(
  id: string,
  input: UpdateRecurringOrderInput,
) {
  return action(id, "", input);
}

export async function pauseRecurringOrder(id: string) {
  return action(id, "/pause");
}

export async function resumeRecurringOrder(id: string) {
  return action(id, "/resume");
}

export type CancellationReason = string;

export async function getSubscriptionCancellationReasons(salesChannelId?: string | null) {
  try {
    const suffix = salesChannelId
      ? `?sales_channel_id=${encodeURIComponent(salesChannelId)}`
      : "";
    return await sdk.client.fetch<{
      cancellation_reasons: Array<{ code: string; label: string }>;
    }>(`/store/subscription-cancellation-reasons${suffix}`);
  } catch {
    return { cancellation_reasons: [] };
  }
}

export async function cancelRecurringOrder(
  id: string,
  reason?: CancellationReason,
  reasonNote?: string,
) {
  return action(id, "/cancel", {
    ...(reason ? { reason } : {}),
    ...(reasonNote ? { reason_note: reasonNote } : {}),
  });
}

/**
 * El cliente venía a cancelar pero aceptó una alternativa: pausar, omitir la
 * próxima entrega o quedarse con el descuento de retención del canal.
 */
export async function acceptRetention(
  id: string,
  input: {
    action: "pause" | "skip" | "discount";
    reason?: CancellationReason;
    reason_note?: string;
  },
) {
  return action(id, "/retention", input as unknown as Record<string, unknown>);
}

export async function skipNextRecurringDelivery(id: string) {
  return action(id, "/skip-next");
}

/** Token efímero: el server action no lo almacena y el backend lo envía una sola vez a MP. */
export async function updateRecurringPaymentMethod(id: string, cardTokenId: string) {
  const headers = await authed();
  if (!headers) return { error: "Sesión expirada." };
  try {
    return await sdk.client.fetch<{ updated: boolean }>(
      `/store/recurring-orders/${id}/payment-method`,
      { method: "POST", body: { card_token_id: cardTokenId }, headers },
    );
  } catch (error) {
    return { error: (error as { message?: string }).message ?? "No se pudo actualizar el medio de pago." };
  }
}

/** Regenera el link de pago de una renovación vencida (devuelve el link nuevo). */
export async function regenerateRenewalLink(
  id: string,
  cycleId: string,
): Promise<{ confirmation_url?: string; error?: string }> {
  const headers = await authed();
  if (!headers) return { error: "Sesión expirada." };
  try {
    const { result } = await sdk.client.fetch<{
      result: { outcome: string; confirmationUrl?: string | null; reason?: string | null };
    }>(`/store/recurring-orders/${id}/cycles/${cycleId}/regenerate`, {
      method: "POST",
      body: {},
      headers,
    });
    if (result.outcome === "pending_payment" && result.confirmationUrl) {
      return { confirmation_url: result.confirmationUrl };
    }
    return { error: result.reason ?? "No se pudo generar el link." };
  } catch (e) {
    return {
      error: (e as { message?: string }).message ?? "No se pudo generar el link.",
    };
  }
}
