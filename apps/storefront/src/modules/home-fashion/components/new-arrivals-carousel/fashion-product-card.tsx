"use client";

import { useProductPromotion } from "@lib/hooks/use-product-promotion";
import type { TypesenseProductDocument } from "@lib/typesense";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import WishlistButton from "@modules/common/components/wishlist-button";
import Image from "next/image";
import { PLACEHOLDER_IMAGE } from "@lib/util/placeholder-image";
import {
  PRODUCT_IMAGE_ASPECT_CLASS,
  PRODUCT_IMAGE_FIT_CLASS,
  PRODUCT_IMAGE_SIZES_GRID_CARD,
} from "@lib/util/product-image-presets";
import ProductImage from "@modules/common/components/product-image";

type FashionProductCardProps = {
  product: TypesenseProductDocument;
  /** Mostrar el botón de favorito (default true). */
  showWishlist?: boolean;
};

/**
 * Product card del template Moda.
 *
 * Mínima y editorial: imagen protagonista (retrato 3:4), marca, nombre y
 * precio. Sin badges, sin precios tachados, sin promociones invasivas — la
 * prioridad es la pieza, no el descuento. Toda la card enlaza al PDP; el
 * favorito es la única acción.
 */
export default function FashionProductCard({
  product,
  showWishlist = true,
}: FashionProductCardProps) {
  const { priceWithSymbol } = useProductPromotion({ product });

  const imageSrc =
    product.thumbnail || product.images?.[0]?.url || PLACEHOLDER_IMAGE;
  const hoverSrc = product.images?.[1]?.url;
  const brand = product.brand?.name;
  const variantId = product.variants?.[0]?.id ?? null;

  return (
    <article className="fashion-home group relative flex h-full w-full flex-col">
      <div className={`relative ${PRODUCT_IMAGE_ASPECT_CLASS} w-full overflow-hidden bg-[--f-divider]`}>
        {showWishlist && product.id && variantId && (
          <WishlistButton
            className="absolute right-3 top-3 z-20 text-[--f-ink]"
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
            // object-contain (nunca cover en fotos de producto). El hover acá
            // es un crossfade entre dos fotos, no un scale.
            className={`${PRODUCT_IMAGE_FIT_CLASS} transition duration-700 ease-out ${hoverSrc ? "group-hover:opacity-0" : "group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"}`}
          />
          {hoverSrc && (
            <Image
              src={hoverSrc}
              alt=""
              fill
              sizes={PRODUCT_IMAGE_SIZES_GRID_CARD}
              className={`${PRODUCT_IMAGE_FIT_CLASS} opacity-0 transition duration-700 ease-out group-hover:opacity-100`}
            />
          )}
        </LocalizedClientLink>
      </div>

      <div className="flex flex-1 flex-col pt-3">
        {brand && (
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-[--f-subtle]">
            {brand}
          </p>
        )}
        <h3 className="mt-0.5 line-clamp-1 text-[13px] font-normal text-[--f-ink]">
          <LocalizedClientLink href={`/products/${product.handle}`}>
            {product.title}
          </LocalizedClientLink>
        </h3>
        <p className="mt-1 text-[13px] font-medium tracking-wide text-[--f-ink]">
          {priceWithSymbol}
        </p>
        <LocalizedClientLink
          href={`/products/${product.handle}`}
          className="mt-3 inline-flex h-9 items-center justify-center border border-[--f-ink] bg-[--f-ink] px-4 text-[11px] font-medium uppercase tracking-[0.16em] text-[--f-on-dark] transition hover:bg-transparent hover:text-[--f-ink]"
        >
          Comprar ahora
        </LocalizedClientLink>
      </div>
    </article>
  );
}
