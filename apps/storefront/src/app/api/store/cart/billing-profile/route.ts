import { associateCartBillingProfile } from "@lib/data/billing-profile";
import { ensureCartCustomer } from "@lib/data/cart";
import { getCartId } from "@lib/data/cookies";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  // El cartId se resuelve server-side desde la cookie, no se confía en el cliente.
  const cartId = await getCartId();
  if (!cartId) {
    return NextResponse.json(
      { ok: false, error: "Carrito no disponible." },
      { status: 400 },
    );
  }
  const payload = await request.json();
  // Asociar un perfil guardado exige cart.customer_id === profile.customer_id
  // en el backend; si el cart quedó guest (transfer de login fallido), repararlo.
  if (payload && typeof payload === "object" && "billing_profile_id" in payload) {
    await ensureCartCustomer(cartId);
  }
  const result = await associateCartBillingProfile(cartId, payload);
  return NextResponse.json(result);
}
