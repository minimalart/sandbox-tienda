"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ShoppingCartIcon,
} from "@heroicons/react/24/outline";
import { useTypesenseProducts } from "@lib/hooks/use-typesense-products";
import { useCartStore } from "@lib/stores/cart.store";
import { convertToLocale } from "@lib/util/money";
import {
  PLACEHOLDER_IMAGE,
  handleImageError,
} from "@lib/util/placeholder-image";
import DisneyBadge from "@modules/common/components/disney-badge";
import { useCallback, useEffect, useRef, useState } from "react";

type CarouselProduct = {
  id: string;
  title: string;
  handle: string;
  thumbnail: string | null;
  discount?: number;
  subtotal?: number;
  price?: number;
  variants: {
    id: string;
    title: string;
    calculated_price?: {
      calculated_amount: number;
      original_amount: number;
      currency_code: string;
    };
  }[];
};

const EMPTY_ITEMS: never[] = [];

type CheckoutCarouselProps = {
  countryCode: string;
  /** Canal del carrito: el checkout vive en su propio route group y no siempre
   *  hereda el canal del demo vía contexto, así que lo pasamos explícito para
   *  no traer productos de otro sales channel. */
  salesChannelId?: string;
};

export default function CheckoutCarousel({
  countryCode,
  salesChannelId,
}: CheckoutCarouselProps) {
  const { products, isLoading: loading } = useTypesenseProducts({
    limit: 12,
    sortBy: "created_at",
    salesChannelId,
  });
  const [addingId, setAddingId] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.cart?.items) ?? EMPTY_ITEMS;

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    updateScrollButtons();
  }, [updateScrollButtons]);

  const scroll = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const scrollAmount = el.clientWidth * 0.8;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  }, []);

  const getCartCount = (variantId: string, productId?: string) =>
    (cartItems.find((i) => i.variant_id === variantId) ??
      (productId ? cartItems.find((i) => i.product_id === productId) : undefined))
      ?.quantity ?? 0;

  const handleAddToCart = async (product: CarouselProduct) => {
    const variant = product.variants?.[0];
    if (!variant) {
      return;
    }
    setAddingId(variant.id);
    try {
      await addItem(variant.id, 1, countryCode, product.id, undefined, {
        title: product.title,
        handle: product.handle,
        thumbnail: product.thumbnail,
        unitPrice:
          variant.calculated_price?.calculated_amount ??
          product.subtotal ??
          product.price,
        currencyCode: variant.calculated_price?.currency_code,
      });
    } finally {
      setAddingId(null);
    }
  };

  const renderAddButton = (isAdding: boolean, cartCount: number) => {
    if (cartCount > 0) {
      return (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-[--primary-color] font-bold text-white text-xs">
          {cartCount}
        </span>
      );
    }
    if (isAdding) {
      return (
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
      );
    }
    return <ShoppingCartIcon className="h-3.5 w-3.5 text-white" />;
  };

  if (loading) {
    return (
      <div className="mb-6">
        <div className="mx-auto mb-3 h-5 w-64 animate-pulse rounded bg-gray-200" />
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              className="h-16 w-[22%] shrink-0 animate-pulse rounded-xl bg-gray-100"
              key={i}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!products.length) {
    return null;
  }

  return (
    <div className="mb-6">
      <p className="mb-3 text-center font-semibold text-gray-700 text-sm">
        ¿Te quedaste con ganas de agregar algo más?
      </p>

      {/* Carousel with arrows */}
      <div className="relative">
        {/* Left arrow */}
        {canScrollLeft && (
          <button
            aria-label="Anterior"
            className="absolute top-1/2 left-0 z-10 flex h-8 w-8 -translate-y-1/2 -translate-x-1/2 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md transition hover:bg-gray-50"
            onClick={() => scroll("left")}
            type="button"
          >
            <ChevronLeftIcon className="h-4 w-4 text-gray-600" />
          </button>
        )}

        {/* Right arrow */}
        {canScrollRight && (
          <button
            aria-label="Siguiente"
            className="absolute top-1/2 right-0 z-10 flex h-8 w-8 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md transition hover:bg-gray-50"
            onClick={() => scroll("right")}
            type="button"
          >
            <ChevronRightIcon className="h-4 w-4 text-gray-600" />
          </button>
        )}

        {/* Scrollable track — shows ~4.5 items */}
        <div
          className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth px-1"
          onScroll={updateScrollButtons}
          ref={scrollRef}
        >
          {products.map((product) => {
            const variant = product.variants?.[0];
            const price = variant?.calculated_price;
            const isAdding = addingId === variant?.id;
            const cartCount = variant ? getCartCount(variant.id, product.id) : 0;

            // Check for Typesense discount data
            const hasTypesenseDiscount = (product.discount ?? 0) > 0 && (product.subtotal ?? 0) > 0;
            
            // Calculate display price
            const displayAmount = hasTypesenseDiscount 
              ? product.subtotal!
              : price?.calculated_amount;
            
            const currencyCode = price?.currency_code || "ARS";

            return (
              <div
                className="flex w-[60%] shrink-0 snap-start items-center gap-2 rounded-xl border border-gray-200 bg-white px-2.5 py-2 shadow-sm sm:w-[22%] sm:min-w-[140px]"
                key={product.id}
              >
                {/* Thumbnail */}
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                  <img
                    alt={product.title}
                    // object-contain: con object-cover las imágenes verticales
                    // se recortaban y se veían incompletas.
                    className="h-full w-full object-contain p-0.5"
                    height={40}
                    onError={handleImageError}
                    src={product.thumbnail || PLACEHOLDER_IMAGE}
                    width={40}
                  />
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900 text-xs leading-tight">
                    {product.title}
                  </p>
                  {displayAmount && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <p className="font-semibold text-[--primary-color] text-xs">
                        ${" "}
                        {convertToLocale({
                          amount: displayAmount,
                          currency_code: currencyCode,
                          minimumFractionDigits: 0,
                          maximumFractionDigits: 0,
                          locale: "es-AR",
                        })}
                      </p>
                      {hasTypesenseDiscount && product.price && (
                        <p className="text-gray-400 text-[10px] line-through">
                          ${" "}
                          {convertToLocale({
                            amount: product.price,
                            currency_code: "ARS",
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                            locale: "es-AR",
                          })}
                        </p>
                      )}
                      {!hasTypesenseDiscount && (
                        <DisneyBadge productId={product.id} />
                      )}
                    </div>
                  )}
                </div>

                {/* Add button — shows count pill after first add */}
                <button
                  aria-label="Agregar"
                  className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[--primary-color] bg-[--primary-color] text-white transition hover:opacity-90 disabled:opacity-40"
                  disabled={!variant}
                  onClick={() => handleAddToCart(product)}
                  type="button"
                >
                  {renderAddButton(isAdding, cartCount)}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
