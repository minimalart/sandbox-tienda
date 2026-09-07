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

type TechProductCardProps = {
  product: TypesenseProductDocument;
  countryCode: string;
  /** Número de cuotas a mostrar (informativo, derivado del precio). */
  installments?: number;
};

/**
 * Product card del template Tecnología.
 *
 * Más información que una card fashion, menos densidad que supermercado:
 * marca, nombre, precio (con anterior + % off), cuotas, envío, favorito y
 * acción de compra. Estética limpia y premium.
 */
export default function TechProductCard({
  product,
  countryCode,
  installments = 12,
}: TechProductCardProps) {
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
    <article className="tech-home group relative flex h-full w-full flex-col overflow-hidden rounded-3xl border border-[--tech-hairline] bg-white transition hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
      <div className="relative aspect-square overflow-hidden bg-[--tech-parchment]">
        {hasDiscount && discountPercentage > 0 && (
          <span className="absolute left-3 top-3 z-10 inline-flex items-center rounded-full bg-[--tech-blue] px-2.5 py-1 text-[11px] font-semibold text-white">
            {discountPercentage}% OFF
          </span>
        )}
        {!inStock && (
          <span className="absolute left-3 top-3 z-10 inline-flex items-center rounded-full bg-[#6e6e73] px-2.5 py-1 text-[11px] font-semibold uppercase text-white">
            Sin stock
          </span>
        )}
        {product.id && variantId && (
          <WishlistButton
            className="absolute right-3 top-3 z-20 rounded-full border border-[--tech-hairline] bg-white p-1.5 shadow-sm"
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
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[--tech-subtle]">
            {brand}
          </p>
        )}
        <h3 className="mt-0.5 line-clamp-2 min-h-[2.6em] text-[14px] font-medium leading-snug text-[--tech-ink]">
          <LocalizedClientLink
            href={`/products/${product.handle}`}
            className="outline-none hover:underline"
          >
            {product.title}
          </LocalizedClientLink>
        </h3>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-[20px] font-semibold tracking-tight text-[--tech-ink]">
            {priceWithSymbol}
          </span>
          {hasDiscount &&
            promotionType !== "buyget" &&
            formattedOriginalPrice && (
              <span className="text-[12px] text-[--tech-subtle] line-through">
                $ {formattedOriginalPrice}
              </span>
            )}
        </div>

        {installmentAmount && (
          <p className="mt-1 text-[12px] font-medium text-[--tech-blue]">
            {installments} cuotas sin interés de $ {installmentAmount}
          </p>
        )}

        <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-[--tech-muted]">
          <Truck className="size-3.5" /> Envío gratis · Retiro en sucursal
        </p>

        <div className="mt-auto flex items-center gap-2 pt-4">
          <LocalizedClientLink
            href={`/products/${product.handle}`}
            className="tech-btn-primary h-10 flex-1 !px-4 !py-0 text-sm"
          >
            Comprar ahora
          </LocalizedClientLink>
          {inStock ? (
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
          ) : (
            <LocalizedClientLink
              href={`/products/${product.handle}`}
              className="tech-btn-secondary hidden !py-2.5 text-sm"
            >
              Ver producto
            </LocalizedClientLink>
          )}
        </div>
      </div>
    </article>
  );
}
