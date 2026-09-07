"use client"

import { useState } from "react"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@medusajs/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { ChevronLeft } from "lucide-react"

interface OrderDetailsTemplateProps {
  order: HttpTypes.StoreOrder
}

export default function OrderDetailsTemplate({ order }: OrderDetailsTemplateProps) {
  const [isLoading, setIsLoading] = useState(false)

  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="flex items-center gap-2">
        <LocalizedClientLink href="/account/orders">
          <Button variant="secondary" className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Volver
          </Button>
        </LocalizedClientLink>
      </div>
      
      <h1 className="text-2xl font-bold">
        Pedido #{order.custom_display_id ?? order.display_id}
      </h1>
      
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Detalles del pedido</h2>
          <div className="grid gap-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Estado:</span>
              <span className="font-medium capitalize">{order.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Fecha:</span>
              <span className="font-medium">
                {new Date(order.created_at).toLocaleDateString("es-AR")}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total:</span>
              <span className="font-medium">
                ${order.total?.toFixed(2)} {order.currency_code?.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Productos</h2>
          <div className="flex flex-col gap-4">
            {order.items?.map((item) => (
              <div key={item.id} className="flex items-center gap-4 border-b border-gray-100 pb-4 last:border-0">
                <div className="flex-1">
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-gray-600">
                    Cantidad: {item.quantity}
                  </p>
                </div>
                <p className="font-medium">
                  ${(item.total ?? 0).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
