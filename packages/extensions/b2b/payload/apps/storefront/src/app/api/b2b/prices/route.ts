import { b2bPrices } from "@lib/data/company";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Route handler para precios mayoristas + stock por lote. Se usa desde el
 * cliente (order builder: cada página de productos que devuelve Typesense) en
 * lugar de invocar el server action directamente: el middleware no reescribe
 * los POST y los server actions terminan sin matchear la ruta [countryCode] →
 * "unexpected response". Los route handlers viven en /api, fuera de ese rewrite.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json().catch(() => null)) as { product_ids?: unknown } | null;
  if (!body || !Array.isArray(body.product_ids)) {
    return NextResponse.json({ error: "product_ids requerido" }, { status: 400 });
  }
  const ids = body.product_ids.filter((id): id is string => typeof id === "string" && !!id);
  const prices = await b2bPrices(ids);
  return NextResponse.json({ prices });
}
