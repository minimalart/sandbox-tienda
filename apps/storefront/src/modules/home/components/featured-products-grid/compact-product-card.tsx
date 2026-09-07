"use client";

import type { TypesenseProductDocument } from "@lib/typesense";
import { useCartQuantityForVariant } from "@lib/hooks/use-cart-quantity-for-variant";
import { useProductPromotion } from "@lib/hooks/use-product-promotion";
import { useTenantSections } from "@lib/site-config/context";
import { getVariantLabels } from "@lib/util/variant-labels";
import {
  VariantColorLabels,
  VariantSizeLabel,
} from "@modules/common/components/variant-labels";
import DisneyBadge from "@modules/common/components/disney-badge";
import ProductQuickViewModal from "@modules/common/components/quick-view-modal";
import WishlistButton from "@modules/common/components/wishlist-button";
import {
  PRODUCT_IMAGE_FIT_CLASS,
  PRODUCT_IMAGE_HOVER_CLASS,
  PRODUCT_IMAGE_SIZES_GRID_CARD,
} from "@lib/util/product-image-presets";
import ProductImage from "@modules/common/components/product-image";
import { ShoppingCart } from "lucide-react";
import { useCallback, useState } from "react";

type CompactProductCardProps = {
  product: TypesenseProductDocument;
  countryCode: string;
  useSecondImage?: boolean;
};

export default function CompactProductCard({
  product,
  countryCode,
  useSecondImage,
}: CompactProductCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { areVariantLabelsVisible } = useTenantSections();

  const {
    variantId,
    quantity,
    isLoading,
    canAdd,
    canIncrement,
    handleIncrement,
    buttonRef,
  } = useCartQuantityForVariant(product, countryCode);

  const openModal = useCallback(() => setIsOpen(true), []);
  const closeModal = useCallback(() => setIsOpen(false), []);

  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    openModal();
  };

  const inStock = product.stock_available > 0;

  const {
    hasDiscount,
    discountPercentage,
    priceWithSymbol,
    formattedOriginalPrice,
    priceWithoutTax,
    promotionType,
    promotionLabel,
    promotionName,
    promotionBadges,
  } = useProductPromotion({ product });

  // Etiquetas de variantes (formato + colores). Se apagan por demo desde el
  // admin; los productos sin options reales devuelven listas vacías.
  const variantLabels = areVariantLabelsVisible
    ? getVariantLabels(product)
    : null;

  const productImage = useSecondImage
    ? product.images?.[1]?.url || product.thumbnail || product.images?.[0]?.url
    : product.thumbnail || product.images?.[0]?.url;

  return (
    <>
      <div
        className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-[24px] border border-gray-200 bg-[#F6F6F6] shadow-sm transition-shadow hover:shadow-md ${!inStock ? "opacity-60" : ""}`}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClick(e as any);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Vista rápida de ${product.title}`}
      >
        <div className="relative aspect-square overflow-hidden w-full">
          {/* Badge de promo + colores del producto en un solo stack, para que
              las etiquetas no se solapen con el badge. */}
          <div className="absolute top-2 left-2 z-10 flex max-w-[calc(100%-2.75rem)] flex-col items-start gap-1.5">
            {hasDiscount && promotionBadges.length > 0 && (
              <div className="flex flex-col items-start gap-1">
                {promotionBadges.map((badge) => (
                  <span
                    key={badge}
                    className="inline-flex h-[20px] items-center justify-center rounded-[6px] bg-[var(--accent-color,#f97316)] px-2 font-semibold text-white text-[10px] md:text-[11px]"
                  >
                    {badge}
                  </span>
                ))}
              </div>
            )}
            {variantLabels && (
              <VariantColorLabels
                colors={variantLabels.colors}
                unknownColors={variantLabels.unknownColors}
              />
            )}
          </div>
          {variantLabels && variantLabels.sizes.length > 0 && (
            <div className="absolute bottom-2 left-2 z-10 max-w-[calc(100%-1rem)]">
              <VariantSizeLabel sizes={variantLabels.sizes} />
            </div>
          )}
          {product.id && variantId && (
            <WishlistButton
              className="absolute top-2 right-2 z-10 rounded-full bg-white border border-gray-200 shadow-sm p-1.5"
              productId={product.id}
              variantId={variantId}
            />
          )}
          <ProductImage
            alt={product.title}
            // object-contain (igual que la card del PLP): con object-cover las
            // imágenes verticales se recortaban y quedaban descentradas.
            className={`product-image-blend h-full w-full ${PRODUCT_IMAGE_FIT_CLASS} ${PRODUCT_IMAGE_HOVER_CLASS}`}
            fill
            sizes={PRODUCT_IMAGE_SIZES_GRID_CARD}
            src={productImage}
          />
        </div>

        <div className="flex items-center justify-between gap-3 bg-white px-5 py-4 w-full">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-[14px] text-gray-900 leading-[1.2] line-clamp-2 min-h-[2.4em]">
              {product.title}
            </h3>
            <div className="mt-1">
              <div className="flex min-w-0 items-baseline gap-2 whitespace-nowrap">
                <p className="shrink-0 font-semibold text-[18px] text-gray-900 leading-[100%]">
                  {priceWithSymbol}
                </p>
                {hasDiscount &&
                  promotionType !== "buyget" &&
                  formattedOriginalPrice && (
                    <p className="min-w-0 truncate text-gray-400 text-[11px] line-through">
                      $ {formattedOriginalPrice}
                    </p>
                  )}
                {!hasDiscount && (
                  <DisneyBadge productId={product.id} />
                )}
              </div>
              {priceWithoutTax && (
                <p className="text-[#6B7280] text-[11px] leading-snug mt-0.5">
                  Precio sin imp. nac. ${priceWithoutTax}
                </p>
              )}
            </div>
          </div>

          {inStock && (
            <div ref={buttonRef}>
              <button
                aria-label="Agregar al carrito"
                className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[--primary-color] bg-[--primary-color] text-white transition hover:opacity-90"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  void handleIncrement();
                }}
                // NO deshabilitar durante isLoading: handleIncrement ya encola /
                // deltea los clicks rápidos (useCartQuantityForVariant), y el
                // sync está debounced. Deshabilitar bloqueaba el clickeo rápido.
                // Sí lo deshabilitamos en el techo de stock: seguir clickeando
                // no suma nada y antes terminaba en un rollback al valor inicial.
                disabled={!canAdd || !canIncrement}
                title={!canIncrement ? "No hay más stock disponible" : undefined}
                type="button"
              >
                {quantity > 0 ? (
                  <span className="flex h-full w-full items-center justify-center rounded-full bg-[--primary-color] font-bold text-white text-xs">
                    {quantity}
                  </span>
                ) : isLoading ? (
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white border-r-transparent" />
                ) : (
                  <ShoppingCart className="h-4 w-4 text-white" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <ProductQuickViewModal
        product={product}
        open={isOpen}
        onClose={closeModal}
        inStock={inStock}
        useSecondImage={useSecondImage}
      />
    </>
  );
}
