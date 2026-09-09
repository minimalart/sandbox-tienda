import {
  addB2BLineItems,
  applyB2BPromotions,
  initiateB2BPayment,
  listB2BPaymentProviders,
  listB2BShippingOptions,
  placeB2BOrder,
  removeB2BLineItem,
  retrieveB2BCart,
  setB2BCartAddress,
  setB2BShippingMethod,
  syncB2BCartLines,
  updateB2BLineItem,
} from "@lib/data/b2b-cart";
import { setB2BCartId, removeB2BCartId } from "@lib/data/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Route handler del carrito/checkout B2B. Se llama desde el cliente vía /api (no
 * como server action) para esquivar el rewrite del middleware que rompía las
 * acciones POST.
 *
 * IMPORTANTE — cómo se setea la cookie `_b2b_cart_id`:
 * Como el handler LEE cookies vía `next/headers` (getB2BCartId), ese es el store
 * autoritativo de la respuesta. Setear la cookie en un `NextResponse.json` aparte
 * (`res.cookies.set`) NO propaga el Set-Cookie. Hay que setearla con el mismo
 * `cookies()` de next/headers. Y con `path: "/"` explícito: si no, como la request
 * es a /api/b2b/cart, el browser scopea la cookie a /api/b2b y nunca llega a
 * /b2b/checkout (→ el checkout no encuentra el carrito y rebota a /nuevo).
 */
/** Devuelve el carrito B2B actual (para precargar el order builder al editar). */
export async function GET(): Promise<NextResponse> {
  const cart = await retrieveB2BCart();
  return NextResponse.json({ cart });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = await req.json().catch(() => ({}));

  switch (body.action) {
    case "add": {
      const r = await addB2BLineItems(body.countryCode, body.lines ?? [], body.company);
      if (r.ok && "cartId" in r && r.cartId) {
        await setB2BCartId(r.cartId);
      }
      return NextResponse.json(r);
    }
    case "sync": {
      const r = await syncB2BCartLines(body.countryCode, body.lines ?? [], body.company);
      if (r.ok && "cartId" in r && r.cartId) {
        await setB2BCartId(r.cartId);
      }
      return NextResponse.json(r);
    }
    case "update":
      return NextResponse.json(await updateB2BLineItem(body.lineId, body.quantity));
    case "remove":
      return NextResponse.json(await removeB2BLineItem(body.lineId));
    case "address":
      return NextResponse.json(await setB2BCartAddress(body.address, body.email));
    case "shipping-options":
      return NextResponse.json({ options: await listB2BShippingOptions() });
    case "set-shipping":
      return NextResponse.json(await setB2BShippingMethod(body.optionId));
    case "promotion":
      return NextResponse.json(await applyB2BPromotions(body.codes ?? []));
    case "payment-providers":
      return NextResponse.json({ providers: await listB2BPaymentProviders() });
    case "init-payment":
      return NextResponse.json(await initiateB2BPayment(body.providerId));
    case "place-order": {
      const r = await placeB2BOrder();
      if (r.ok) await removeB2BCartId();
      return NextResponse.json(r);
    }
    default:
      return NextResponse.json({ ok: false, error: "Acción desconocida" }, { status: 400 });
  }
}
