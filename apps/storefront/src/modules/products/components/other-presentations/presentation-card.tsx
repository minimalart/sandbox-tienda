"use client";

import { useCartQuantityForVariant } from "@lib/hooks/use-cart-quantity-for-variant";
import { useProductPromotion } from "@lib/hooks/use-product-promotion";
import type { TypesenseProductDocument } from "@lib/typesense";
import DisneyBadge from "@modules/common/components/disney-badge";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { ShoppingCartIcon } from "@heroicons/react/24/outline";
import { PLACEHOLDER_IMAGE } from "@lib/util/placeholder-image";
import ProductImage from "@modules/common/components/product-image";

type PresentationCardProps = {
  product: TypesenseProductDocument;
  countryCode: string;
};

export default function PresentationCard({
  product,
  countryCode,
}: PresentationCardProps) {
  const {
    quantity,
    isLoading,
    canAdd,
    canIncrement,
    handleIncrement,
    buttonRef,
  } = useCartQuantityForVariant(product, countryCode);

  const { priceWithSymbol } = useProductPromotion({ product });

  const inStock = product.stock_available > 0;
  const imageSrc =
    product.thumbnail || product.images?.[0]?.url || PLACEHOLDER_IMAGE;
  const description = product.description || product.subtitle || "";

  return (
    <LocalizedClientLink
      href={`/products/${product.handle}`}
      className={`flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-3 transition-shadow hover:shadow-md ${!inStock ? "opacity-60" : ""}`}
    >
      <div className="relative h-[80px] w-[80px] flex-shrink-0 overflow-hidden rounded-xl bg-[#F6F6F6]">
        <ProductImage
          alt={product.title ?? "Producto"}
          className="object-contain product-image-blend"
          fill
          sizes="80px"
          src={imageSrc}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="truncate font-semibold text-[13px] text-gray-900 leading-tight">
            {product.title}
          </h3>
          <DisneyBadge productId={product.id} />
        </div>
        <p className="line-clamp-2 text-[11px] text-gray-500 leading-snug">
          {description}
        </p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="font-semibold text-[14px] text-gray-900 whitespace-nowrap">
            {priceWithSymbol}
          </p>
          {inStock && (
            <div ref={buttonRef}>
              <button
                aria-label="Agregar al carrito"
                className="relative flex h-8 w-8 items-center justify-center rounded-full border border-[--primary-color] bg-[--primary-color] text-white transition-colors hover:opacity-90 disabled:opacity-40"
                // NO deshabilitar durante isLoading: handleIncrement ya encola /
                // deltea los clicks rápidos, y el sync está debounced. El
                // disabled bloqueaba el clickeo rápido. Sí lo deshabilitamos en
                // el techo de stock: seguir clickeando no suma nada y antes
                // terminaba en un rollback al valor inicial.
                disabled={!canAdd || !canIncrement}
                title={!canIncrement ? "No hay más stock disponible" : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleIncrement();
                }}
                type="button"
              >
                {quantity > 0 ? (
                  // Mostrar el número aunque esté sincronizando (no el spinner):
                  // así el clickeo rápido no "parpadea" a un spinner.
                  <span className="flex h-full w-full items-center justify-center rounded-full bg-[--primary-color] font-bold text-white text-xs">
                    {quantity}
                  </span>
                ) : isLoading ? (
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
                ) : (
                  <ShoppingCartIcon className="h-4 w-4 text-white" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </LocalizedClientLink>
  );
}
