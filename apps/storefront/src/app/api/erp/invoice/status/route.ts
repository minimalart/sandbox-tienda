import { NextRequest, NextResponse } from "next/server"
import { getAuthHeaders } from "@lib/data/cookies"

/**
 * GET /api/erp/invoice/status?orderId=... — ¿hay comprobante descargable?
 *
 * Proxy de metadatos (no del archivo). Va aparte de la descarga para que el
 * botón sepa si dibujarse sin bajar un PDF de un par de cientos de KB en cada
 * visita al detalle del pedido.
 *
 * La autorización la hace el backend: un `orderId` ajeno vuelve como "no
 * disponible", nunca con datos.
 */
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId")?.trim()
  const unavailable = { available: false, label: null, fecha: null }
  if (!orderId) return NextResponse.json(unavailable)

  const authHeaders = await getAuthHeaders()
  if (!("authorization" in authHeaders)) return NextResponse.json(unavailable)

  const backendUrl =
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
  try {
    const upstream = await fetch(
      `${backendUrl}/store/erp/invoices/${encodeURIComponent(orderId)}`,
      {
        headers: {
          ...authHeaders,
          ...(process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY
            ? { "x-publishable-api-key": process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY }
            : {}),
        },
        cache: "no-store",
      }
    )
    if (!upstream.ok) return NextResponse.json(unavailable)
    return NextResponse.json(await upstream.json())
  } catch {
    // El ERP puede no estar instalado en esta tienda: no es un error del pedido.
    return NextResponse.json(unavailable)
  }
}
