"use client";

import { useProductPromotion } from "@lib/hooks/use-product-promotion";
import type { TypesenseProductDocument } from "@lib/typesense";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import WishlistButton from "@modules/common/components/wishlist-button";
import Image from "next/image";
import { PLACEHOLDER_IMAGE } from "@lib/util/placeholder-image";
import {
  PRODUCT_IMAGE_FIT_CLASS,
  PRODUCT_IMAGE_SIZES_GRID_CARD,
} from "@lib/util/product-image-presets";
import ProductImage from "@modules/common/components/product-image";

type SportsProductCardProps = {
  product: TypesenseProductDocument;
  showWishlist?: boolean;
  /** Se dispara al navegar al PDP (p. ej. para cerrar el overlay de búsqueda). */
  onNavigate?: () => void;
};

/**
 * Product card del template Marca Deportiva.
 *
 * Minimalista (menos info que Tecnología): imagen cuadrada sobre fondo gris,
 * marca, nombre y precio. Sin badges invasivos. Toda la card enlaza al PDP; el
 * favorito es la única acción directa.
 */
export default function SportsProductCard({
  product,
  showWishlist = true,
  onNavigate,
}: SportsProductCardProps) {
  const {
    priceWithSymbol,
    hasDiscount,
    formattedOriginalPrice,
    promotionType,
    promotionBadges,
  } = useProductPromotion({ product });

  const imageSrc =
    product.thumbnail || product.images?.[0]?.url || PLACEHOLDER_IMAGE;
  const hoverSrc = product.images?.[1]?.url;
  const brand = product.brand?.name;
  const variantId = product.variants?.[0]?.id ?? null;

  return (
    <article className="sports-home group relative flex h-full w-full flex-col">
      <div className="relative aspect-square w-full overflow-hidden bg-[--sp-canvas]">
        {hasDiscount && promotionBadges.length > 0 && (
          <div className="absolute left-3 top-3 z-20 flex flex-col items-start gap-1">
            {promotionBadges.map((badge) => (
              <span
                key={badge}
                className="inline-flex h-[22px] items-center justify-center rounded-none bg-[--accent-color] px-2 font-bold text-[10px] uppercase tracking-[0.08em] text-[--sp-ink] md:text-[11px]"
              >
                {badge}
              </span>
            ))}
          </div>
        )}
        {showWishlist && product.id && variantId && (
          <WishlistButton
            className="absolute right-3 top-3 z-20 text-[--sp-ink]"
            productId={product.id}
            variantId={variantId}
          />
        )}
        <LocalizedClientLink
          href={`/products/${product.handle}`}
          aria-label={product.title}
          className="absolute inset-0"
          onClick={onNavigate}
        >
          <ProductImage
            src={imageSrc}
            alt={product.title ?? "Producto"}
            fill
            sizes={PRODUCT_IMAGE_SIZES_GRID_CARD}
            // object-contain (nunca cover en fotos de producto: recortar el
            // envase es peor que dejar aire). El hover acá es un crossfade
            // entre dos fotos (no un scale), así que sólo cambia opacity.
            className={`${PRODUCT_IMAGE_FIT_CLASS} transition duration-500 ease-out ${hoverSrc ? "group-hover:opacity-0" : "group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"}`}
          />
          {hoverSrc && (
            <Image
              src={hoverSrc}
              alt=""
              fill
              sizes={PRODUCT_IMAGE_SIZES_GRID_CARD}
              className={`${PRODUCT_IMAGE_FIT_CLASS} opacity-0 transition duration-500 ease-out group-hover:opacity-100`}
            />
          )}
        </LocalizedClientLink>
      </div>

      <div className="flex flex-1 flex-col pt-3">
        {brand && (
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[--sp-subtle]">
            {brand}
          </p>
        )}
        <h3 className="mt-0.5 line-clamp-1 text-[14px] font-semibold text-[--sp-ink]">
          <LocalizedClientLink
            href={`/products/${product.handle}`}
            onClick={onNavigate}
          >
            {product.title}
          </LocalizedClientLink>
        </h3>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
          <p className="text-[14px] font-bold tracking-wide text-[--sp-ink]">
            {priceWithSymbol}
          </p>
          {hasDiscount &&
            promotionType !== "buyget" &&
            formattedOriginalPrice && (
              <p className="text-[12px] text-[--sp-subtle] line-through">
                $ {formattedOriginalPrice}
              </p>
            )}
        </div>
      </div>
    </article>
  );
}
