"use client";

import { useAddToCartAnimation } from "@lib/context/add-to-cart-animation";
import { useCartStore } from "@lib/stores/cart.store";
import { useWishlist } from "@lib/hooks/use-wishlist";
import { convertToLocale } from "@lib/util/money";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import WishlistButton from "@modules/common/components/wishlist-button";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import { ShoppingCartIcon } from "@heroicons/react/24/outline";
import ProductImage from "@modules/common/components/product-image";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type WishlistProduct = {
  id: string;
  title: string;
  handle: string;
  thumbnail: string | null;
  variant_id: string;
  variant_title: string | null;
  price: number | null;
  currency_code: string | null;
  description: string | null;
};

const ITEMS_PER_PAGE = 8;

function PaginatedGrid({
  products,
  currentPage,
  onPageChange,
  countryCode,
}: {
  products: WishlistProduct[];
  currentPage: number;
  onPageChange: (page: number) => void;
  countryCode: string;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.cart?.items) ?? [];
  const { triggerAnimation } = useAddToCartAnimation();
  const [addingItems, setAddingItems] = useState<Set<string>>(new Set());
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const addedTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const getCartCount = useCallback(
    (variantId: string, productId: string) =>
      (cartItems.find((item) => item.variant_id === variantId) ??
        cartItems.find((item) => item.product_id === productId))
        ?.quantity ?? 0,
    [cartItems],
  );

  const handleAddToCart = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>, product: WishlistProduct) => {
      e.preventDefault();
      e.stopPropagation();
      // No cortar por "add en vuelo": el botón muestra el contador y addItem
      // acumula (lee get() fresco), así que los clicks rápidos suman de a 1.
      // El guard anterior descartaba silenciosamente el clickeo rápido.
      triggerAnimation(e.currentTarget, product.thumbnail || undefined);
      setAddingItems((prev) => new Set(prev).add(product.variant_id));
      await addItem(product.variant_id, 1, countryCode, product.id, undefined, {
        title: product.title,
        handle: product.handle,
        thumbnail: product.thumbnail,
        unitPrice: product.price,
        currencyCode: product.currency_code,
      });
      setAddingItems((prev) => {
        const next = new Set(prev);
        next.delete(product.variant_id);
        return next;
      });
      setAddedItems((prev) => new Set(prev).add(product.variant_id));
      const timer = setTimeout(() => {
        setAddedItems((prev) => {
          const next = new Set(prev);
          next.delete(product.variant_id);
          return next;
        });
      }, 1500);
      addedTimers.current.set(product.variant_id, timer);
    },
    [addItem, countryCode, triggerAnimation],
  );

  const totalPages = Math.ceil(products.length / ITEMS_PER_PAGE);

  useEffect(() => {
    const maxPage = totalPages || 1;
    if (currentPage > maxPage) {
      onPageChange(maxPage);
    }
  }, [currentPage, onPageChange, totalPages]);

  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageProducts = products.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  return (
    <div className="mt-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {pageProducts.map((product) => {
          const cartCount = getCartCount(product.variant_id, product.id);

          return (
          <article
            key={`${product.id}-${product.variant_id}`}
            className="group relative flex flex-col overflow-hidden rounded-[24px] border border-gray-200 bg-white transition hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="relative aspect-square rounded-t-[24px] bg-[#F6F6F6]">
              <LocalizedClientLink
                className="absolute inset-0"
                href={`/products/${product.handle}`}
              >
                <ProductImage
                  alt={product.title}
                  className="object-contain p-4 transition-transform group-hover:scale-105 mix-blend-multiply"
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  src={product.thumbnail}
                />
              </LocalizedClientLink>

              <div className="absolute right-3 top-3 z-10">
                <WishlistButton
                  productId={product.id}
                  variantId={product.variant_id}
                  size="sm"
                />
              </div>

              <button
                aria-label="Agregar al carrito"
                className="absolute bottom-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-[--primary-color] bg-[--primary-color] text-white shadow-sm transition hover:scale-110 hover:opacity-90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                disabled={!product.variant_id}
                onClick={(e) => handleAddToCart(e, product)}
                type="button"
              >
                {cartCount > 0 ? (
                  <span className="flex h-full w-full items-center justify-center rounded-full bg-[--primary-color] font-bold text-white text-xs">
                    {cartCount}
                  </span>
                ) : addingItems.has(product.variant_id) ? (
                  <svg
                    className="h-4 w-4 animate-spin text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      fill="currentColor"
                    />
                  </svg>
                ) : addedItems.has(product.variant_id) ? (
                  <svg
                    className="h-4 w-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4.5 12.75l6 6 9-13.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  <ShoppingCartIcon className="h-4 w-4 text-white" />
                )}
              </button>
            </div>

            <LocalizedClientLink
              className="flex flex-col p-3 md:p-4"
              href={`/products/${product.handle}`}
            >
              {product.price !== null && (
                <p className="font-semibold text-[#111827] text-[16px] leading-tight">
                  ${" "}
                  {convertToLocale({
                    amount: product.price,
                    currency_code: product.currency_code || "ars",
                  })}
                </p>
              )}
              <h3 className="mt-1 truncate font-semibold text-[#111827] text-[14px] leading-tight">
                {product.title}
              </h3>
              {product.description && (
                <p className="mt-0.5 line-clamp-2 text-gray-500 text-xs">
                  {product.description}
                </p>
              )}
            </LocalizedClientLink>
          </article>
          );
        })}
      </div>

      {totalPages > 1 && (
        <nav
          aria-label="Paginación de favoritos"
          className="mt-6 flex items-center justify-between border-t border-gray-200 pt-4"
        >
          <p className="text-gray-500 text-sm">
            Mostrando{" "}
            <span className="font-semibold text-gray-900">{startIdx + 1}</span>
            {" - "}
            <span className="font-semibold text-gray-900">
              {Math.min(startIdx + ITEMS_PER_PAGE, products.length)}
            </span>{" "}
            de{" "}
            <span className="font-semibold text-gray-900">
              {products.length}
            </span>{" "}
            productos
          </p>

          <div className="flex items-center gap-1">
            <button
              aria-label="Página anterior"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              type="button"
            >
              <ChevronLeftIcon className="h-4 w-4" />
            </button>

            {Array.from({ length: totalPages }, (_, index) => index + 1).map(
              (page) => (
                <button
                  key={page}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors ${
                    page === currentPage
                      ? "bg-[--primary-color] text-white"
                      : "border border-gray-200 text-gray-700 hover:bg-gray-50"
                  }`}
                  onClick={() => onPageChange(page)}
                  type="button"
                >
                  {page}
                </button>
              ),
            )}

            <button
              aria-label="Página siguiente"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              type="button"
            >
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}

const WishlistOverview = () => {
  const { items, isLoaded, isFetching } = useWishlist();
  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const { countryCode } = useParams() as { countryCode: string };

  const fetchProducts = useCallback(async () => {
    if (!isLoaded || items.length === 0) {
      setProducts([]);
      return;
    }

    setIsLoadingProducts(true);

    try {
      const productIds = Array.from(new Set(items.map((item) => item.product_id)));
      const response = await fetch(
        `/api/store/wishlist/products?ids=${productIds.join(",")}&country_code=${countryCode}`,
      );
      const data: {
        success: boolean;
        products?: Array<{
          id: string;
          title: string;
          handle: string;
          thumbnail: string | null;
          description: string | null;
          subtitle: string | null;
          variants: Array<{
            id: string;
            title: string | null;
            calculated_price?: {
              calculated_amount: number;
              currency_code: string;
            } | null;
          }>;
        }>;
      } = await response.json();

      if (!data.success || !data.products) {
        setProducts([]);
        return;
      }

      const mappedProducts = items
        .map((item) => {
          const product = data.products?.find((entry) => entry.id === item.product_id);
          if (!product) {
            return null;
          }

          const variant = product.variants?.find(
            (entry) => entry.id === item.product_variant_id,
          );

          const rawSubtitle = product.subtitle?.trim() || "";
          const isPlaceholderSubtitle = /^[—-]+$/.test(rawSubtitle);
          const description =
            rawSubtitle && !isPlaceholderSubtitle
              ? rawSubtitle
              : product.description?.trim() || null;

          return {
            id: product.id,
            title: product.title,
            handle: product.handle,
            thumbnail: product.thumbnail,
            variant_id: item.product_variant_id,
            variant_title: variant?.title ?? null,
            price: variant?.calculated_price?.calculated_amount ?? null,
            currency_code: variant?.calculated_price?.currency_code ?? null,
            description,
          };
        })
        .filter((product): product is WishlistProduct => product !== null);

      setProducts(mappedProducts);
    } catch {
      setProducts([]);
    } finally {
      setIsLoadingProducts(false);
    }
  }, [isLoaded, items, countryCode]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  if (isFetching || isLoadingProducts) {
    return (
      <div className="space-y-12" data-testid="wishlist-page-wrapper">
        <div>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div
                key={item}
                className="animate-pulse overflow-hidden rounded-[24px] border border-gray-200 bg-white"
              >
                <div className="aspect-square rounded-t-[24px] bg-gray-200" />
                <div className="p-3 md:p-4">
                  <div className="h-4 w-1/2 rounded bg-gray-200" />
                  <div className="mt-2 h-4 w-3/4 rounded bg-gray-200" />
                  <div className="mt-1.5 h-3 w-full rounded bg-gray-200" />
                  <div className="mt-1 h-3 w-4/5 rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12" data-testid="wishlist-page-wrapper">
      <div>
        {products.length === 0 && isLoaded ? (
          <div className="mt-8 rounded-2xl bg-white px-6 py-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-300"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="mt-4 text-gray-500 text-sm">
              Todavía no agregaste productos a tus favoritos.
            </p>
            <LocalizedClientLink
              className="mt-4 inline-flex justify-center rounded-md bg-[--primary-color] px-4 py-2 font-semibold text-sm text-white shadow-none hover:opacity-90"
              href="/store"
            >
              Explorar productos
            </LocalizedClientLink>
          </div>
        ) : (
          <PaginatedGrid
            countryCode={countryCode}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            products={products}
          />
        )}
      </div>
    </div>
  );
};

export default WishlistOverview;
