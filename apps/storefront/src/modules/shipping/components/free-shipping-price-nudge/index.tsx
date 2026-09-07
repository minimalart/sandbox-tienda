"use client";

import { useCartStore } from "@lib/stores/cart.store";
import { convertToLocale } from "@lib/util/money";
import {
  deriveFreeShippingTarget,
  type FreeShippingTarget,
} from "@lib/util/free-shipping-target";
import {
  FLOATING_LAYER,
  floatingObstacle,
} from "@lib/util/floating-obstacle";
import { CheckCircleSolid, XMark } from "@medusajs/icons";
import type { StoreCart, StoreCartShippingOption } from "@medusajs/types";
import { Button, clx } from "@medusajs/ui";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { usePathname } from "next/navigation";
import { useState } from "react";

/**
 * Nudge de envío gratis. El umbral lo deriva `deriveFreeShippingTarget` (util core), que
 * es la única fuente de verdad: sale de las shipping options reales del carrito.
 *
 * La variante `popup` es la que está montada globalmente en el layout. Se SUPRIME en
 * `/cart` y mientras el drawer del carrito está abierto, porque en esas dos situaciones
 * ya se muestra la barra inline y dos indicadores de envío gratis simultáneos en
 * pantalla es el modo de falla a evitar. Cede el popup, que es el menos contextual.
 */
export default function ShippingPriceNudge({
  variant = "inline",
  cart,
  shippingOptions,
}: {
  variant?: "popup" | "inline";
  cart: StoreCart;
  shippingOptions: StoreCartShippingOption[];
}) {
  const pathname = usePathname();
  const isCartDrawerOpen = useCartStore((state) => state.isOpen);

  const target = deriveFreeShippingTarget(cart, shippingOptions);

  if (!target) {
    return null;
  }

  if (variant === "popup") {
    if (pathname?.endsWith("/cart") || isCartDrawerOpen) {
      return null;
    }
    return <FreeShippingPopup cart={cart} target={target} />;
  }
  return <FreeShippingInline cart={cart} target={target} />;
}

function FreeShippingInline({
  cart,
  target,
}: {
  cart: StoreCart;
  target: FreeShippingTarget;
}) {
  const price = {
    target_reached: target.reached,
    target_remaining: target.remaining,
    remaining_percentage: target.progress * 100,
  };
  return (
    <div className="rounded-lg border bg-neutral-100 p-2">
      <div className="space-y-1.5">
        <div className="flex justify-between text-neutral-600 text-xs">
          <div>
            {price.target_reached ? (
              <div className="flex items-center gap-1.5">
                <CheckCircleSolid className="inline-block text-green-500" />{" "}
                ¡Envío gratis desbloqueado!
              </div>
            ) : (
              "Desbloqueá el envío gratis"
            )}
          </div>

          <div
            className={clx("visible", {
              "invisible opacity-0": price.target_reached,
            })}
          >
            Te faltan{" "}
            <span className="text-neutral-950">
              {convertToLocale({
                amount: price.target_remaining,
                currency_code: cart.currency_code,
              })}
            </span>
          </div>
        </div>
        <div className="flex justify-between gap-1">
          <div
            className={clx(
              "h-1 max-w-full rounded-full bg-gradient-to-r from-zinc-400 to-zinc-500 duration-500 ease-in-out",
              {
                "from-green-400 to-green-500": price.target_reached,
              }
            )}
            style={{ width: `${price.remaining_percentage}%` }}
          />
          <div className="h-1 w-fit flex-grow rounded-full bg-neutral-300" />
        </div>
      </div>
    </div>
  );
}

function FreeShippingPopup({
  cart,
  target,
}: {
  cart: StoreCart;
  target: FreeShippingTarget;
}) {
  const [isClosed, setIsClosed] = useState(false);
  const price = {
    target_reached: target.reached,
    target_remaining: target.remaining,
    remaining_percentage: target.progress * 100,
  };

  return (
    <div
      {...floatingObstacle("free-shipping-nudge", FLOATING_LAYER.tray)}
      className={clx(
        "fixed right-5 bottom-5 z-10 flex flex-col items-end gap-2 transition-all duration-500 ease-in-out",
        {
          "invisible opacity-0 delay-1000": price.target_reached,
          "invisible opacity-0": isClosed,
          "visible opacity-100": !(price.target_reached || isClosed),
        }
      )}
    >
      <div>
        <Button
          className="rounded-full border-none bg-neutral-900 p-2 text-[15px] shadow-none outline-none"
          onClick={() => setIsClosed(true)}
        >
          <XMark />
        </Button>
      </div>

      <div className="w-[400px] rounded-lg bg-black p-6 text-white">
        <div className="pb-4">
          <div className="space-y-3">
            <div className="flex justify-between text-[15px] text-neutral-400">
              <div>
                {price.target_reached ? (
                  <div className="flex items-center gap-1.5">
                    <CheckCircleSolid className="inline-block text-green-500" />{" "}
                    ¡Envío gratis desbloqueado!
                  </div>
                ) : (
                  "Desbloqueá el envío gratis"
                )}
              </div>

              <div
                className={clx("visible", {
                  "invisible opacity-0": price.target_reached,
                })}
              >
                Te faltan{" "}
                <span className="text-white">
                  {convertToLocale({
                    amount: price.target_remaining,
                    currency_code: cart.currency_code,
                  })}
                </span>
              </div>
            </div>
            <div className="flex justify-between gap-1">
              <div
                className={clx(
                  "h-1.5 max-w-full rounded-full bg-gradient-to-r from-zinc-400 to-zinc-500 duration-500 ease-in-out",
                  {
                    "from-green-400 to-green-500": price.target_reached,
                  }
                )}
                style={{ width: `${price.remaining_percentage}%` }}
              />
              <div className="h-1.5 w-fit flex-grow rounded-full bg-zinc-600" />
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <LocalizedClientLink
            className="rounded-2xl border-[1px] border-white bg-transparent px-4 py-2.5 text-[15px] shadow-none outline-none"
            href="/cart"
          >
            Ver carrito
          </LocalizedClientLink>

          <LocalizedClientLink
            className="flex-grow rounded-2xl border-[1px] border-white bg-white px-4 py-2.5 text-center text-[15px] text-neutral-950 shadow-none outline-none"
            href="/store"
          >
            Ver productos
          </LocalizedClientLink>
        </div>
      </div>
    </div>
  );
}
