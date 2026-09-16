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
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import ProductQuickViewModal from "@modules/common/components/quick-view-modal";
import WishlistButton from "@modules/common/components/wishlist-button";
import {
  configuratorCtaLabel,
  isGiftCardProduct,
  requiresConfigurator,
} from "@lib/util/product-configurator";
import {
  PRODUCT_IMAGE_FIT_CLASS,
  PRODUCT_IMAGE_HOVER_CLASS,
  PRODUCT_IMAGE_SIZES_GRID_CARD,
} from "@lib/util/product-image-presets";
import ProductImage from "@modules/common/components/product-image";
import CircularAddToCart from "@modules/common/components/circular-add-to-cart";
import { Gift, Pipette } from "lucide-react";
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

  // Gift cards y bases entonables se configuran en el PDP: la card lleva ahí y
  // no ofrece ni quick view ni quick-add (ver `lib/util/product-configurator`).
  const needsConfigurator = requiresConfigurator(product);
  const isGiftCard = isGiftCardProduct(product);
  const ctaLabel = configuratorCtaLabel(product);

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
  //
  // En los productos con configurador tampoco van: listar las presentaciones
  // ("$10.000 · $25.000 +2") no aporta cuando el precio ya dice "Desde" y la
  // elección es justamente el próximo paso en el PDP.
  const variantLabels =
    areVariantLabelsVisible && !needsConfigurator
      ? getVariantLabels(product)
      : null;

  const productImage = useSecondImage
    ? product.images?.[1]?.url || product.thumbnail || product.images?.[0]?.url
    : product.thumbnail || product.images?.[0]?.url;

  const cardClassName = `group relative flex cursor-pointer flex-col overflow-hidden rounded-[24px] border border-gray-200 bg-[#F6F6F6] shadow-sm transition-shadow hover:shadow-md ${!inStock ? "opacity-60" : ""}`;

  const cardBody = (
    <>
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
                  {/* El precio de la card es el de la variante más barata, y en
                      estos productos el cliente todavía elige (monto de la gift
                      card, color de la base): "Desde" evita prometer ese precio. */}
                  {needsConfigurator
                    ? `Desde ${priceWithSymbol}`
                    : priceWithSymbol}
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

          {/* El CTA del configurador ocupa el MISMO slot que el add-to-cart (no
              una fila extra abajo), para que la card mida igual que las demás de
              la fila. Va como <span> y no <button> porque toda la card ya es el
              link al PDP y un botón adentro de un <a> es HTML inválido. */}
          {needsConfigurator ? (
            <span
              className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[--primary-color] bg-[--primary-color] text-white transition group-hover:opacity-90"
              title={ctaLabel ?? undefined}
            >
              {isGiftCard ? (
                <Gift className="h-4 w-4" />
              ) : (
                <Pipette className="h-4 w-4" />
              )}
            </span>
          ) : (
            inStock && (
              <div ref={buttonRef}>
                <CircularAddToCart
                  quantity={quantity}
                  onIncrement={handleIncrement}
                  isLoading={isLoading}
                  disabled={!canAdd || !canIncrement}
                  canIncrement={canIncrement}
                  size="sm"
                />
              </div>
            )
          )}
        </div>
    </>
  );

  if (needsConfigurator) {
    return (
      <LocalizedClientLink
        aria-label={`${ctaLabel}: ${product.title}`}
        className={cardClassName}
        href={`/products/${product.handle}`}
      >
        {cardBody}
      </LocalizedClientLink>
    );
  }

  return (
    <>
      <div
        aria-label={`Vista rápida de ${product.title}`}
        className={cardClassName}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClick(e as any);
          }
        }}
        role="button"
        tabIndex={0}
      >
        {cardBody}
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
