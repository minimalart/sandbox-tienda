"use client";

import { useCartQuantityForVariant } from "@lib/hooks/use-cart-quantity-for-variant";
import { useProductPromotion } from "@lib/hooks/use-product-promotion";
import type { TypesenseProductDocument } from "@lib/typesense";
import { convertToLocale } from "@lib/util/money";
import { CartQuantitySelector } from "@modules/common/components/cart-quantity-selector";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import WishlistButton from "@modules/common/components/wishlist-button";
import { Truck } from "lucide-react";
import { PLACEHOLDER_IMAGE } from "@lib/util/placeholder-image";
import {
  PRODUCT_IMAGE_FIT_CLASS,
  PRODUCT_IMAGE_HOVER_CLASS,
  PRODUCT_IMAGE_SIZES_GRID_CARD,
} from "@lib/util/product-image-presets";
import ProductImage from "@modules/common/components/product-image";

type TrProductCardProps = {
  product: TypesenseProductDocument;
  countryCode: string;
  /** Número de cuotas a mostrar (informativo, derivado del precio). */
  installments?: number;
};

/**
 * Product card del template Tecnología Retail.
 *
 * La card más informativa del storefront (Frávega / Best Buy): marca, nombre,
 * precio (con anterior + % off), cuotas, envío, favorito y acción de compra.
 * Estética densa pero ordenada, con descuento destacado.
 */
export default function TrProductCard({
  product,
  countryCode,
  installments = 12,
}: TrProductCardProps) {
  const {
    quantity,
    isLoading,
    canAdd,
    canIncrement,
    handleIncrement,
    handleDecrement,
    handleRemove,
    buttonRef,
  } = useCartQuantityForVariant(product, countryCode);

  const {
    hasDiscount,
    discountPercentage,
    priceWithSymbol,
    formattedOriginalPrice,
    promotionType,
  } = useProductPromotion({ product });

  const imageSrc =
    product.thumbnail || product.images?.[0]?.url || PLACEHOLDER_IMAGE;
  const brand = product.brand?.name;
  const inStock = product.stock_available > 0;
  const variantId = product.variants?.[0]?.id ?? null;

  // Cuotas (informativo): el precio numérico dividido en N pagos.
  const installmentAmount =
    typeof product.price === "number" && product.price > 0
      ? convertToLocale({
          amount: product.price / installments,
          currency_code: "ARS",
        })
      : null;

  return (
    <article className="tech-retail-home group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border border-[--tr-hairline] bg-white transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-square overflow-hidden bg-white">
        {hasDiscount && discountPercentage > 0 && (
          <span className="absolute left-2.5 top-2.5 z-10 inline-flex items-center rounded-lg bg-[--tr-red] px-2 py-1 text-[12px] font-extrabold text-white">
            -{discountPercentage}%
          </span>
        )}
        {!inStock && (
          <span className="absolute left-2.5 top-2.5 z-10 inline-flex items-center rounded-lg bg-[--tr-subtle] px-2 py-1 text-[11px] font-bold uppercase text-white">
            Sin stock
          </span>
        )}
        {product.id && variantId && (
          <WishlistButton
            className="absolute right-2.5 top-2.5 z-20 rounded-full border border-[--tr-hairline] bg-white p-1.5 shadow-sm"
            productId={product.id}
            variantId={variantId}
          />
        )}
        <LocalizedClientLink
          href={`/products/${product.handle}`}
          aria-label={product.title}
          className="absolute inset-0"
        >
          <ProductImage
            src={imageSrc}
            alt={product.title ?? "Producto"}
            fill
            sizes={PRODUCT_IMAGE_SIZES_GRID_CARD}
            className={`${PRODUCT_IMAGE_FIT_CLASS} ${PRODUCT_IMAGE_HOVER_CLASS}`}
          />
        </LocalizedClientLink>
      </div>

      <div className="flex flex-1 flex-col p-4">
        {brand && (
          <p className="text-[11px] font-bold uppercase tracking-wide text-[--tr-subtle]">
            {brand}
          </p>
        )}
        <h3 className="mt-0.5 line-clamp-2 min-h-[2.6em] text-[14px] font-medium leading-snug text-[--tr-ink]">
          <LocalizedClientLink
            href={`/products/${product.handle}`}
            className="outline-none hover:underline"
          >
            {product.title}
          </LocalizedClientLink>
        </h3>

        {hasDiscount && promotionType !== "buyget" && formattedOriginalPrice && (
          <span className="mt-2 text-[12px] text-[--tr-subtle] line-through">
            $ {formattedOriginalPrice}
          </span>
        )}
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="text-[22px] font-extrabold tracking-tight text-[--tr-ink]">
            {priceWithSymbol}
          </span>
        </div>

        {installmentAmount && (
          <p className="mt-1 text-[12px] font-bold text-[--tr-blue]">
            {installments} cuotas sin interés de $ {installmentAmount}
          </p>
        )}

        <p className="mt-1 inline-flex items-center gap-1 text-[12px] font-medium text-[#15803d]">
          <Truck className="size-3.5" /> Envío gratis
        </p>

        <div className="mt-auto flex items-center gap-2 pt-4">
          <LocalizedClientLink
            href={`/products/${product.handle}`}
            className="tr-btn-primary h-10 flex-1 !px-4 !py-0 text-sm"
          >
            Comprar
          </LocalizedClientLink>
          {inStock && (
            <div ref={buttonRef} className="shrink-0">
              <CartQuantitySelector
                quantity={quantity}
                onIncrement={handleIncrement}
                onDecrement={handleDecrement}
                onRemove={handleRemove}
                isLoading={isLoading}
                disabled={!canAdd}
                canIncrement={canIncrement}
                size="sm"
              />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
