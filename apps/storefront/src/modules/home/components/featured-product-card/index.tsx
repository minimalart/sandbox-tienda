"use client";
import { usesQuickViewOnly } from "@lib/site-config/template-helpers";

import { getIndividualVariant } from "@lib/util/get-individual-variant";
import { isProductInStock } from "@lib/util/is-product-in-stock";
import {
  canIncrementQuantity,
  getLineItemMaxQuantity,
} from "@lib/util/max-purchasable-quantity";
import { useCartStore } from "@lib/stores/cart.store";
import { useAddToCartAnimation } from "@lib/context/add-to-cart-animation";
import { useProductPromotion } from "@lib/hooks/use-product-promotion";
import { useTenant, useTenantSections } from "@lib/site-config/context";
import { getVariantLabels } from "@lib/util/variant-labels";
import {
  VariantColorLabels,
  VariantSizeLabel,
} from "@modules/common/components/variant-labels";
import type { HttpTypes } from "@medusajs/types";
import ProductQuickViewModal from "@modules/common/components/quick-view-modal";
import {
  configuratorCtaLabel,
  isGiftCardProduct,
  requiresConfigurator,
} from "@lib/util/product-configurator";
import { Gift, Pipette } from "lucide-react";
import { CartQuantitySelector } from "@modules/common/components/cart-quantity-selector";
import DisneyBadge from "@modules/common/components/disney-badge";
import { isNewProduct } from "@lib/util/is-new-product";
import NewBadge from "@modules/common/components/new-badge";
import { PLACEHOLDER_IMAGE } from "@lib/util/placeholder-image";
import {
  PRODUCT_IMAGE_FIT_CLASS,
  PRODUCT_IMAGE_HOVER_CLASS,
  PRODUCT_IMAGE_SIZES_GRID_CARD,
} from "@lib/util/product-image-presets";
import ProductImage from "@modules/common/components/product-image";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import WishlistButton from "@modules/common/components/wishlist-button";
import { useState, useMemo, useRef, useCallback } from "react";
import { useParams } from "next/navigation";

type FeaturedProductCardProps = {
  product: HttpTypes.StoreProduct & {
    discount?: number;
    subtotal?: number;
    price?: number;
    promotions?: Array<{
      application_method?: { type?: string; value?: number };
      status?: string;
    }>;
  };
  region: HttpTypes.StoreRegion;
  isStore?: boolean;
  variant?: "default" | "home";
};

const FeaturedProductCard = ({
  product,
  region,
  isStore = true,
  variant = "default",
}: FeaturedProductCardProps) => {
  const [open, setOpen] = useState(false);
  const tenant = useTenant();
  const quickViewOnly = usesQuickViewOnly(tenant.template);
  const { areVariantLabelsVisible } = useTenantSections();
  const isSportsTemplate = tenant.template === "sports";
  const { countryCode } = useParams() as { countryCode: string };
  const { triggerAnimation } = useAddToCartAnimation();
  const buttonRef = useRef<HTMLDivElement>(null);

  // Cart store
  const addItem = useCartStore((s) => s.addItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const changeItemQuantity = useCartStore((s) => s.changeItemQuantity);
  const cart = useCartStore((s) => s.cart);
  const pendingAdditions = useCartStore((s) => s.pendingAdditions);
  const pendingQuantityUpdates = useCartStore((s) => s.pendingQuantityUpdates);

  // REGLA B2C: siempre la variante Individual, nunca la de Bulto.
  const selectedVariant = useMemo(
    () => getIndividualVariant(product.variants),
    [product.variants],
  );
  const variantId = selectedVariant?.id;

  // Get line item from cart
  const lineItem = useMemo(() => {
    if (!cart?.items) return undefined;
    if (variantId) {
      const exactMatch = cart.items.find((item) => item.variant_id === variantId);
      if (exactMatch) return exactMatch;
    }
    // Fallback: match by product ID (handles stale variant IDs)
    return cart.items.find((item) => item.product_id === product.id);
  }, [cart?.items, variantId, product.id]);

  const isAdding = variantId ? pendingAdditions.has(variantId) : false;
  // Optimistic: reflect the add instantly even before the optimistic line
  // lands in the store (same behavior as useCartQuantityForVariant).
  const quantity = lineItem?.quantity ?? (isAdding ? 1 : 0);
  const isUpdating = lineItem ? pendingQuantityUpdates.has(lineItem.id) : false;
  const isLoading = isAdding || isUpdating;
  const canAdd = Boolean(variantId);
  // Techo de stock de la línea (el carrito viene enriquecido con el stock real
  // por variante). `null` = sin techo conocido. Sin esto, clickear rápido de más
  // mandaba UNA cantidad imposible y el rollback volvía al valor inicial.
  const maxQuantity = getLineItemMaxQuantity(lineItem);
  const canIncrement = canIncrementQuantity(quantity, maxQuantity);

  const inStock = useMemo(() => isProductInStock(product), [product]);

  // Cart handlers
  const handleIncrement = useCallback(async () => {
    if (!variantId) return;
    // Ya estamos en el techo de stock: no mandamos un increment que el server va
    // a rechazar (y cuyo rollback nos devolvía al valor inicial).
    if (!canIncrement) return;

    if (quantity === 0) {
      // Animación en el click, no después del await: el carrito ya es optimista
      // y esperar la red retrasaba el despegue de la imagen.
      if (buttonRef.current) {
        const thumbnail = product.thumbnail || product.images?.[0]?.url;
        triggerAnimation(buttonRef.current, thumbnail);
      }
      await addItem(
        variantId,
        1,
        countryCode,
        product.id,
        undefined,
        {
          title: product.title,
          handle: product.handle,
          thumbnail: product.thumbnail || product.images?.[0]?.url,
          unitPrice:
            selectedVariant?.calculated_price?.calculated_amount ??
            product.subtotal ??
            product.price,
          currencyCode: selectedVariant?.calculated_price?.currency_code,
        },
      );
    } else if (lineItem) {
      changeItemQuantity(lineItem.id, 1);
    }
  }, [
    variantId,
    quantity,
    lineItem,
    product,
    triggerAnimation,
    addItem,
    changeItemQuantity,
    countryCode,
    selectedVariant,
    canIncrement,
  ]);

  const handleDecrement = useCallback(() => {
    if (!lineItem) return;
    changeItemQuantity(lineItem.id, -1);
  }, [lineItem, changeItemQuantity]);

  const handleRemove = useCallback(() => {
    if (!lineItem) return;
    updateQuantity(lineItem.id, 0);
  }, [lineItem, updateQuantity]);

  const handleCardClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setOpen(true);
  };

  // Gift cards y bases entonables se configuran en el PDP: la card lleva ahí y
  // no ofrece ni quick view ni quick-add (ver `lib/util/product-configurator`).
  const needsConfigurator = requiresConfigurator(product);
  const isGiftCard = isGiftCardProduct(product);
  const ctaLabel = configuratorCtaLabel(product);

  const imageSrc =
    product.thumbnail || product.images?.[0]?.url || PLACEHOLDER_IMAGE;
  const subtitle = product.description || "";
  const collectionLabel = product.collection?.title;

  // Etiquetas de variantes (formato + colores). Se apagan por demo desde el
  // admin; los productos sin options reales devuelven listas vacías.
  // En los productos con configurador tampoco van: listar las presentaciones
  // no aporta cuando el precio ya dice "Desde" y elegir es justamente el
  // próximo paso en el PDP.
  const variantLabels =
    areVariantLabelsVisible && !needsConfigurator
      ? getVariantLabels(product)
      : null;

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
  } = useProductPromotion({ product, selectedVariant, region });

  // Template Marca Deportiva: tarjeta espejo de la del store/grid sports
  // (bordes rectos, fondo blanco, sin botón add-to-cart ni quick view; la card
  // entera lleva al PDP). Las otras plantillas conservan la tarjeta supermercado.
  if (isSportsTemplate) {
    return (
      <article
        className={`group relative flex h-full w-full flex-col border border-[--sp-hairline] bg-white ${!inStock ? "opacity-60" : ""}`}
      >
        <div className="group/image relative flex aspect-square items-center justify-center bg-white">
          {!inStock ? (
            <div className="absolute top-3 left-3 z-10">
              <span className="inline-flex h-[24px] w-[70px] items-center justify-center rounded-none bg-[--sp-ink] font-bold text-[11px] uppercase tracking-wide text-white">
                Sin Stock
              </span>
            </div>
          ) : hasDiscount && promotionBadges.length > 0 ? (
            <div className="absolute top-2 left-2 z-10 flex flex-col items-start gap-1">
              {promotionBadges.map((badge) => (
                <span
                  key={badge}
                  className="inline-flex h-[22px] items-center justify-center rounded-none bg-[--accent-color] px-2 font-bold uppercase tracking-[0.08em] text-[--sp-ink] text-[10px] md:text-[11px]"
                >
                  {badge}
                </span>
              ))}
            </div>
          ) : isNewProduct(product) ? (
            <div className="absolute top-3 left-3 z-10">
              <NewBadge />
            </div>
          ) : null}
          {!quickViewOnly && product.id && variantId && (
            <WishlistButton
              className="absolute right-2 top-2 z-20 !rounded-none border border-[--sp-hairline] bg-white p-1.5 shadow-none"
              productId={product.id}
              variantId={variantId}
            />
          )}
          <div className="relative h-full w-full">
            <ProductImage
              alt={product.title ?? "Producto"}
              className={`${PRODUCT_IMAGE_FIT_CLASS} ${PRODUCT_IMAGE_HOVER_CLASS} product-image-blend`}
              fill
              sizes={PRODUCT_IMAGE_SIZES_GRID_CARD}
              src={imageSrc}
            />
          </div>
          {product.handle && (
            <LocalizedClientLink
              aria-label={product.title ?? "Producto"}
              className="absolute inset-0 z-10"
              href={`/products/${product.handle}`}
            />
          )}
        </div>

        <div className="flex min-h-[112px] flex-shrink-0 flex-col px-3 pt-3 pb-3">
          <h3 className="mb-2 line-clamp-3 min-h-[3.75rem] font-normal text-[14px] text-[--sp-ink] leading-5 tracking-[0.04em]">
            <LocalizedClientLink
              href={`/products/${product.handle}`}
              className="outline-none hover:underline"
            >
              {product.title}
            </LocalizedClientLink>
          </h3>
          <div className="mt-auto">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <p className="font-semibold text-[14px] text-[--sp-ink] leading-5 tracking-[0.04em]">
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
            {priceWithoutTax && (
              <p className="mt-0.5 text-[11px] text-[--sp-subtle] leading-snug">
                Precio sin imp. nac. ${priceWithoutTax}
              </p>
            )}
          </div>
        </div>
      </article>
    );
  }

  const articleClassName = `group relative flex w-full cursor-pointer flex-col overflow-hidden rounded-[24px] border border-gray-200 bg-white transition hover:-translate-y-1 hover:shadow-lg ${variant === "home" ? "max-w-[291px]" : "max-w-[216px]"} ${!inStock ? "opacity-60" : ""}`;

  // Con configurador la card ES un link al PDP; sin él, un botón que abre el
  // quick view. Los handlers de teclado/click sólo aplican al segundo caso.
  const interactionProps = needsConfigurator
    ? {}
    : {
        "aria-label": `Vista rápida de ${product.title}`,
        onClick: handleCardClick,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClick(e as never);
          }
        },
        role: "button",
        tabIndex: 0,
      };

  const article = (
      <article className={articleClassName} {...interactionProps}>
        <div className="relative flex items-center justify-center bg-[#F6F6F6] aspect-square">
          {/* Columna superior izquierda: badge de estado + colores del
              producto, en un solo stack para que no se solapen. */}
          <div className="absolute top-3 left-3 z-20 flex max-w-[calc(100%-2.75rem)] flex-col items-start gap-1.5">
          {!inStock ? (
            <div>
              <span className="inline-flex w-[70px] h-[24px] items-center justify-center rounded-[8px] bg-[#6B7280] font-bold text-[11px] uppercase tracking-wide text-white shadow-sm">
                Sin Stock
              </span>
            </div>
          ) : hasDiscount && promotionBadges.length > 0 ? (
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
          ) : isNewProduct(product) ? (
            <div>
              <NewBadge />
            </div>
          ) : collectionLabel ? (
            <span className="rounded bg-white px-2 py-1 font-semibold text-[#d97706] text-xs uppercase tracking-wide shadow-sm">
              {collectionLabel}
            </span>
          ) : null}
          {variantLabels && (
            <VariantColorLabels
              colors={variantLabels.colors}
              unknownColors={variantLabels.unknownColors}
            />
          )}
          </div>
          {!quickViewOnly && product.id && variantId && (
            <WishlistButton
              className="absolute top-3 right-3 rounded-full bg-white border border-gray-200 shadow-sm p-1.5"
              productId={product.id}
              variantId={variantId}
            />
          )}
          <div className="relative h-full w-full">
            <ProductImage
              alt={product.title ?? "Producto"}
              className={`${PRODUCT_IMAGE_FIT_CLASS} ${PRODUCT_IMAGE_HOVER_CLASS} product-image-blend`}
              fill
              sizes={PRODUCT_IMAGE_SIZES_GRID_CARD}
              src={imageSrc}
            />
          </div>

          {/* Formato/medida: esquina opuesta al add-to-cart. */}
          {variantLabels && variantLabels.sizes.length > 0 && (
            <div className="absolute bottom-3 left-3 z-20 max-w-[calc(100%-4rem)]">
              <VariantSizeLabel sizes={variantLabels.sizes} />
            </div>
          )}

          {/* Mismo slot que el add-to-cart (overlay sobre la imagen), para que
              la card mida igual que las otras de la fila. <span> y no <button>:
              la card entera ya es el link al PDP. */}
          {needsConfigurator && (
            <span
              className="absolute bottom-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[--primary-color] bg-[--primary-color] text-white"
              title={ctaLabel ?? undefined}
            >
              {isGiftCard ? <Gift className="h-4 w-4" /> : <Pipette className="h-4 w-4" />}
            </span>
          )}

          {isStore && inStock && !needsConfigurator && (
            <div className="absolute bottom-3 right-3" ref={buttonRef}>
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

        <div className="flex flex-shrink-0 flex-col p-3 md:p-4">
          <div className="mb-1">
            <div className="flex min-w-0 items-baseline gap-2 whitespace-nowrap">
              <p className="shrink-0 font-semibold text-[#111827] text-[16px] md:text-[18px] leading-tight">
                {/* El precio de la card es el de la variante más barata, y en
                    estos productos el cliente todavía elige (monto de la gift
                    card, color de la base): "Desde" evita prometer ese precio. */}
                {needsConfigurator ? `Desde ${priceWithSymbol}` : priceWithSymbol}
              </p>
              {hasDiscount &&
                promotionType !== "buyget" &&
                formattedOriginalPrice && (
                  <p className="min-w-0 truncate text-gray-400 text-[11px] line-through md:text-xs">
                    $ {formattedOriginalPrice}
                  </p>
                )}
              {!hasDiscount && (
                <DisneyBadge productId={product.id} />
              )}
            </div>
            {priceWithoutTax && (
              <p className="text-[#6B7280] text-[11px] md:text-[12px] leading-snug mt-0.5">
                Precio sin imp. nac. ${priceWithoutTax}
              </p>
            )}
          </div>

          <h3 className="mb-1 line-clamp-2 min-h-[2.6em] font-semibold text-[#111827] text-[14px] md:text-[16px] leading-tight">
            {product.title}
          </h3>

        </div>
      </article>
  );

  if (needsConfigurator) {
    return (
      <LocalizedClientLink
        aria-label={`${ctaLabel}: ${product.title}`}
        className="block w-full"
        href={`/products/${product.handle}`}
      >
        {article}
      </LocalizedClientLink>
    );
  }

  return (
    <>
      {article}

      <ProductQuickViewModal
        product={product}
        region={region}
        open={open}
        onClose={() => setOpen(false)}
        inStock={inStock}
      />
    </>
  );
};

export default FeaturedProductCard;
