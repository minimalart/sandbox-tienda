'use client'

import { useCartStore } from '@lib/stores/cart.store'
import CartDrawer from '@modules/layout/components/cart-drawer'

export default function CartDrawerMount({
  themeClassName,
}: {
  themeClassName?: string
} = {}) {
  const isOpen = useCartStore((s) => s.isOpen)
  const closeCart = useCartStore((s) => s.closeCart)

  return (
    <CartDrawer onClose={closeCart} open={isOpen} themeClassName={themeClassName} />
  )
}
