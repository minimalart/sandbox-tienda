"use client";

import type { HttpTypes } from "@medusajs/types";
import { useAddToCartAnimation } from "@lib/context/add-to-cart-animation";
import { useCartStore } from "@lib/stores/cart.store";
import { useUIStore } from "@lib/stores/ui.store";
import { useWishlistDrawerStore } from "@lib/stores/wishlist-drawer.store";
import BottomNav from "@modules/layout/components/bottom-nav";
import MobileMenu from "@modules/layout/components/mobile-menu";

type MobileNavControllerProps = {
  customer?: HttpTypes.StoreCustomer | null;
  /** Tintométrico prendido y con carta cargada: habilita el link del menú. */
  hasTinting?: boolean;
  hasSpaceDesigner?: boolean;
};

const MobileNavController = ({
  customer = null,
  hasTinting = false,
  hasSpaceDesigner = false,
}: MobileNavControllerProps) => {
  const { cartBounce } = useAddToCartAnimation();
  const isMobileMenuOpen = useUIStore((s) => s.isMobileMenuOpen);
  const isQuickViewOpen = useUIStore((s) => s.isQuickViewOpen);
  const openMobileMenu = useUIStore((s) => s.openMobileMenu);
  const closeMobileMenu = useUIStore((s) => s.closeMobileMenu);
  const isWishlistDrawerOpen = useWishlistDrawerStore((s) => s.isOpen);

  // Zustand cart store - subscribe to cart so we re-render on hydration
  const isOpen = useCartStore((state) => state.isOpen);
  const openCart = useCartStore((state) => state.openCart);
  const cart = useCartStore((state) => state.cart);

  const cartCount = cart?.items?.reduce((sum, item) => sum + item.quantity, 0) ?? 0;

  return (
    <>
      <BottomNav
        cartCount={cartCount}
        cartBounce={cartBounce}
        hasTinting={hasTinting}
        hidden={
          isMobileMenuOpen ||
          isOpen ||
          isWishlistDrawerOpen ||
          isQuickViewOpen
        }
        onCartClick={openCart}
        onMenuClick={openMobileMenu}
      />

      <MobileMenu
        customer={customer}
        hasTinting={hasTinting}
        hasSpaceDesigner={hasSpaceDesigner}
        open={isMobileMenuOpen}
        onClose={closeMobileMenu}
      />
    </>
  );
};

export default MobileNavController;
