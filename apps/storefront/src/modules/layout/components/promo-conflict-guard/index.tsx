"use client";

import { useDisneyPromoState } from "@lib/hooks/use-disney-promo-state";
import { useCartStore } from "@lib/stores/cart.store";
import {
  isDisneyGiftDiscountApplied,
  VELEZ_PROMO_CODE,
} from "@lib/util/disney-promo";
import { toast } from "@medusajs/ui";
import { useEffect, useRef } from "react";

/**
 * Watcher global del carrito que enforce la regla "AROMATIZATUPASION no
 * acumulable". Si el cupón Velez está aplicado y aparece OTRA promo activa
 * en el carrito —automática (Mundial), Disney desbloqueada, o cualquier
 * otra que el back agregue en `cart.promotions`— lo quita y notifica con
 * toast.
 *
 * Vive en los layouts (main y checkout) porque las promos automáticas
 * pueden activarse fuera del checkout (ej. agregando productos en /store),
 * donde `<DiscountCode />` no está montado.
 *
 * TODO(promotions): regla hardcoded. La exclusividad correcta debería
 * vivir en el back como una `rule` de la propia promotion (workflow de
 * Medusa / admin), para que comercial pueda configurar el "no acumulable"
 * sin tocar el storefront. Migrar cuando se defina el modelo de
 * exclusividad en admin.
 */
export default function PromoConflictGuard() {
  const cart = useCartStore((s) => s.cart);
  const setCart = useCartStore((s) => s.setCart);
  // Disney promo removed — stub yields null promotion
  const disneyState = useDisneyPromoState(null, cart?.items ?? []);
  const disneyDiscountApplied = isDisneyGiftDiscountApplied(
    cart?.items,
    disneyState,
  );
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!cart || inFlightRef.current) return;
    const promotions = (cart.promotions ?? []) as Array<{
      code?: string | null;
      is_automatic?: boolean | null;
    }>;
    const velezApplied = promotions.some(
      (p) => p?.code === VELEZ_PROMO_CODE,
    );
    if (!velezApplied) return;

    const hasOtherActivePromo =
      promotions.some((p) => p?.code && p.code !== VELEZ_PROMO_CODE) ||
      disneyDiscountApplied;
    if (!hasOtherActivePromo) return;

    inFlightRef.current = true;
    const remaining = promotions
      .filter(
        (p) => p && p.code && p.code !== VELEZ_PROMO_CODE && !p.is_automatic,
      )
      .map((p) => p.code as string);

    fetch("/api/store/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "applyPromotion", codes: remaining }),
    })
      .then((r) => r.json().catch(() => ({})))
      .then((data) => {
        if (!data?.success || !data?.cart) return;
        setCart(data.cart);
        toast.warning("Cupón quitado", {
          description:
            "Se quitó AROMATIZATUPASION porque no es acumulable con otras promociones activas.",
        });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("cart-updated"));
        }
      })
      .finally(() => {
        inFlightRef.current = false;
      });
  }, [cart, disneyDiscountApplied, setCart]);

  return null;
}
