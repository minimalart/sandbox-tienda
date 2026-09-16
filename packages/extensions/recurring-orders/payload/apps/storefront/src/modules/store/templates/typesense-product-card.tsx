"use client";
import { usesQuickViewOnly } from "@lib/site-config/template-helpers";

import { useTenant, useTenantSections } from "@lib/site-config/context";
import { isImpulseTemplate as isImpulseTpl } from "@lib/site-config/template-helpers";
import type { TypesenseProductDocument } from "@lib/typesense";
import { PLACEHOLDER_IMAGE } from "@lib/util/placeholder-image";
import {
  PRODUCT_IMAGE_FIT_CLASS,
  PRODUCT_IMAGE_HOVER_CLASS,
  PRODUCT_IMAGE_SIZES_GRID_CARD,
} from "@lib/util/product-image-presets";
import ProductImage from "@modules/common/components/product-image";
import { TenantConfig } from "@lib/site-config";
import { CartQuantitySelector } from "@modules/common/components/cart-quantity-selector";
import QuickAddVariantSheet from "@modules/store/templates/quick-add-variant-sheet";
import { useCartQuantityForVariant } from "@lib/hooks/use-cart-quantity-for-variant";
import { useCartStore } from "@lib/stores/cart.store";
import {
  getIndividualVariantIdFromDoc,
  isMultiVariantProduct,
} from "@lib/util/card-variant";
import { getVariantLabels } from "@lib/util/variant-labels";
import {
  isTintableProduct,
  tintBadgeLabel,
  tintColorCountOf,
  tintSwatchesOf,
} from "@lib/util/tinting";
import {
  VariantColorLabels,
  VariantSizeLabel,
} from "@modules/common/components/variant-labels";
import { useProductPromotion } from "@lib/hooks/use-product-promotion";
import NewBadge from "@modules/common/components/new-badge";
import ProductQuickViewModal from "@modules/common/components/quick-view-modal";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import { isNewProduct } from "@lib/util/is-new-product";
import WishlistButton from "@modules/common/components/wishlist-button";
import { Eye, Gift, Pipette, Plus } from "lucide-react";
import { useCallback, useState } from "react";

type TypesenseProductCardProps = {
  product: TypesenseProductDocument;
  countryCode: string;
  variant?: "default" | "home";
  subscriptionBenefit?: { planName: string; discountPercentage: number };
};

export default function TypesenseProductCard({
  product,
  countryCode,
  variant = "default",
  subscriptionBenefit,
}: TypesenseProductCardProps) {
  const tenant: TenantConfig = useTenant();
  const quickViewOnly = usesQuickViewOnly(tenant.template);
  const { areVariantLabelsVisible } = useTenantSections();
  const [isOpen, setIsOpen] = useState(false);
  const [variantSheetOpen, setVariantSheetOpen] = useState(false);
  const isImpulseTemplate = isImpulseTpl(tenant.template);
  const isSportsTemplate = tenant.template === "sports";

  // Las gift cards no se agregan a ciegas: requieren personalización (diseño,
  // monto, destinatario, entrega). El quick view no alcanza para eso, así que
  // la card lleva directo a la página de personalización (el configurador del
  // PDP) y ocultamos el quick-add.
  const isGiftCard = product.is_giftcard === true;
  const giftCardHref = `/products/${product.handle}`;

  // Una base entonable se comporta igual que una gift card: el color se elige en
  // el PDP (carta de cientos de colores + precio que cotiza el ERP por fórmula),
  // así que ni quick view ni quick-add — se va derecho a personalizar.
  const isTintable = isTintableProduct(product);
  const tintSwatches = isTintable ? tintSwatchesOf(product) : [];
  const tintColorCount = isTintable ? tintColorCountOf(product) : 0;
  const requiresConfigurator = isGiftCard || isTintable;
  const configuratorHref = `/products/${product.handle}`;

  // Un producto con más de una presentación vendible (tamaños, colores, sabores)
  // es ambiguo para el quick-add: en vez de agregar `variants[0]` a ciegas, el
  // toque abre un bottom sheet para elegir. Solo los productos inequívocos se
  // agregan con un toque.
  const isMultiVariant = isMultiVariantProduct(product);

  // Cada template "de impulso" trae su propio set de tokens scopeados (--f-*,
  // --tech-*, --tr-*, --sp-*). La tienda/PDP se renderiza dentro del wrapper del
  // template, así que elegimos las clases correctas por template para no
  // referenciar variables que no existen en ese scope.
  const impulseCardClass: string =
    tenant.template === "fashion"
      ? "rounded-none border-[--f-hairline] shadow-none hover:shadow-none"
      : tenant.template === "sports"
        ? "rounded-none border-[--sp-hairline] shadow-none hover:shadow-none"
        : tenant.template === "tech-retail"
          ? "rounded-2xl border-[--tr-hairline] hover:shadow-lg"
          : "rounded-3xl border-[--tech-hairline] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)]";
  const impulseImageBgClass: string =
    tenant.template === "fashion"
      ? "bg-[--f-divider]"
      : tenant.template === "sports"
        ? "bg-[--sp-canvas]"
        : tenant.template === "tech-retail"
          ? "bg-[--tr-surface]"
          : "bg-[--tech-parchment]";
  const impulseBuyButtonClass: string =
    tenant.template === "fashion"
      ? "border border-[--f-ink] bg-[--f-ink] text-[--f-on-dark] hover:bg-transparent hover:text-[--f-ink]"
      : tenant.template === "sports"
        ? "border-2 border-[--sp-ink] bg-[--sp-ink] text-[--sp-on-dark] hover:bg-transparent hover:text-[--sp-ink]"
        : tenant.template === "tech-retail"
          ? "rounded-xl bg-[--tr-blue] text-white hover:bg-[--tr-blue-strong]"
          : "rounded-full bg-[--tech-blue] text-white hover:bg-[--tech-blue-strong]";

  const {
    quantity,
    isLoading,
    canAdd,
    canIncrement,
    handleIncrement,
    handleDecrement,
    handleRemove,
    buttonRef,
  } = useCartQuantityForVariant(product, countryCode, {
    openCartOnAdd: isSportsTemplate,
  });

  const openModal = useCallback(() => setIsOpen(true), []);
  const closeModal = useCallback(() => setIsOpen(false), []);

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openModal();
  };

  const imageSrc: string =
    product.thumbnail || product.images?.[0]?.url || PLACEHOLDER_IMAGE;

  const rawSubtitle: string = product.subtitle?.trim() || "";
  const isPlaceholderSubtitle: boolean = /^[—-]+$/.test(rawSubtitle);
  const subtitle: string =
    rawSubtitle && !isPlaceholderSubtitle
      ? rawSubtitle
      : product.description?.trim() || "";

  const collectionLabel: string | undefined = product.collection?.title;

  const individualVariantId = getIndividualVariantIdFromDoc(product);

  // Líneas de este producto en el carrito. Para multivariante, la CANTIDAD de
  // líneas decide qué control mostramos (ver `showVariantPicker`); también
  // resaltamos la card si CUALQUIER variante ya está en el carrito.
  const productLineCount = useCartStore(
    (s) =>
      s.cart?.items?.filter((item) => item.product_id === product.id).length ?? 0
  );
  const productInCart = productLineCount > 0;

  // El "+" (abre el selector de variante) solo tiene sentido cuando el quick-add
  // es ambiguo: 0 líneas (hay que elegir presentación para agregar) o 2+ líneas
  // (varias presentaciones del mismo producto — un stepper no sabría a cuál
  // aplicar). Con EXACTAMENTE una línea mostramos el stepper como en los simples:
  // incrementa/decrementa esa línea por su lineItem.id (sin ambigüedad).
  const showVariantPicker = isMultiVariant && productLineCount !== 1;

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


  const inStock: boolean = product.stock_available > 0;

  // Etiquetas de variantes (formato + colores). Se apagan por demo desde el
  // admin; los productos sin options reales devuelven listas vacías.
  const variantLabels = areVariantLabelsVisible
    ? getVariantLabels(product)
    : null;

  // Cuando el producto ya tiene unidades en el carrito, resaltamos la card con
  // el borde en el color primario de la marca. Solo aplica al template por
  // defecto (la tienda Mercatto/supermercado); los templates de impulso
  // conservan su propio tratamiento de borde.
  const hasItemInCart: boolean = isMultiVariant ? productInCart : quantity > 0;

  return (
    <>
      <article
        className={`group relative flex h-full w-full flex-col overflow-hidden border bg-white transition hover:-translate-y-1 ${
          isSportsTemplate
            ? "max-w-none border-0 bg-transparent shadow-none hover:translate-y-0 hover:shadow-none"
            : isImpulseTemplate
            ? impulseCardClass
            : "rounded-[24px] border-gray-200 hover:shadow-lg"
        } ${isSportsTemplate ? "" : variant === "home" ? "max-w-[291px]" : "max-w-[216px]"} ${!inStock ? "opacity-60" : ""}`}
      >
        {/* Borde primario que se "dibuja" alrededor de la card cuando el
            producto tiene unidades en el carrito. Es un overlay SVG con el
            trazo animado vía stroke-dashoffset; queda por encima del borde gris
            base (2px) sin alterar el layout. Solo en el template por defecto
            (Mercatto/supermercado). */}
        {!isImpulseTemplate && hasItemInCart && (
          <svg
            aria-hidden="true"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 z-30 h-full w-full"
          >
            <rect
              className="cart-border-draw"
              x="1"
              y="1"
              rx="23"
              ry="23"
              fill="none"
              stroke="var(--primary-color)"
              strokeWidth="2"
              pathLength={100}
              style={{ width: "calc(100% - 2px)", height: "calc(100% - 2px)" }}
            />
          </svg>
        )}
        <div
          className={`group/image relative flex aspect-square items-center justify-center ${
            isSportsTemplate
              ? "bg-white"
              : isImpulseTemplate
              ? impulseImageBgClass
              : "rounded-t-[24px] bg-[#F6F6F6]"
          }`}
        >
          {/* Columna superior izquierda: el badge de estado (sin stock /
              promo / nuevo / colección, mutuamente excluyentes) y debajo los
              colores que ofrece el producto. Va en un solo stack para que las
              etiquetas nunca se solapen con el badge. */}
          <div className="absolute top-3 left-3 z-20 flex max-w-[calc(100%-2.75rem)] flex-col items-start gap-1.5">
          {!inStock ? (
            <div>
              <span
                className={`inline-flex h-[24px] w-[70px] items-center justify-center font-bold text-[11px] uppercase tracking-wide text-white ${
                  isSportsTemplate
                    ? "rounded-none bg-[--sp-ink] shadow-none"
                    : "rounded-[8px] bg-[#6B7280] shadow-sm"
                }`}
              >
                Sin Stock
              </span>
            </div>
          ) : hasDiscount && promotionBadges.length > 0 ? (
            <div className="flex flex-col items-start gap-1">
              {promotionBadges.map((badge) => (
                <span
                  key={badge}
                  className={
                    isSportsTemplate
                      ? "inline-flex h-[22px] items-center justify-center rounded-none bg-[--accent-color] px-2 font-bold uppercase tracking-[0.08em] text-[--sp-ink] text-[10px] md:text-[11px]"
                      : "inline-flex h-[20px] items-center justify-center rounded-[6px] bg-[var(--accent-color,#f97316)] px-2 font-semibold text-white text-[10px] md:text-[11px]"
                  }
                >
                  {badge}
                </span>
              ))}
            </div>
          ) : isNewProduct(product) ? (
            <div>
              <NewBadge />
            </div>
          ) : collectionLabel && !isSportsTemplate ? (
            <span className="rounded bg-white px-2 py-1 font-semibold text-[#d97706] text-xs uppercase tracking-wide shadow-sm">
              {collectionLabel}
            </span>
          ) : null}
          {/* Badge de la base entonable. Gana sobre "nuevo"/colección porque es
              lo que define de qué se trata el producto: una base que se entona.
              El color primario se mezcla con `color-mix` — el modificador de
              opacidad de Tailwind no tinta sobre una var CSS cruda. */}
          {isTintable && (
            <span
              className="rounded px-2 py-1 font-semibold text-white text-xs uppercase tracking-wide shadow-sm"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--primary-color) 85%, black)",
              }}
            >
              {tintBadgeLabel(tintColorCount)}
            </span>
          )}
          {subscriptionBenefit && !isGiftCard && !isTintable && (
            <span
              className='rounded-md bg-[--mc-green-soft] px-2 py-1 font-semibold text-[--primary-color] text-[10px] shadow-sm'
              title={subscriptionBenefit.planName}
            >
              Disponible por suscripción
              {subscriptionBenefit.discountPercentage > 0
                ? ` · ${subscriptionBenefit.discountPercentage}% menos`
                : ''}
            </span>
          )}
          {variantLabels && (
            <VariantColorLabels
              colors={variantLabels.colors}
              unknownColors={variantLabels.unknownColors}
            />
          )}
          </div>
          {!quickViewOnly && product.id && individualVariantId && (
            <WishlistButton
              className={
                isSportsTemplate
                  ? "absolute right-2 top-2 z-20 !rounded-none border border-[--sp-hairline] bg-white p-1.5 shadow-none"
                  : "absolute top-3 right-3 z-20 rounded-full bg-white border border-gray-200 shadow-sm p-1.5"
              }
              productId={product.id}
              variantId={individualVariantId}
            />
          )}
          <div className="relative h-full w-full">
            <ProductImage
              alt={product.title ?? `Producto ${tenant.name}`}
              className={`${PRODUCT_IMAGE_FIT_CLASS} ${PRODUCT_IMAGE_HOVER_CLASS} product-image-blend`}
              fill
              sizes={PRODUCT_IMAGE_SIZES_GRID_CARD}
              src={imageSrc}
              // Antes había `unoptimized` acá porque next.config no tenía un
              // remotePattern catch-all para dominios externos arbitrarios.
              // Ya no es así: `next.config.js` tiene `{ protocol: "https",
              // hostname: "**" }` y su par http (agregados para los catálogos
              // demo con imágenes de dominios externos), así que CUALQUIER URL
              // remota matchea y el optimizador ya no devuelve 400. Sin
              // `unoptimized`, Next normaliza el ancho de render — que es
              // justamente lo que hacía que una foto de 1600px y una de 120px
              // llegaran "crudas" y se vieran desparejas entre sí.
            />
          </div>

          {isSportsTemplate && product.handle && (
            <LocalizedClientLink
              aria-label={product.title ?? `Producto ${tenant.name}`}
              className="absolute inset-0 z-10"
              href={`/products/${product.handle}`}
            />
          )}

          {/* Vista rápida: la imagen abre el quick view. El overlay completo
              es clickeable (solo al hacer hover sobre la imagen) y muestra la
              etiqueta "Vista rápida". El título, en cambio, navega al PDP. Así
              cada zona tiene una acción clara y no se solapan los hovers.
              En sports no hay quick view: la card entera lleva al PDP. */}
          {!isSportsTemplate && (
            requiresConfigurator && !quickViewOnly ? (
              <LocalizedClientLink
                href={configuratorHref}
                aria-label={`Personalizar ${product.title}`}
                className={`absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 ${quickViewOnly ? "hover:opacity-100 focus-visible:opacity-100" : "pointer-events-none group-hover/image:pointer-events-auto group-hover/image:opacity-100"}`}
              >
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-semibold text-[#111827] text-sm shadow-md transition hover:bg-gray-100">
                  {/* El regalo es de la gift card; una base entonable se
                      personaliza eligiendo color, así que va el gotero. */}
                  {isGiftCard ? (
                    <Gift className="size-4" />
                  ) : (
                    <Pipette className="size-4" />
                  )}
                  Personalizar
                </span>
              </LocalizedClientLink>
            ) : (
              <button
                type="button"
                onClick={handleQuickView}
                aria-label={`Vista rápida de ${product.title}`}
                className={`absolute inset-0 z-10 flex cursor-pointer items-center justify-center bg-black/40 opacity-0 transition-opacity duration-200 ${quickViewOnly ? "hover:opacity-100 focus-visible:opacity-100" : "pointer-events-none group-hover/image:pointer-events-auto group-hover/image:opacity-100"}`}
              >
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 font-semibold text-[#111827] text-sm shadow-md transition hover:bg-gray-100">
                  <Eye className="size-4" />
                  Vista rápida
                </span>
              </button>
            )
          )}

          {/* Formato/medida: esquina opuesta al add-to-cart. */}
          {variantLabels && variantLabels.sizes.length > 0 && (
            <div className="absolute bottom-3 left-3 z-20 max-w-[calc(100%-4rem)]">
              <VariantSizeLabel sizes={variantLabels.sizes} />
            </div>
          )}

          {inStock && !isSportsTemplate && !requiresConfigurator && (
            <div className="absolute bottom-3 right-3 z-20" ref={buttonRef}>
              {showVariantPicker ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // El bottom sheet de variantes es un patrón mobile (se
                    // desliza desde abajo, pensado para el pulgar). En desktop
                    // (mouse, viewport ancho) abrimos el quick view: modal
                    // centrado que ya resuelve selección de variante + agregar.
                    const isDesktop =
                      typeof window !== "undefined" &&
                      window.matchMedia("(min-width: 1024px)").matches;
                    if (isDesktop || quickViewOnly) {
                      openModal();
                    } else {
                      setVariantSheetOpen(true);
                    }
                  }}
                  aria-label={`Elegir presentación de ${product.title}`}
                  aria-haspopup="dialog"
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-[--primary-color] bg-[--primary-color] text-white shadow-sm transition-all duration-200 hover:opacity-90 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--primary-color] focus-visible:ring-offset-2 sm:h-10 sm:w-10"
                >
                  <Plus className="h-5 w-5 sm:h-[18px] sm:w-[18px]" strokeWidth={2.5} />
                </button>
              ) : (
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
              )}
            </div>
          )}
        </div>

        <div
          className={`flex flex-shrink-0 flex-col p-3 md:p-4 ${
            isSportsTemplate
              ? "min-h-[112px] px-0 pb-0 pt-3 md:px-0 md:pb-0 md:pt-3"
              : isImpulseTemplate
                ? "min-h-[190px]"
                : ""
          }`}
        >
          {isSportsTemplate ? (
            <>
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
            </>
          ) : (
            <>
              {/* Muestra de colores de la base. No es la carta completa: son unos
                  pocos hex para que se entienda de un vistazo que el producto se
                  entona. Sin hex cargados no se dibuja nada — un color inventado
                  sería mostrar una pintura que no es la que se recibe. */}
              {isTintable && tintSwatches.length > 0 && (
                <div className="mb-1.5 flex items-center gap-1.5">
                  <span className="flex items-center gap-1">
                    {tintSwatches.map((hex) => (
                      <span
                        key={hex}
                        aria-hidden
                        className="inline-block h-4 w-4 rounded-full border border-black/10"
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </span>
                  {tintColorCount > tintSwatches.length && (
                    <span className="text-[#6B7280] text-[11px]">y más</span>
                  )}
                </div>
              )}

              <div className="mb-1">
                <div className="flex min-w-0 items-baseline gap-2 whitespace-nowrap">
                  <p className="shrink-0 font-semibold text-[#111827] text-[16px] md:text-[18px] leading-tight">
                    {/* Igual que la base entonable, la gift card muestra el
                        monto más chico: el cliente elige el suyo en el PDP. */}
                    {requiresConfigurator
                      ? `Desde ${priceWithSymbol}`
                      : priceWithSymbol}
                  </p>
                  {hasDiscount &&
                    promotionType !== "buyget" &&
                    formattedOriginalPrice && (
                      <p className="min-w-0 truncate text-gray-400 text-[11px] line-through md:text-xs">
                        $ {formattedOriginalPrice}
                      </p>
                    )}
                </div>
                {priceWithoutTax && (
                  <p className="text-[#6B7280] text-[11px] md:text-[12px] leading-snug mt-0.5">
                    Precio sin imp. nac. ${priceWithoutTax}
                  </p>
                )}
              </div>

              <h3 className="mb-1 line-clamp-2 min-h-[2.6em] font-semibold text-[#111827] text-[14px] md:text-[16px] leading-tight">
                <LocalizedClientLink
                  href={`/products/${product.handle}`}
                  className="outline-none hover:underline"
                >
                  {product.title}
                </LocalizedClientLink>
              </h3>
            </>
          )}

          {isImpulseTemplate && !isSportsTemplate && product.handle && (
            <LocalizedClientLink
              href={`/products/${product.handle}`}
              className={`mt-auto inline-flex h-10 items-center justify-center px-4 text-center font-semibold text-sm transition ${impulseBuyButtonClass}`}
            >
              Comprar ahora
            </LocalizedClientLink>
          )}

        </div>
      </article>

      {!isSportsTemplate && (!requiresConfigurator || quickViewOnly) && (
        <ProductQuickViewModal
          product={product}
          open={isOpen}
          onClose={closeModal}
          inStock={inStock}
          countryCode={countryCode}
        />
      )}

      {isMultiVariant && !requiresConfigurator && (
        <QuickAddVariantSheet
          product={product}
          countryCode={countryCode}
          open={variantSheetOpen}
          onClose={() => setVariantSheetOpen(false)}
          openCartOnAdd={isSportsTemplate}
        />
      )}
    </>
  );
}
