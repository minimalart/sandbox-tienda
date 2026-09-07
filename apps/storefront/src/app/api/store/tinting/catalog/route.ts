import { NextResponse } from "next/server";

/**
 * Proxy de la carta completa de colores (flujo inverso: color → bases).
 *
 * A diferencia de `/colors`, no depende de ninguna variante: es la carta entera,
 * y cambia sólo cuando alguien importa colores. Se cachea con el mismo criterio.
 */

const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000";
const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY || "";

const EMPTY = { enabled: false, collections: [], colors: [] };

export async function GET(request: Request): Promise<Response> {
  const collection = new URL(request.url).searchParams.get("collection") ?? "";
  const qs = collection ? `?collection=${encodeURIComponent(collection)}` : "";

  try {
    const res = await fetch(`${BACKEND_URL}/store/tinting/catalog${qs}`, {
      headers: PUBLISHABLE_KEY ? { "x-publishable-api-key": PUBLISHABLE_KEY } : {},
      next: { revalidate: 300 },
    });
    const data = await res.json().catch(() => EMPTY);
    return NextResponse.json(data, { status: res.ok ? 200 : res.status });
  } catch (error) {
    // Sin carta la página muestra su empty state; nunca un error.
    console.warn("[tinting] catalog proxy error:", error);
    return NextResponse.json(EMPTY);
  }
}
