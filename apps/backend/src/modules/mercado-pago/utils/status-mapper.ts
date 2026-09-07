import type { PaymentActions } from '@medusajs/framework/utils';

/**
 * Subset of the MercadoPago payment fields we read when mapping a payment to a
 * Medusa status / webhook action.
 *
 * See: https://www.mercadopago.com.ar/developers/es/docs/checkout-api/payment-management/status/response-handling/query-results
 */
export type MpPaymentLike = {
  id?: number | string | null;
  status?: string | null;
  status_detail?: string | null;
  payment_type_id?: string | null;
  payment_method_id?: string | null;
  transaction_amount?: number | null;
  external_reference?: string | null;
  /** ISO timestamp when MP approved the payment (terminal state). */
  date_approved?: string | null;
  /** Checkout Pro sets preference_id and order.id on the payment. */
  order?: { id?: string | null; type?: string | null } | null;
};

/**
 * Medusa's getWebhookActionAndData expects one of these action strings (a
 * subset of PaymentActions in @medusajs/framework/utils).
 *
 * Note: there is no "refunded" or "required_action" — refunds are processed via
 * the Refund workflow, not via webhooks, and 3DS challenges stay "pending"
 * until MercadoPago resolves them.
 */
export type MedusaWebhookAction =
  | 'authorized'
  | 'captured'
  | 'failed'
  | 'canceled'
  | 'not_supported'
  | 'pending';

/**
 * Maps a MercadoPago payment to the action Medusa should apply on the session.
 *
 * Design decisions for this store:
 *  - Offline vouchers (ticket / atm / bank_transfer) with status=pending mean MP
 *    already accepted the order and is waiting for the customer to pay at the
 *    payment point. We treat those as "authorized" so Medusa creates/keeps the
 *    order and leaves the payment uncaptured.
 *  - When the customer actually pays and MP fires another webhook with
 *    status=approved, we flip to "captured".
 */
export function mapMpPaymentToAction(payment: MpPaymentLike): MedusaWebhookAction {
  switch (payment.status) {
    case 'approved':
      return 'captured';

    case 'authorized':
      // Card with manual capture — funds held, not yet transferred.
      return 'authorized';

    case 'pending': {
      const offlineType =
        payment.payment_type_id === 'ticket' ||
        payment.payment_type_id === 'atm' ||
        payment.payment_type_id === 'bank_transfer';
      const offlineDetail =
        payment.status_detail === 'pending_waiting_payment' ||
        payment.status_detail === 'pending_waiting_transfer';
      if (offlineType || offlineDetail) {
        return 'authorized';
      }
      // pending_challenge (3DS) and other pending states: don't act yet.
      return 'pending';
    }

    case 'in_process':
      // Risk review / contingency — wait for a terminal state.
      return 'pending';

    case 'rejected':
      return 'failed';

    case 'cancelled':
      return 'canceled';

    case 'refunded':
    case 'charged_back':
      // Refunds/chargebacks are handled by the Refund workflow, not the webhook
      // action dispatcher. Return not_supported so the route just logs + acks.
      return 'not_supported';

    default:
      return 'not_supported';
  }
}

/**
 * Maps a MercadoPago payment to the status string used by Medusa's
 * GetPaymentStatusOutput. Narrower set than the webhook actions above.
 */
export function mapMpPaymentToSessionStatus(
  payment: MpPaymentLike,
): 'authorized' | 'captured' | 'pending' | 'error' | 'canceled' | 'requires_more' {
  switch (payment.status) {
    case 'approved':
      return 'captured';
    case 'authorized':
      return 'authorized';
    case 'pending': {
      const offlineType =
        payment.payment_type_id === 'ticket' ||
        payment.payment_type_id === 'atm' ||
        payment.payment_type_id === 'bank_transfer';
      const offlineDetail =
        payment.status_detail === 'pending_waiting_payment' ||
        payment.status_detail === 'pending_waiting_transfer';
      return offlineType || offlineDetail ? 'authorized' : 'pending';
    }
    case 'in_process':
      return 'pending';
    case 'rejected':
      return 'error';
    case 'cancelled':
      return 'canceled';
    default:
      return 'pending';
  }
}

// Re-export Medusa's canonical enum for callers that want it.
export type { PaymentActions };
