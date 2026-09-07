import { NextRequest, NextResponse } from "next/server";
import { getActivePdfCatalog } from "@lib/data/pdf-catalog";

/**
 * GET /api/pdf-catalog/file?countryCode=ar — proxy same-origin del PDF del
 * catálogo activo. El bucket (DO Spaces) no manda headers CORS, así que
 * react-pdf no puede fetchear la URL pública desde el browser; acá el fetch
 * es server-side (sin CORS) y se streamea la respuesta.
 *
 * No acepta URLs del cliente (sin riesgo de SSRF): resuelve el catálogo
 * activo del canal actual y usa su pdf_url.
 */
export async function GET(req: NextRequest) {
  const countryCode = req.nextUrl.searchParams.get("countryCode") ?? "";
  const catalog = await getActivePdfCatalog(countryCode);

  if (!catalog?.pdf_url) {
    return NextResponse.json({ message: "No active catalog" }, { status: 404 });
  }

  // no-store: los PDFs pueden superar el límite del data cache de Next; el
  // caching queda en el browser vía Cache-Control.
  const upstream = await fetch(catalog.pdf_url, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ message: "PDF unavailable" }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": "application/pdf",
      "Cache-Control": "public, max-age=300",
    },
  });
}
