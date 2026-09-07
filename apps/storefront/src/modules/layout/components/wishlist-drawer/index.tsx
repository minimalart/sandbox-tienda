"use client";

import { useWishlistDrawerStore } from "@lib/stores/wishlist-drawer.store";
import { useWishlist } from "@lib/hooks/use-wishlist";
import { useCartStore } from "@lib/stores/cart.store";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import Thumbnail from "@modules/products/components/thumbnail";
import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import {
  HeartIcon,
  ShoppingCartIcon,
  TrashIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { AnimatePresence, motion } from "framer-motion";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type WishlistProduct = {
  id: string;
  title: string;
  handle: string;
  thumbnail: string | null;
  variant_id: string;
  variant_title: string | null;
  images: { url?: string | null }[];
};

const WishlistDrawer = () => {
  const isOpen = useWishlistDrawerStore((state) => state.isOpen);
  const closeDrawer = useWishlistDrawerStore((state) => state.close);
  const { items, isLoaded, isFetching, toggleItem } = useWishlist();
  const [products, setProducts] = useState<WishlistProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [addingVariantId, setAddingVariantId] = useState<string | null>(null);
  const addItem = useCartStore((state) => state.addItem);
  const cartItems = useCartStore((s) => s.cart?.items) ?? [];
  const params = useParams() as { countryCode?: string };
  const countryCode = params?.countryCode ?? "ar";

  const getCartCount = (variantId: string, productId: string) =>
    (cartItems.find((i) => i.variant_id === variantId) ??
      cartItems.find((i) => i.product_id === productId))
      ?.quantity ?? 0;

  const handleAddToCart = useCallback(
    async (product: WishlistProduct) => {
      if (!product.variant_id) return;
      setAddingVariantId(product.variant_id);
      try {
        await addItem(product.variant_id, 1, countryCode, product.id, undefined, {
          title: product.title,
          handle: product.handle,
          thumbnail: product.thumbnail || product.images?.[0]?.url,
        });
      } finally {
        setAddingVariantId(null);
      }
    },
    [addItem, countryCode],
  );

  const fetchProducts = useCallback(async () => {
    if (!isLoaded || items.length === 0) {
      setProducts([]);
      return;
    }

    setIsLoadingProducts(true);

    try {
      const productIds = Array.from(
        new Set(items.map((item) => item.product_id)),
      );
      const response = await fetch(
        `/api/store/wishlist/products?ids=${productIds.join(",")}`,
      );
      const data: {
        success: boolean;
        products?: Array<{
          id: string;
          title: string;
          handle: string;
          thumbnail: string | null;
          images?: { url?: string | null }[];
          variants: Array<{ id: string; title: string | null }>;
        }>;
      } = await response.json();

      if (!data.success || !data.products) {
        setProducts([]);
        return;
      }

      const mappedProducts = items
        .map((item) => {
          const product = data.products?.find(
            (entry) => entry.id === item.product_id,
          );
          if (!product) {
            return null;
          }

          const variant = product.variants?.find(
            (entry) => entry.id === item.product_variant_id,
          );

          return {
            id: product.id,
            title: product.title,
            handle: product.handle,
            thumbnail: product.thumbnail,
            images: product.images || [],
            variant_id: item.product_variant_id,
            variant_title: variant?.title ?? null,
          };
        })
        .filter((product): product is WishlistProduct => product !== null);

      setProducts(mappedProducts);
    } catch {
      setProducts([]);
    } finally {
      setIsLoadingProducts(false);
    }
  }, [isLoaded, items]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return (
    <AnimatePresence>
      {isOpen && (
        <Dialog className="relative z-[9000]" onClose={closeDrawer} open={isOpen}>
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/30"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          <div className="fixed inset-0 overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
              <div className="pointer-events-none absolute inset-y-0 right-0 flex max-w-full sm:pl-16">
                <DialogPanel
                  as="div"
                  className="pointer-events-auto w-screen sm:max-w-md"
                >
                  <motion.div
                    animate={{ x: 0 }}
                    className="h-full"
                    exit={{ x: "100%" }}
                    initial={{ x: "100%" }}
                    transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <div className="flex h-full flex-col overflow-hidden bg-white shadow-xl">
                      <div className="border-gray-100 border-b">
                        <div className="flex h-[68px] items-center justify-between px-4 sm:px-6">
                          <DialogTitle className="flex items-center gap-2 font-bold text-gray-900 text-xl">
                            Favoritos
                            {items.length > 0 && (
                              <span className="inline-flex items-center justify-center rounded-full bg-[--primary-color] px-2 py-[3px] font-normal text-xs text-white">
                                {items.length} {items.length === 1 ? "producto" : "productos"}
                              </span>
                            )}
                          </DialogTitle>
                          <button
                            aria-label="Cerrar panel"
                            className="flex h-10 w-10 items-center justify-center text-gray-500 transition-colors hover:text-gray-900"
                            onClick={closeDrawer}
                            type="button"
                          >
                            <span className="sr-only">Cerrar panel</span>
                            <XMarkIcon aria-hidden="true" className="size-5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto bg-[--badge-bg] px-3 py-6 sm:px-6">
                        {isFetching || isLoadingProducts ? (
                          <div className="space-y-4">
                            {[1, 2, 3].map((item) => (
                              <div
                                key={item}
                                className="animate-pulse rounded-2xl border border-gray-200 bg-white p-4"
                              >
                                <div className="h-16 rounded-xl bg-gray-200" />
                              </div>
                            ))}
                          </div>
                        ) : products.length > 0 ? (
                          <ul className="space-y-3">
                            {products.map((product) => (
                              <li
                                key={`${product.id}-${product.variant_id}`}
                                className="flex items-center gap-3 rounded-2xl bg-white p-3"
                              >
                                <LocalizedClientLink
                                  className="shrink-0"
                                  href={`/products/${product.handle}`}
                                  onClick={closeDrawer}
                                >
                                  <div className="h-16 w-16 overflow-hidden rounded-xl border border-gray-200">
                                    <Thumbnail
                                      images={product.images || []}
                                      size="square"
                                      thumbnail={product.thumbnail || undefined}
                                    />
                                  </div>
                                </LocalizedClientLink>

                                <div className="min-w-0 flex-1">
                                  <LocalizedClientLink
                                    className="block"
                                    href={`/products/${product.handle}`}
                                    onClick={closeDrawer}
                                  >
                                    <p className="truncate font-medium text-gray-900 text-sm">
                                      {product.title}
                                    </p>
                                    {product.variant_title && (
                                      <p className="mt-1 truncate text-gray-500 text-xs">
                                        {product.variant_title}
                                      </p>
                                    )}
                                  </LocalizedClientLink>
                                </div>

                                <div className="flex shrink-0 items-center gap-3.5">
                                  <button
                                    aria-label="Agregar al carrito"
                                    className="relative flex h-8 w-8 items-center justify-center rounded-full border border-[--primary-color] bg-[--primary-color] text-white transition-colors hover:opacity-90 disabled:opacity-40"
                                    disabled={!product.variant_id}
                                    onClick={() => handleAddToCart(product)}
                                    type="button"
                                  >
                                    {getCartCount(product.variant_id, product.id) > 0 ? (
                                      <span className="flex h-full w-full items-center justify-center rounded-full bg-[--primary-color] font-bold text-white text-xs">
                                        {getCartCount(product.variant_id, product.id)}
                                      </span>
                                    ) : addingVariantId === product.variant_id ? (
                                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
                                    ) : (
                                      <ShoppingCartIcon className="h-4 w-4 text-white" />
                                    )}
                                  </button>
                                  <button
                                    aria-label="Quitar de favoritos"
                                    className="text-gray-400 transition-colors hover:text-red-600"
                                    onClick={() =>
                                      toggleItem(
                                        product.id,
                                        product.variant_id,
                                      )
                                    }
                                    type="button"
                                  >
                                    <TrashIcon className="h-5 w-5" />
                                  </button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                            <HeartIcon className="h-14 w-14 text-gray-300" />
                            <div>
                              <p className="font-semibold text-base text-gray-700">
                                Todavía no agregaste favoritos
                              </p>
                              <p className="mt-1 text-gray-500 text-sm">
                                Guardá productos para encontrarlos rápido
                                despues.
                              </p>
                            </div>
                            <LocalizedClientLink
                              className="inline-flex rounded-md bg-[--primary-color] px-4 py-2 font-semibold text-sm text-white hover:opacity-90"
                              href="/store"
                              onClick={closeDrawer}
                            >
                              Explorar productos
                            </LocalizedClientLink>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                </DialogPanel>
              </div>
            </div>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  );
};

export default WishlistDrawer;
