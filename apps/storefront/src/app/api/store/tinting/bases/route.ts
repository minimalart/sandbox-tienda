import { NextResponse } from "next/server";
import { getActiveSalesChannelId, getCartId } from "@lib/data/cookies";

/**
 * Proxy de "con qué bases se logra este color" (flujo inverso).
 *
 * El canal y el carrito los resuelve el SERVIDOR, no el cliente: el proxy sabe
 * en qué demo está (el middleware reinyecta `x-demo-slug` desde la cookie en las
 * rutas /api) y tiene la cookie del carrito, así el mayorista ve su lista de
 * precios sin que el navegador pueda pedir la de otro.
 *
 * Sin caché: la respuesta depende de región, canal y grupos del cliente.
 *
 * **Un fallo del backend degrada, no se reenvía crudo.** El status del backend
 * se reenvía SÓLO cuando trae un `message` propio ("El sistema tintométrico no
 * está disponible", "Falta color_code"): esos son diagnósticos ciertos que la
 * pantalla puede mostrar. Un error de gateway (504/502/503) llega con un body
 * que no es JSON, así que el `.catch()` del parseo devuelve un objeto SIN
 * `message`, y reenviarlo dejaba a la pantalla cayendo a su literal genérico
 * —sin decir que era pasajero y sin ofrecer reintentar—. Pasó de verdad: el
 * 2026-09-03, entre 13:26 y 13:31 UTC, el gateway del backend devolvió 504 a
 * doce requests seguidos y el buscador de color quedó en un callejón sin salida.
 */

/**
 * Techo propio para la llamada al backend. Sin esto, un backend colgado se
 * come el presupuesto entero de la función y el cliente recibe la página de
 * error de Vercel en vez de JSON: ni el mensaje degradado ni el reintento.
 * 12s deja margen sobre el peor caso medido (~5s con el contexto de precios
 * frío) y entra cómodo abajo del límite de la función.
 */
const BACKEND_TIMEOUT_MS = 12_000;

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const colorCode = params.get("color_code") ?? "";
  const collection = params.get("collection") ?? "";
  const countryCode = params.get("country_code") ?? "";

  if (!colorCode || !collection) {
    return NextResponse.json(
      { message: "Faltan color_code y collection." },
      { status: 400 },
    );
  }

  try {
    const [salesChannelId, cartId] = await Promise.all([
      getActiveSalesChannelId(),
      getCartId(),
    ]);

    const qs = new URLSearchParams({ color_code: colorCode, collection });
    if (countryCode) qs.set("country_code", countryCode);
    if (salesChannelId) qs.set("sales_channel_id", salesChannelId);
    if (cartId) qs.set("cart_id", cartId);

    const res = await fetch(`${BACKEND_URL}/store/tinting/bases?${qs.toString()}`, {
      headers: PUBLISHABLE_KEY ? { "x-publishable-api-key": PUBLISHABLE_KEY } : {},
      cache: "no-store",
      signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
    });
    const data = await res.json().catch(() => null);

    if (res.ok) return NextResponse.json(data ?? { color: null, lines: [] });

    // Un error CON mensaje es un diagnóstico del backend y viaja tal cual. Uno
    // sin mensaje es el gateway, y ahí el único dato cierto es "no ahora".
    const message =
      data && typeof (data as { message?: unknown }).message === "string"
        ? (data as { message: string }).message
        : null;
    if (message) {
      return NextResponse.json(data, { status: res.status });
    }

    console.warn(`[tinting] bases: el backend respondió ${res.status} sin mensaje`);
    return degraded();
  } catch (error) {
    console.warn("[tinting] bases proxy error:", error);
    return degraded();
  }
}

/**
 * Degradado, no 500: la carta sigue en pantalla, el mensaje dice que es
 * pasajero y `degraded` le habilita el reintento a la pantalla.
 */
function degraded(): Response {
  return NextResponse.json(
    {
      message: "No pudimos buscar los productos para ese color en este momento.",
      degraded: true,
    },
    { status: 424 },
  );
}
