import { NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

// El mínimo de compra cambia muy de vez en cuando; cacheamos 60s en el server
// y la CDN absorbe los hits repetidos del browser.
//
// TTL compartido CORRECTO: el monto mínimo es de la INSTANCIA, no de un sitio (el
// handler no acepta slug ni sales_channel_id), así que no hay nada que pueda
// filtrarse entre tiendas. Está en la allowlist de
// `lib/site-config/cache-directives.test.ts` con este motivo.
export const revalidate = 60;

/**
 * GET /api/store/minimum-purchase
 *
 * Proxy server-side al backend (GET /store/minimum-purchase). Igual que el resto
 * de las llamadas al store, va por el servidor de Next: así no depende de CORS
 * ni de que el browser pueda alcanzar la URL del backend (que en prod puede ser
 * interna). El fetch directo desde el browser era la razón por la que el mínimo
 * nunca llegaba y el carrito caía al default sin mínimo.
 *
 * Devuelve: { minimum_purchase: { amount, currency_code, starts_at, ends_at } | null }
 */
export async function GET(): Promise<Response> {
  try {
    const res = await fetch(`${BACKEND_URL}/store/minimum-purchase`, {
      headers: PUBLISHABLE_KEY
        ? { "x-publishable-api-key": PUBLISHABLE_KEY }
        : {},
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      return NextResponse.json({ minimum_purchase: null });
    }

    const data = await res.json();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.warn("[MINIMUM-PURCHASE] Error fetching minimum purchase:", error);
    return NextResponse.json({ minimum_purchase: null });
  }
}
