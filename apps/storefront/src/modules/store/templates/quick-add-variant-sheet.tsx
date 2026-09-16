"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useTenant } from "@lib/site-config/context";
import { useCartStore } from "@lib/stores/cart.store";
import type { TypesenseProductDocument } from "@lib/typesense";
import {
  PLACEHOLDER_IMAGE,
  handleImageError,
} from "@lib/util/placeholder-image";
import { clx } from "@medusajs/ui";
import type { HttpTypes } from "@medusajs/types";
import CartDropFlight, {
  startCartDrop,
  useCartDropPhase,
  CART_DROP_MS,
} from "@modules/common/components/cart-drop-flight";
import ProductPrice from "@modules/products/components/product-price";
import { useProductVariantSelection } from "@modules/products/components/product-actions/use-variant-selection";
import { useEffect, useRef, useState } from "react";

type QuickAddVariantSheetProps = {
  product: TypesenseProductDocument;
  countryCode: string;
  open: boolean;
  onClose: () => void;
  /** Abrir el drawer del carrito al agregar (paridad con el template sports). */
  openCartOnAdd?: boolean;
};

// Producto vacío estable para poder llamar al hook de selección de variante
// incondicionalmente (reglas de hooks) mientras se hidrata el producto real.
const EMPTY_PRODUCT = {
  variants: [],
  options: [],
} as unknown as HttpTypes.StoreProduct;

/**
 * Bottom sheet compacto para el quick-add de productos multivariante: el toque
 * en la card abre este selector en vez de agregar `variants[0]` a ciegas. El
 * documento Typesense no trae las options por variante, así que hidratamos el
 * producto completo (mismo endpoint que el quick view) para resolver la
 * variante elegida antes de agregarla.
 */
export default function QuickAddVariantSheet({
  product,
  countryCode,
  open,
  onClose,
  openCartOnAdd,
}: QuickAddVariantSheetProps) {
  const tenant = useTenant();
  const salesChannelId = tenant.medusa?.salesChannelId;
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);


  const [hydrated, setHydrated] = useState<HttpTypes.StoreProduct | null>(null);
  const [adding, setAdding] = useState(false);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  // Hidratar el producto completo al abrir (variants + options), abortando si se
  // cierra antes de resolver.
  useEffect(() => {
    if (!open || !product.id) {
      setHydrated(null);
      return;
    }
    const controller = new AbortController();
    const query = new URLSearchParams({ countryCode, id: product.id });
    if (salesChannelId) query.set("salesChannelId", salesChannelId);

    fetch(`/api/store/product?${query}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { product?: HttpTypes.StoreProduct } | null) => {
        if (!controller.signal.aborted) setHydrated(data?.product ?? null);
      })
      .catch((error) => {
        if (error?.name !== "AbortError") {
          console.warn("[QuickAdd] Failed to hydrate product:", error);
        }
      });

    return () => controller.abort();
  }, [open, product.id, countryCode, salesChannelId]);

  const selection = useProductVariantSelection(hydrated ?? EMPTY_PRODUCT);
  const { selectableOptions, options, setOptionValue, selectedVariant } =
    selection;

  const isLoading = open && !hydrated;
  const thumbnail = product.thumbnail || product.images?.[0]?.url || undefined;

  // Fase de la coreografía del botón (store por variante, ver CartDropFlight).
  const dropPhase = useCartDropPhase(selectedVariant?.id);

  const handleAdd = async () => {
    const variant = selectedVariant;
    if (!variant || adding) return;
    if (!startCartDrop(variant.id)) return;
    setAdding(true);
    const success = await addItem(
      variant.id,
      1,
      countryCode,
      product.id,
      undefined,
      {
        title: product.title,
        handle: product.handle,
        thumbnail,
        unitPrice:
          variant.calculated_price?.calculated_amount ??
          product.subtotal ??
          product.price,
        currencyCode: variant.calculated_price?.currency_code,
      }
    );
    setAdding(false);
    if (success) {
      // Esperamos a que termine la coreografía del botón antes de cerrar: si
      // cerramos al resolver el alta, el sheet se desmonta a los ~200 ms y la
      // animación no se ve nunca.
      await new Promise((resolve) => setTimeout(resolve, CART_DROP_MS));
      if (openCartOnAdd) openCart();
      onClose();
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="bottom"
        className="z-[10001] mx-auto max-h-[85vh] max-w-[520px] overflow-y-auto rounded-t-2xl bg-white pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        overlayClassName="z-[10000] bg-gray-500/75"
      >
        <div className="flex items-start gap-3 pr-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            onError={handleImageError}
            src={thumbnail || PLACEHOLDER_IMAGE}
            className="product-image-blend h-16 w-16 shrink-0 rounded-xl bg-[#F6F6F6] object-contain p-1"
          />
          <div className="min-w-0">
            <h2 className="line-clamp-2 font-semibold text-[15px] text-gray-900 leading-tight">
              {product.title}
            </h2>
            <div className="mt-1">
              {hydrated ? (
                <ProductPrice
                  product={hydrated as HttpTypes.StoreProduct}
                  variant={selectedVariant}
                />
              ) : (
                <div className="h-5 w-24 animate-pulse rounded bg-gray-200" />
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-5">
          {isLoading ? (
            <div className="flex flex-col gap-3">
              <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-11 w-16 animate-pulse rounded-lg bg-gray-200"
                  />
                ))}
              </div>
            </div>
          ) : (
            selectableOptions.map(({ option }) => (
              <div key={option.id} className="flex flex-col gap-2">
                <span className="font-medium text-gray-500 text-xs">
                  {option.title}
                </span>
                <div className="flex flex-wrap gap-2">
                  {(option.values ?? []).map((ov) => {
                    const value = ov.value ?? "";
                    const isSelected = options[option.id] === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setOptionValue(option.id, value)}
                        aria-pressed={isSelected}
                        className={clx(
                          "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border px-4 font-medium text-sm transition-colors",
                          isSelected
                            ? "border-[--primary-color] bg-[--primary-color]/5 text-gray-900 outline outline-2 -outline-offset-2 outline-[--primary-color]"
                            : "border-gray-300 text-gray-700 hover:border-gray-400"
                        )}
                      >
                        {value}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          <button
            ref={addBtnRef}
            type="button"
            onClick={() => {

              void handleAdd();
            }}
            disabled={isLoading || adding || !selectedVariant}
            className={clx(
              "relative flex min-h-[48px] w-full items-center justify-center gap-2 overflow-hidden rounded-full border border-[--primary-color] bg-[--primary-color] px-4 font-semibold text-sm text-white transition-opacity",
              "hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--primary-color] focus-visible:ring-offset-2",
              "disabled:cursor-not-allowed disabled:opacity-50"
            )}
          >
            <CartDropFlight playing={dropPhase === "dropping"}>
              {adding ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
              ) : (
                "Agregar al carrito"
              )}
            </CartDropFlight>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
