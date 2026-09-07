"use client";

import { useChannelPricing } from "@lib/context/channel-context";
import { getProductPrice } from "@lib/util/get-product-price";
import type { HttpTypes } from "@medusajs/types";
import { clx } from "@medusajs/ui";

export default function ChannelProductPrice({
  product,
  variant,
  showInventory = false,
}: {
  product: HttpTypes.StoreProduct;
  variant?: HttpTypes.StoreProductVariant;
  showInventory?: boolean;
}) {
  const { shouldShowSpecialPricing } = useChannelPricing();
  const { cheapestPrice, variantPrice } = getProductPrice({
    product,
    variantId: variant?.id,
  });

  const selectedPrice = variant ? variantPrice : cheapestPrice;

  if (!selectedPrice) {
    return <div className="block h-9 w-32 animate-pulse bg-gray-100" />;
  }

  // Para el canal, siempre mostramos precios especiales si están disponibles
  const displayPrice = selectedPrice;

  return (
    <div className="flex flex-col text-ui-fg-base">
      <div className="flex items-center gap-2">
        <span
          className={clx("font-semibold text-xl-semi", {
            "text-[--primary-color]": displayPrice.price_type === "sale",
            "text-gray-900": displayPrice.price_type !== "sale",
          })}
        >
          {!variant && "Desde "}
          <span
            data-testid="channel-product-price"
            data-value={displayPrice.calculated_price_number}
          >
            {displayPrice.calculated_price}
          </span>
        </span>

        {/* Indicador de precio especial */}
        {shouldShowSpecialPricing && displayPrice.price_type === "sale" && (
          <span className="rounded bg-ui-bg-interactive px-2 py-1 text-ui-fg-on-color text-xs">
            Precio Especial
          </span>
        )}
      </div>

      {displayPrice.price_type === "sale" && (
        <>
          <p className="text-sm">
            <span className="text-ui-fg-subtle">Precio regular: </span>
            <span
              className="line-through"
              data-testid="original-channel-price"
              data-value={displayPrice.original_price_number}
            >
              {displayPrice.original_price}
            </span>
          </p>
          <span className="font-medium text-[--primary-color]">
            Ahorro: {displayPrice.percentage_diff}%
          </span>
        </>
      )}

      {/* Mostrar información de inventario si está habilitada */}
      {showInventory && variant?.inventory_quantity != null && (
        <div className="mt-2 text-sm">
          <span
            className={clx("font-medium", {
              "text-[--primary-color]": (variant.inventory_quantity ?? 0) > 0,
              "text-ui-fg-error": (variant.inventory_quantity ?? 0) === 0,
            })}
          >
            {(variant.inventory_quantity ?? 0) > 0
              ? `${variant.inventory_quantity} disponibles`
              : "Sin stock"}
          </span>
        </div>
      )}
    </div>
  );
}
