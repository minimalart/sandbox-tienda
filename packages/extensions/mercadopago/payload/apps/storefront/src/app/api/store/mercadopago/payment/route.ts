import { createMercadopagoPayment } from "@lib/data/mercadopago";
import { NextResponse } from "next/server";

/**
 * Proxies the tokenized MercadoPago Checkout API payload to the backend
 * `/store/mercadopago/payment`. Surfaces the backend's payment-rejection message
 * (PAYMENT_AUTHORIZATION_ERROR) so the Brick can show it inline.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { paymentSessionId, cart_id, paymentData, device_session_id } = body ?? {};

    if (!paymentSessionId || !cart_id || !paymentData) {
      return NextResponse.json(
        { message: "Faltan datos del pago (paymentSessionId, cart_id, paymentData)." },
        { status: 400 },
      );
    }

    const result = await createMercadopagoPayment({
      paymentSessionId,
      cart_id,
      paymentData,
      device_session_id,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      (error as { message?: string })?.message ||
      "No pudimos procesar el pago. Probá con otra tarjeta.";
    // MP rejections come back as 4xx from the backend; treat as a client error.
    return NextResponse.json({ message }, { status: 402 });
  }
}
