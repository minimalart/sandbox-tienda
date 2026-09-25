'use client'

import { useCartStore } from '@lib/stores/cart.store'
import CartDrawer from '@modules/layout/components/cart-drawer'

export default function CartDrawerMount({
  themeClassName,
  salesChannelId,
}: {
  themeClassName?: string
  /** Canal resuelto en el server layout — scopea las sugerencias del drawer
   *  cuando el árbol no monta ChannelProvider (p. ej. el checkout layout). */
  salesChannelId?: string
} = {}) {
  const isOpen = useCartStore((s) => s.isOpen)
  const closeCart = useCartStore((s) => s.closeCart)

  return (
    <CartDrawer
      onClose={closeCart}
      open={isOpen}
      themeClassName={themeClassName}
      salesChannelId={salesChannelId}
    />
  )
}
