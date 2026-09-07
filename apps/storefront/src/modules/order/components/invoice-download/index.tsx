"use client"

import { useEffect, useState } from "react"
import { FileText } from "lucide-react"

/**
 * Botón de descarga del comprobante fiscal del pedido.
 *
 * Primero PREGUNTA si el comprobante existe (`/api/erp/invoice/status`) y sólo
 * después se dibuja. La alternativa —mostrar siempre el botón— daría 404 en
 * todos los pedidos anteriores a la integración y en los que el ERP todavía no
 * facturó, que son la mayoría durante los primeros minutos de cada pedido.
 *
 * La descarga va por un proxy same-origin: el PDF vive en un bucket privado y
 * el backend lo sirve por una ruta autenticada, con el token en una cookie
 * httpOnly que el browser no puede leer.
 */
export default function InvoiceDownload({ orderId }: { orderId: string }) {
  const [invoice, setInvoice] = useState<{ label: string | null } | null>(null)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch(
          `/api/erp/invoice/status?orderId=${encodeURIComponent(orderId)}`,
          { cache: "no-store" }
        )
        if (!res.ok) return
        const data = (await res.json()) as { available?: boolean; label?: string | null }
        if (!cancelled && data?.available) setInvoice({ label: data.label ?? null })
      } catch {
        // Sin comprobante disponible no se muestra nada: es el estado normal de
        // un pedido recién hecho, no un error que valga la pena mostrarle a
        // nadie.
      }
    }
    void check()
    return () => {
      cancelled = true
    }
  }, [orderId])

  if (!invoice) return null

  const download = async () => {
    setDownloading(true)
    try {
      const res = await fetch(`/api/erp/invoice?orderId=${encodeURIComponent(orderId)}`, {
        cache: "no-store",
      })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, "_blank")
      // Sin el revoke el blob queda en memoria toda la sesión.
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <button
      className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 font-medium text-sm transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={downloading}
      onClick={download}
      type="button"
    >
      <FileText className="h-4 w-4" />
      {invoice.label ? `Descargar ${invoice.label}` : "Descargar comprobante"}
    </button>
  )
}
