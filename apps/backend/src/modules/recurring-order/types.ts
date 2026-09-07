/**
 * Compras recurrentes (suscripciones de reposición). Una `recurring_order` es la
 * suscripción del cliente (items + frecuencia + dirección + modo de pago); cada
 * ejecución programada es un `renewal_cycle` y cada corrida concreta un
 * `renewal_attempt`. La suscripción es la fuente de verdad del estado activo;
 * el ciclo es la fuente de verdad de la ejecución y su historial.
 *
 * El módulo NO cobra: en el modo `manual_link` (MVP) arma un carrito real con
 * precios/promos/stock vigentes y le manda al cliente un link para confirmar y
 * pagar con el checkout existente. La capa `payment/` deja enchufar cobro
 * automático (Mercado Pago Preapproval, Fase 2) sin re-modelar.
 */

export const RECURRING_ORDER_MODULE = 'recurringOrder';

/**
 * Estados de la suscripción:
 * - `active`          → agenda y ejecuta renovaciones.
 * - `paused`          → el scheduler la saltea; se reanuda manualmente.
 * - `pending_payment` → hay un ciclo esperando confirmación/pago del cliente.
 * - `failed`          → superó el máximo de ciclos fallidos consecutivos; requiere reanudación manual.
 * - `cancelled`       → terminal, decidido por el cliente o el admin.
 * - `completed`       → terminal, reservado para suscripciones con fin programado (futuro).
 */
export type RecurringOrderStatus =
  | 'active'
  | 'paused'
  | 'pending_payment'
  | 'failed'
  | 'cancelled'
  | 'completed';

/**
 * Estados de un ciclo de renovación:
 * - `scheduled`       → agendado, aún no vencido o no procesado.
 * - `processing`      → el workflow lo está ejecutando (guard anti doble corrida).
 * - `pending_payment` → carrito generado + link enviado; espera confirmación del cliente.
 * - `success`         → el cliente pagó y la orden se generó.
 * - `failed`          → falló la ejecución o expiró el link. Reintentable mientras
 *                       `processed_at` sea null; con `processed_at` seteado es terminal.
 * - `skipped`         → salteado (skip_next_cycle, cancelación, feature apagada).
 */
export type RenewalCycleStatus =
  | 'scheduled'
  | 'forecasted'
  | 'quoted'
  | 'inventory_reserved'
  | 'awaiting_authorization'
  | 'awaiting_charge'
  | 'paid'
  | 'order_created'
  | 'retrying_stock'
  | 'past_due'
  | 'refunded'
  | 'canceled'
  | 'processing'
  | 'pending_payment'
  | 'success'
  | 'failed'
  | 'skipped';

export type RenewalAttemptResult =
  | 'running'
  | 'pending_payment'
  | 'success'
  | 'failed'
  | 'skipped';

/** Estado del cobro de un ciclo (informativo; el pago real vive en la orden). */
export type RenewalPaymentStatus = 'pending' | 'paid' | 'expired';

/** Unidad de la frecuencia de reposición. */
export type RecurringFrequencyInterval = 'day' | 'week' | 'month';

/** Snapshot de dirección guardado en la suscripción (shape del checkout core). */
export type RecurringAddressSnapshot = {
  first_name?: string | null;
  last_name?: string | null;
  address_1?: string | null;
  address_2?: string | null;
  company?: string | null;
  postal_code?: string | null;
  city?: string | null;
  province?: string | null;
  country_code?: string | null;
  phone?: string | null;
};

export type RecurringOrderItemInput = {
  variant_id: string;
  quantity: number;
};

export type SubscriptionPlanStatus = 'draft' | 'active' | 'archived';
export type SubscriptionPurchaseMode =
  | 'one_time_and_subscription'
  | 'subscription_only';
export type SubscriptionPricePolicy = 'dynamic' | 'fixed';
export type SubscriptionPromotionPolicy =
  | 'best_benefit'
  | 'subscription_only'
  | 'stack';
export type SubscriptionDiscountType =
  | 'none'
  | 'percentage'
  | 'fixed_amount'
  | 'fixed_price';
export type SubscriptionTargetType = 'variant' | 'product' | 'category' | 'tag';
export type SubscriptionFinancialStatus =
  | 'manual'
  | 'pending_authorization'
  | 'authorized'
  | 'paused'
  | 'past_due'
  | 'cancelled'
  | 'failed';

export type SubscriptionPlanSnapshot = {
  id: string;
  name: string;
  handle: string;
  version: number;
  purchase_mode: SubscriptionPurchaseMode;
  price_policy: SubscriptionPricePolicy;
  promotion_policy: SubscriptionPromotionPolicy;
  allow_stacking: boolean;
  currency_code: string | null;
  preflight_hours: number;
  reservation_hours: number;
  stock_retry_hours: number;
  stock_retry_interval_hours: number;
  payment_retry_hours: number;
  payment_retry_interval_hours: number;
  trial_days: number;
  minimum_cycles: number;
  cancellation_policy: 'immediate';
  offer: {
    id: string;
    label: string | null;
    frequency_interval: RecurringFrequencyInterval;
    frequency_count: number;
    discount_type: SubscriptionDiscountType;
    discount_value: number;
    currency_code: string | null;
    fixed_unit_prices: Record<string, number> | null;
  };
};
