import "server-only";
import { sdk } from "@lib/config";
import { getAuthHeaders } from "@lib/data/cookies";

/**
 * Creates a MercadoPago Checkout API payment on the backend from the tokenized
 * Payment Brick payload. Auth headers are forwarded so logged-in customers can
 * have the card saved to their MP account holder.
 */
export async function createMercadopagoPayment(body: {
  paymentSessionId: string;
  cart_id: string;
  paymentData: Record<string, unknown>;
  device_session_id?: string;
}): Promise<{ status: string | null; payment_id: string | null }> {
  const headers = await getAuthHeaders();
  return sdk.client.fetch("/store/mercadopago/payment", {
    method: "POST",
    body,
    headers,
  });
}
