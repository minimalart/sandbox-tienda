import { NextRequest, NextResponse } from "next/server"
import { getAuthHeaders } from "@lib/data/cookies"

/**
 * GET /api/erp/invoice?orderId=... — proxy same-origin del comprobante del
 * pedido.
 *
 * Por qué un proxy y no un link directo al backend: el PDF vive en un bucket
 * privado y sólo se sirve por una ruta autenticada del backend
 * (`/store/erp/invoices/:order_id/download`). El token del cliente vive en una
 * cookie httpOnly que el browser no puede leer, así que la petición al backend
 * tiene que armarse server-side. Mismo patrón que
 * `src/app/api/pdf-catalog/file/route.ts`.
 *
 * NO acepta URLs del cliente: sólo un `orderId`. La autorización real la hace
 * el backend (verifica que la orden sea del customer autenticado), así que un
 * `orderId` ajeno responde 404 y no filtra nada.
 */
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId")?.trim()
  if (!orderId) {
    return NextResponse.json({ message: "Falta el pedido." }, { status: 400 })
  }

  const backendUrl =
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"
  const authHeaders = await getAuthHeaders()
  if (!("authorization" in authHeaders)) {
    return NextResponse.json(
      { message: "Iniciá sesión para descargar el comprobante." },
      { status: 401 }
    )
  }

  const upstream = await fetch(
    `${backendUrl}/store/erp/invoices/${encodeURIComponent(orderId)}/download`,
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

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { message: "El comprobante todavía no está disponible." },
      { status: upstream.status === 404 ? 404 : 502 }
    )
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": "application/pdf",
      // `private`: es un documento fiscal con nombre y CUIT adentro; no puede
      // quedar en una cache compartida.
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": `inline; filename="comprobante-${orderId}.pdf"`,
    },
  })
}
