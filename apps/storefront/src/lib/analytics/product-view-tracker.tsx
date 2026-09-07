'use client'

import { useEffect } from 'react'
import { trackViewItem } from './gtag'

type ProductViewTrackerProps = {
  itemId: string
  itemName: string
  price?: number
  currency?: string
}

/**
 * Dispara el evento `view_item` de GA4 al montar. Se monta dentro del template
 * de producto (server component) para acceder a los datos ya resueltos sin
 * convertir todo el árbol en client. Solo manda datos de producto, sin PII.
 * Recibe primitivos (no un objeto) para que el efecto se re-dispare únicamente
 * cuando cambia el producto observado.
 */
export default function ProductViewTracker({
  itemId,
  itemName,
  price,
  currency,
}: ProductViewTrackerProps) {
  useEffect(() => {
    trackViewItem({
      item: { item_id: itemId, item_name: itemName, price },
      currency,
    })
  }, [itemId, itemName, price, currency])

  return null
}
