"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/20/solid";
import { useDisneyPromoState } from "@lib/hooks/use-disney-promo-state";
import { useCartStore } from "@lib/stores/cart.store";
import {
  getDisneyAdjustedCartTotals,
} from "@lib/util/disney-promo";
import { getHiddenProductAdjustedCartTotals } from "@lib/util/hidden-product";
import type { HttpTypes } from "@medusajs/types";
import { isLineItemInStock } from "@lib/util/is-line-item-in-stock";
import CartTotals from "@modules/common/components/cart-totals";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
// Slot generado por el composer. Nunca importar `@modules/recommendations/...` desde un
// archivo core: el composer borra esa carpeta en los proyectos sin la extensión.
import { FreeShippingBridge } from "@lib/recommendations-cart-slot";
import { useParams } from "next/navigation";
import { useMemo } from "react";

type SummaryProps = {
  cart: HttpTypes.StoreCart & {
    promotions: HttpTypes.StorePromotion[];
  };
};

function getCheckoutStep(cart: HttpTypes.StoreCart) {
  if (!(cart?.shipping_address?.address_1 && cart.email)) {
    return "address";
  }
  if (cart?.shipping_methods?.length === 0) {
    return "delivery";
  }
  return "payment";
}

const Summary = ({ cart }: SummaryProps) => {
  const { countryCode } = useParams() as { countryCode: string };
  const step = getCheckoutStep(cart);
  const hasOutOfStockItems =
    cart.items?.some((item) => !isLineItemInStock(item)) ?? false;
  // Disney promo removed — stub yields null promotion
  const disneyState = useDisneyPromoState(null, cart.items ?? []);
  const adjustedCart = useMemo(() => {
    const disneyAdjusted =
      getDisneyAdjustedCartTotals(cart, disneyState) ?? cart;
    return getHiddenProductAdjustedCartTotals(disneyAdjusted) ?? disneyAdjusted;
  }, [cart, disneyState]);
  const fetchCart = useCartStore((s) => s.fetchCart);

  const handleRemovePromotion = async (code: string) => {
    const current = (cart.promotions ?? []) as Array<{
      code?: string | null;
      is_automatic?: boolean | null;
    }>;
    const remainingCodes = current
      .filter((p) => p?.code && p.code !== code && !p?.is_automatic)
      .map((p) => p.code as string);
    try {
      const response = await fetch("/api/store/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "applyPromotion",
          codes: remainingCodes,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.cart) {
        useCartStore.setState({ cart: data.cart });
      }
      await fetchCart();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cart-updated"));
      }
    } catch (error) {
      console.error("[SUMMARY] Failed to remove promotion:", error);
      await fetchCart();
    }
  };

  return (
    <>
      <h2 className="font-medium text-gray-900 text-lg" id="summary-heading">
        Resumen de la orden
      </h2>

      {/*
        Barra de envío gratis + productos puente. El slot lo genera el composer: sin la
        extensión `recommendation-widgets` devuelve null. El umbral se deriva de las
        shipping options reales del carrito, nunca de un valor configurado (PRD §17).
      */}
      {cart.region ? (
        <div className="mt-4">
          <FreeShippingBridge
            countryCode={countryCode}
            region={cart.region as HttpTypes.StoreRegion}
          />
        </div>
      ) : null}

      <CartTotals
        totals={adjustedCart}
        promotions={cart.promotions ?? []}
        onRemovePromotion={handleRemovePromotion}
      />

      {hasOutOfStockItems && (
        <div className="mt-4 flex items-start gap-2 rounded-md bg-red-50 p-3 text-red-700 text-sm">
          <ExclamationTriangleIcon className="size-5 shrink-0 text-red-500" />
          <p>
            Hay productos sin stock en tu carrito. Eliminalos para poder
            finalizar la compra.
          </p>
        </div>
      )}
      <div className="mt-6">
        {hasOutOfStockItems ? (
          <button
            className="w-full cursor-not-allowed rounded-md border border-transparent bg-gray-300 px-4 py-3 font-medium text-base text-white shadow-xs"
            disabled
            type="button"
          >
            Finalizar compra
          </button>
        ) : (
          <LocalizedClientLink
            data-testid="checkout-button"
            href={"/checkout?step=" + step}
          >
            {/*
              `type="button"`, NO "submit". Este bloque se renderiza dentro del
              <form> de cart/templates/index.tsx (un form sin action ni
              onSubmit, usado sólo como grilla de layout). Con type="submit" el
              click disparaba el submit del form —un GET a la URL actual— en vez
              de dejar navegar al LocalizedClientLink que lo envuelve: el
              usuario apretaba "Finalizar compra" y se quedaba en /cart sin
              ningún error visible. La variante deshabilitada de arriba ya usaba
              type="button"; esta se había quedado atrás.
            */}
            <button
              className="w-full rounded-md border border-transparent bg-[--primary-color] px-4 py-3 font-medium text-base text-white shadow-xs transition-colors duration-200 ease-in-out hover:bg-[--primary-color] focus:outline-hidden focus:ring-2 focus:ring-[--primary-color] focus:ring-offset-2 focus:ring-offset-gray-50"
              type="button"
            >
              Finalizar compra
            </button>
          </LocalizedClientLink>
        )}
      </div>
    </>
  );
};

export default Summary;
