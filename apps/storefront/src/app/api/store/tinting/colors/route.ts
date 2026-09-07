import { NextResponse } from "next/server";

/**
 * Proxy de la carta de colores entonables de una base. La carta cambia cuando
 * alguien importa colores, no por pedido, así que se cachea del lado del cliente
 * con el `Cache-Control` que ya manda el backend.
 */

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

export async function GET(request: Request): Promise<Response> {
  const variantId = new URL(request.url).searchParams.get("variant_id") ?? "";
  if (!variantId) {
    return NextResponse.json({ tintable: false, colors: [] });
  }

  try {
    const res = await fetch(
      `${BACKEND_URL}/store/tinting/colors?variant_id=${encodeURIComponent(variantId)}`,
      {
        headers: PUBLISHABLE_KEY ? { "x-publishable-api-key": PUBLISHABLE_KEY } : {},
        next: { revalidate: 300 },
      },
    );
    const data = await res.json().catch(() => ({ tintable: false, colors: [] }));
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (error) {
    // Sin carta el PDP vende la base sin entonar: nunca romper el producto.
    console.warn("[tinting] colors proxy error:", error);
    return NextResponse.json({ tintable: false, colors: [] });
  }
}
