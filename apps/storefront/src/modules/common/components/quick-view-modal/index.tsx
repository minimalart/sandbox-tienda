"use client";

import { Dialog, DialogPanel } from "@headlessui/react";
import { isTintableProduct } from "@lib/util/tinting";
import {
  ArrowsPointingOutIcon,
  ChevronRightIcon,
  ShareIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { isNewProduct } from "@lib/util/is-new-product";
import { usesQuickViewOnly } from "@lib/site-config/template-helpers";
import { useTenant } from "@lib/site-config/context";
import {
  PLACEHOLDER_IMAGE,
  handleImageError,
} from "@lib/util/placeholder-image";
import type { HttpTypes } from "@medusajs/types";
import ImageZoomModal from "@modules/common/components/image-zoom-modal";
import NewBadge from "@modules/common/components/new-badge";
import ProductActions from "@modules/products/components/product-actions";
import OptionSelect from "@modules/products/components/product-actions/option-select";
import {
  ProductColorLabels,
  ProductSizeLabel,
} from "@modules/common/components/variant-labels";
import { useProductVariantSelection } from "@modules/products/components/product-actions/use-variant-selection";
import ProductPrice from "@modules/products/components/product-price";
import WishlistButton from "@modules/common/components/wishlist-button";
import CompareButton from "@modules/common/components/compare-button";
import { useUIStore } from "@lib/stores/ui.store";
import { AnimatePresence, motion } from "framer-motion";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import LocalizedClientLink from "../localized-client-link";

type QuickViewProduct = {
  id?: string;
  title?: string | null;
  handle?: string | null;
  description?: string | null;
  thumbnail?: string | null;
  images?: Array<{ url: string; [key: string]: any }> | null;
  categories?: Array<{ id: string; name: string; handle?: string }> | null;
  variants?: Array<{
    id: string;
    title?: string | null;
    sku?: string | null;
    calculated_price?: {
      calculated_amount: number | null;
      currency_code: string | null;
      [key: string]: any;
    };
    [key: string]: any;
  }> | null;
  [key: string]: any;
  tags?: Array<{ id: string; value: string }> | null;
  promotions?: Array<{
    application_method?: {
      type?: string;
      value?: number | number[];
      max_quantity?: number;
    };
    status?: string;
    code?: string;
    type?: string;
  }>;
};

type ProductQuickViewModalProps = {
  product: QuickViewProduct;
  region?: HttpTypes.StoreRegion;
  open: boolean;
  onClose: () => void;
  inStock?: boolean;
  useSecondImage?: boolean;
  countryCode?: string;
  /**
   * Sin salidas a otras paginas: ni chips de categoria ni "Ver ficha completa".
   * Lo usa el checkout, donde el quick view existe justamente para que el
   * cliente vea el detalle y agregue SIN irse del checkout.
   */
  lockNavigation?: boolean;
};

const ProductQuickViewModal = ({
  product,
  region,
  open,
  onClose,
  inStock,
  useSecondImage,
  countryCode,
  lockNavigation = false,
}: ProductQuickViewModalProps) => {
  const [zoomOpen, setZoomOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [hydratedProduct, setHydratedProduct] =
    useState<QuickViewProduct | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressImageClickRef = useRef(false);
  const tenant = useTenant();
  const quickViewOnly = usesQuickViewOnly(tenant.template);
  const params = useParams<{ countryCode?: string }>();
  const activeCountryCode = countryCode || params?.countryCode || "ar";
  const salesChannelId = tenant.medusa?.salesChannelId;

  // Sincronizamos el estado del modal con el store global de UI para que la
  // barra de navegación inferior (mobile) se oculte mientras el quick view
  // está abierto. De lo contrario se ve atenuada por detrás del overlay
  // semitransparente, asomando debajo del modal.
  const openQuickView = useUIStore((s) => s.openQuickView);
  const closeQuickView = useUIStore((s) => s.closeQuickView);
  useEffect(() => {
    if (open) {
      openQuickView();
      return () => closeQuickView();
    }
  }, [open, openQuickView, closeQuickView]);

  useEffect(() => {
    if (!open || (!product.id && !product.handle)) {
      setHydratedProduct(null);
      return;
    }

    const controller = new AbortController();
    const query = new URLSearchParams({ countryCode: activeCountryCode });
    if (salesChannelId) {
      query.set("salesChannelId", salesChannelId);
    }

    setHydratedProduct(null);
    setLoading(true);
    setLoadFailed(false);
    if (product.id) query.set("id", product.id);
    else if (product.handle) query.set("handle", product.handle);

    fetch(`/api/store/product?${query}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { product?: QuickViewProduct } | null) => {
        if (!controller.signal.aborted) {
          setHydratedProduct(data?.product ?? null);
          setLoadFailed(!data?.product);
        }
      })
      .catch((error) => {
        if (error?.name !== "AbortError") {
          console.warn("[QuickView] Failed to hydrate product:", error);
          setLoadFailed(true);
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });

    return () => controller.abort();
  }, [open, product.id, product.handle, activeCountryCode, salesChannelId]);

  const displayProduct: QuickViewProduct = hydratedProduct
    ? {
        ...product,
        ...hydratedProduct,
        categories:
          hydratedProduct.categories && hydratedProduct.categories.length > 0
            ? hydratedProduct.categories
            : product.categories,
        discount: product.discount ?? hydratedProduct.discount,
        subtotal: product.subtotal ?? hydratedProduct.subtotal,
        price: product.price ?? hydratedProduct.price,
        promotions: product.promotions ?? hydratedProduct.promotions,
        stock_available:
          product.stock_available ?? hydratedProduct.stock_available,
      }
    : product;

  // Variant/size selection shared with the add-to-cart button below: the size
  // dropdown is rendered next to the price (see below) while ProductActions
  // renders the button, both driven by this single selection.
  const variantSelection = useProductVariantSelection(
    displayProduct as HttpTypes.StoreProduct,
  );

  const fallbackImage = useSecondImage
    ? displayProduct.images?.[1]?.url ||
      displayProduct.thumbnail ||
      displayProduct.images?.[0]?.url ||
      PLACEHOLDER_IMAGE
    : displayProduct.thumbnail ||
      displayProduct.images?.[0]?.url ||
      PLACEHOLDER_IMAGE;

  const galleryImages = (() => {
    const list: { url: string; id?: string | null }[] = [];
    if (displayProduct.thumbnail) list.push({ url: displayProduct.thumbnail });
    (displayProduct.images ?? []).forEach((img) => {
      if (img?.url && !list.some((i) => i.url === img.url)) {
        list.push({ url: img.url });
      }
    });
    if (list.length === 0 && fallbackImage) list.push({ url: fallbackImage });
    return list;
  })();
  const modalImage = galleryImages[selectedImageIndex]?.url ?? fallbackImage;
  const zoomImages = galleryImages;

  useEffect(() => {
    if (open) setSelectedImageIndex(0);
  }, [open, product.id]);

  const handleImageTouchStart = (event: React.TouchEvent<HTMLButtonElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleImageTouchEnd = (event: React.TouchEvent<HTMLButtonElement>) => {
    if (galleryImages.length <= 1 || !touchStartRef.current) return;
    const touch = event.changedTouches[0];
    if (!touch) return;

    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.abs(deltaX) < 40 || Math.abs(deltaX) <= Math.abs(deltaY)) {
      return;
    }

    suppressImageClickRef.current = true;
    setSelectedImageIndex((current) =>
      deltaX < 0
        ? (current + 1) % galleryImages.length
        : (current - 1 + galleryImages.length) % galleryImages.length,
    );
    window.setTimeout(() => {
      suppressImageClickRef.current = false;
    }, 0);
  };

  const handleShare = async () => {
    const path = displayProduct.handle
      ? `/products/${displayProduct.handle}`
      : window.location.pathname;
    const url = new URL(path, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({ title: displayProduct.title ?? "Producto", url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // Ignore cancelled native share sheets.
    }
  };

  const compareProduct =
    displayProduct.id && displayProduct.title
      ? {
          id: displayProduct.id,
          title: displayProduct.title,
          handle: displayProduct.handle,
          thumbnail:
            displayProduct.thumbnail ||
            displayProduct.images?.[0]?.url ||
            PLACEHOLDER_IMAGE,
          brandName: displayProduct.brand?.name,
          categoryName:
            displayProduct.categories?.[displayProduct.categories.length - 1]
              ?.name,
          sku: displayProduct.variants?.[0]?.sku,
        }
      : null;

  return (
    <>
    <AnimatePresence>
      {open && (
        <Dialog className="relative z-[10000]" onClose={onClose} open={open}>
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-gray-500/75"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          />

          <div className="fixed inset-0 z-[10000] w-screen cursor-modal-close overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-3 text-center sm:p-6">
              <DialogPanel
                as="div"
                className="cursor-auto relative w-full max-w-[410px] transform max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-[14px] bg-white text-left shadow-2xl sm:my-8 sm:max-h-[calc(100dvh-4rem)] sm:max-w-[980px]"
              >
                <motion.div
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                >
                  <div className="px-5 pt-12 pb-4 sm:p-6 lg:px-8 lg:pt-8 lg:pb-6">
                    <div className="absolute top-4 right-4 z-20">
                      <button
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-900 focus:outline-none sm:h-10 sm:w-10"
                        onClick={onClose}
                        type="button"
                      >
                        <span className="sr-only">Cerrar</span>
                        <XMarkIcon aria-hidden="true" className="h-6 w-6" />
                      </button>
                    </div>

                    <div className="flex flex-col gap-3 sm:grid sm:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] sm:gap-8 lg:gap-10">
                      <div className="min-w-0">
                        <button
                          aria-label="Ampliar imagen"
                          className="relative mx-auto flex aspect-[1.25/1] max-h-[30dvh] w-full max-w-[305px] items-center justify-center overflow-hidden rounded-xl bg-white sm:max-h-[44dvh] sm:max-w-none sm:bg-white sm:p-4"
                          onClick={() => {
                            if (suppressImageClickRef.current) return;
                            setZoomOpen(true);
                          }}
                          onTouchEnd={handleImageTouchEnd}
                          onTouchStart={handleImageTouchStart}
                          type="button"
                        >
                          {/* Badge de estado + colores del producto en un solo
                              stack, para que no se solapen en la esquina. */}
                          <div className="pointer-events-none absolute top-2 left-2 z-20 flex max-w-[calc(100%-4rem)] flex-col items-start gap-1.5">
                            {inStock === false ? (
                              <span className="inline-flex w-[70px] h-[24px] items-center justify-center rounded-[8px] border-2 border-[#1E8BB4] bg-transparent font-bold text-[11px] uppercase tracking-wide text-[#1E8BB4]">
                                Sin Stock
                              </span>
                            ) : isNewProduct(product) ? (
                              <NewBadge />
                            ) : null}
                            <ProductColorLabels options={displayProduct.options} />
                          </div>
                          <img
                            alt={displayProduct.title ?? "Producto"}
                            className="product-image-blend h-full w-full object-contain"
                            onError={handleImageError}
                            src={modalImage}
                          />
                          <span className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-md sm:h-11 sm:w-11">
                            <ArrowsPointingOutIcon className="h-4 w-4 text-gray-600 sm:h-5 sm:w-5" />
                          </span>
                          <ProductSizeLabel
                            className="pointer-events-none absolute bottom-2 left-2 z-20 max-w-[calc(100%-1rem)]"
                            options={displayProduct.options}
                          />
                        </button>

                        {galleryImages.length > 1 && (
                          <>
                            <div className="mt-5 flex items-center justify-center gap-2 sm:hidden">
                              {galleryImages.slice(0, 6).map((image, index) => (
                                <button
                                  key={`${image.url}-${index}`}
                                  aria-label={`Ver imagen ${index + 1}`}
                                  className={`h-2 w-2 rounded-full transition ${
                                    index === selectedImageIndex
                                      ? "w-3 bg-[--primary-color]"
                                      : "bg-gray-300"
                                  }`}
                                  onClick={() => setSelectedImageIndex(index)}
                                  type="button"
                                />
                              ))}
                            </div>

                            <div className="mt-3 hidden items-center gap-3 sm:flex">
                              <div className="flex min-w-0 flex-1 gap-3 overflow-hidden">
                                {galleryImages.slice(0, 5).map((image, index) => (
                                  <button
                                    key={`${image.url}-${index}`}
                                    aria-label={`Ver imagen ${index + 1}`}
                                    className={`relative h-[78px] w-[78px] shrink-0 overflow-hidden rounded-lg border bg-white p-1.5 transition ${
                                      index === selectedImageIndex
                                        ? "border-[--primary-color] shadow-[0_0_0_1px_var(--primary-color)]"
                                        : "border-gray-200 hover:border-gray-300"
                                    }`}
                                    onClick={() => setSelectedImageIndex(index)}
                                    type="button"
                                  >
                                    <img
                                      alt=""
                                      className="product-image-blend h-full w-full object-contain"
                                      onError={handleImageError}
                                      src={image.url}
                                    />
                                  </button>
                                ))}
                              </div>
                              {galleryImages.length > 5 && (
                                <button
                                  aria-label="Ver más imágenes"
                                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-gray-700 shadow-md"
                                  onClick={() =>
                                    setSelectedImageIndex((selectedImageIndex + 1) % galleryImages.length)
                                  }
                                  type="button"
                                >
                                  <ChevronRightIcon className="h-5 w-5" />
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>

                      <div className="min-w-0 text-left sm:pt-2">
                        {!quickViewOnly && displayProduct.categories &&
                          displayProduct.categories.length > 0 && (
                            <div className="mb-3 flex flex-wrap gap-1.5">
                              {displayProduct.categories.map((cat, index) =>
                                (cat.handle || cat.name) && lockNavigation ? (
                                  <span
                                    className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700"
                                    key={cat.id}
                                  >
                                    {cat.name || cat.handle}
                                  </span>
                                ) : cat.handle || cat.name ? (
                                  <LocalizedClientLink
                                    className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-[--primary-color] hover:text-white"
                                    // El filtro de la tienda usa el NOMBRE de la
                                    // categoría (no el handle/slug): ?category= se
                                    // parsea como lista de nombres separados por
                                    // coma. Usar el handle caía en "sin productos".
                                    href={`/store?category=${encodeURIComponent(cat.name || cat.handle || "")}`}
                                    key={cat.id}
                                    onClick={onClose}
                                  >
                                    {cat.name || cat.handle}
                                  </LocalizedClientLink>
                                ) : (
                                  <span
                                    className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-400 cursor-default"
                                    key={`${cat.id}${index}`}
                                  >
                                    {cat.id}
                                  </span>
                                ),
                              )}
                            </div>
                          )}

                        <h2 className="mb-3 font-bold text-[22px] leading-tight text-gray-950 sm:text-[28px]">
                          {displayProduct.title || "Producto"}
                        </h2>
                        {loading && !product.id && <p role="status" className="mb-3 text-sm text-gray-600">Cargando producto…</p>}
                        {loadFailed && !product.id && <p role="alert" className="mb-3 text-sm text-gray-600">No pudimos cargar el producto. Cerrá esta ventana y volvé a intentarlo.</p>}

                        {displayProduct.description && (
                          <p className="mb-3 line-clamp-2 text-gray-600 text-sm leading-relaxed sm:mb-6 sm:line-clamp-4 sm:text-base">
                            {displayProduct.description}
                          </p>
                        )}

                        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
                          <ProductPrice
                            product={displayProduct as HttpTypes.StoreProduct}
                            variant={variantSelection.selectedVariant}
                          />
                          {variantSelection.selectableOptions.length > 0 && (
                            <div className="flex shrink-0 flex-col gap-3">
                              {variantSelection.selectableOptions.map(
                                ({ option }) => (
                                  <OptionSelect
                                    key={option.id}
                                    current={variantSelection.options[option.id]}
                                    disabled={false}
                                    layout="dropdown"
                                    option={option}
                                    title={option.title ?? ""}
                                    updateOption={variantSelection.setOptionValue}
                                  />
                                ),
                              )}
                            </div>
                          )}
                        </div>

                        {!quickViewOnly && <div className="mt-4 flex items-center gap-2 border-y border-gray-100 py-2.5 sm:mt-8 sm:py-3 sm:border-b-0">
                          {displayProduct.id && displayProduct.variants?.[0]?.id && (
                            <div className="pr-4">
                              <WishlistButton
                                productId={displayProduct.id}
                                variantId={displayProduct.variants[0].id}
                                size="sm"
                                label="Favoritos"
                              />
                            </div>
                          )}
                          {compareProduct && (
                            <div className="border-l border-gray-100 pl-4">
                              <CompareButton
                                product={compareProduct}
                                size="sm"
                                label="Comparar"
                              />
                            </div>
                          )}
                          <button
                            type="button"
                            className="group flex items-center gap-2 border-l border-gray-100 pl-4 font-semibold text-gray-900 text-sm transition-colors hover:text-[--primary-color]"
                            onClick={handleShare}
                          >
                            <ShareIcon className="h-5 w-5 text-gray-500 transition-colors group-hover:text-[--primary-color]" />
                            Compartir
                          </button>
                        </div>}
                      </div>
                    </div>
                  </div>

                  <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-8 sm:pb-8">
                    <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
                      {!quickViewOnly && !lockNavigation && <LocalizedClientLink
                        href={`/products/${displayProduct.handle}`}
                        className="inline-flex items-center justify-center gap-2 font-semibold text-[--primary-color] text-sm sm:justify-start"
                        onClick={onClose}
                      >
                        Ver ficha completa
                        <ChevronRightIcon className="h-4 w-4" />
                      </LocalizedClientLink>}
                      <div className={`w-full sm:w-auto ${quickViewOnly || lockNavigation ? "sm:ml-auto" : ""}`}>
                        {(displayProduct.is_giftcard || isTintableProduct(displayProduct as never)) && quickViewOnly ? (
                          <p className="text-sm text-gray-600">Este producto requiere personalización y no está disponible en esta campaña.</p>
                        ) : displayProduct.is_giftcard || isTintableProduct(displayProduct as never) ? (
                          // Las gift cards se personalizan (diseño, monto,
                          // destinatario, entrega) en su propia página. El quick
                          // view no puede hacer eso, así que forzamos la
                          // navegación al configurador.
                          <LocalizedClientLink
                            href={`/products/${displayProduct.handle}`}
                            onClick={onClose}
                            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[--primary-color] px-6 font-semibold text-white transition hover:opacity-90 sm:w-auto"
                          >
                            Personalizar gift card
                            <ChevronRightIcon className="h-4 w-4" />
                          </LocalizedClientLink>
                        ) : displayProduct.id ? (
                          <ProductActions
                            inline
                            product={displayProduct as HttpTypes.StoreProduct}
                            region={region}
                            hidePrice
                            inStock={inStock}
                            selection={variantSelection}
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </DialogPanel>
            </div>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
    <ImageZoomModal
      open={zoomOpen}
      onClose={() => setZoomOpen(false)}
      images={zoomImages}
      alt={displayProduct.title ?? "Producto"}
    />
    </>
  );
};

export default ProductQuickViewModal;
