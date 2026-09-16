"use client";

import {
  ChevronUpIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";
import type { CartCheckoutEligibility } from "@lib/util/cart-checkout";
import { useDisneyPromoState } from "@lib/hooks/use-disney-promo-state";
import { useTenant } from "@lib/site-config/context";
import { useCartStore } from "@lib/stores/cart.store";
import { isLineItemInStock } from "@lib/util/is-line-item-in-stock";
import { convertToLocale } from "@lib/util/money";
import {
  getDisneyAdjustedCartTotals,
} from "@lib/util/disney-promo";
import { getHiddenProductAdjustedCartTotals } from "@lib/util/hidden-product";
import CartTotals from "@modules/common/components/cart-totals";
import MinimumPurchaseNotice from "@modules/common/components/minimum-purchase-notice";
import TransportConditionNotice from "@modules/common/components/transport-condition-notice";
import { AnimatePresence, motion } from "framer-motion";
import ProductImage from "@modules/common/components/product-image";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

const SHEET_TRANSITION = {
  duration: 0.5,
  ease: [0.4, 0, 0.2, 1] as const,
};

type CheckoutSummaryProps = {
  cart: any;
  checkoutEligibility: CartCheckoutEligibility;
  allStepsComplete?: boolean;
  onPlaceOrder?: () => void;
  isPlacingOrder?: boolean;
};

function AvatarGroup({
  items,
  square = false,
}: {
  items: any[];
  square?: boolean;
}) {
  const avatarItems = items.slice(0, 4);
  const extraItems = Math.max(0, items.length - avatarItems.length);
  const shape = square ? "rounded-none" : "rounded-full";

  if (!avatarItems.length) return null;

  return (
    <div className="flex -space-x-2 shrink-0">
      {avatarItems.map((item: any) => {
        const thumb =
          item.thumbnail ||
          item.variant?.product?.thumbnail ||
          item.variant?.product?.images?.[0]?.url;
        return (
          <div
            key={item.id}
            className={`relative h-8 w-8 overflow-hidden border-2 bg-white ${shape}`}
            style={{ borderColor: "var(--primary-color)" }}
            title={item.product_title || item.title}
          >
            <ProductImage
              alt={item.product_title || item.title || ""}
              src={thumb}
              fill
              sizes="32px"
              className="object-cover"
            />
          </div>
        );
      })}
      {extraItems > 0 && (
        <div
          className={`relative flex h-8 w-8 items-center justify-center border-2 bg-white font-semibold text-[10px] ${shape}`}
          style={{
            borderColor: "var(--primary-color)",
            color: "var(--primary-color)",
          }}
        >
          +{extraItems}
        </div>
      )}
    </div>
  );
}

/* Lista de productos del pedido (thumbnail + título + cantidad + total de
   línea). En sports el checkout muestra los productos completos en lugar de los
   redondeles + "Ver detalle" del template supermercado. */
function ProductLines({
  items,
  currencyCode,
}: {
  items: any[];
  currencyCode?: string;
}) {
  if (!items.length) return null;
  return (
    <ul className="max-h-64 space-y-3 overflow-y-auto">
      {items.map((item: any) => {
        const thumb =
          item.thumbnail ||
          item.variant?.product?.thumbnail ||
          item.variant?.product?.images?.[0]?.url;
        const qty = item.quantity ?? 1;
        const lineTotal =
          item.total ?? (item.unit_price ?? 0) * qty;
        return (
          <li key={item.id} className="flex items-center gap-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden border border-[--sp-hairline] bg-white">
              <ProductImage
                alt={item.product_title || item.title || ""}
                src={thumb}
                fill
                sizes="56px"
                className="object-contain"
              />
              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center bg-[--primary-color] px-1 text-[11px] font-bold text-white">
                {qty}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm leading-tight">
                {item.product_title || item.title}
              </p>
            </div>
            <p className="shrink-0 text-sm font-semibold">
              ${" "}
              {convertToLocale({
                amount: lineTotal,
                currency_code: currencyCode ?? "ars",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
                locale: "es-AR",
              })}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

const CheckoutSummary = ({
  cart: propCart,
  checkoutEligibility,
  allStepsComplete = false,
  onPlaceOrder,
  isPlacingOrder = false,
}: CheckoutSummaryProps) => {
  const tenant = useTenant();
  const isSportsTemplate = tenant.template === "sports";
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const storeCart = useCartStore((s) => s.cart);
  const openCart = useCartStore((s) => s.openCart);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cart = propCart ?? storeCart;
  const fetchCart = useCartStore((s) => s.fetchCart);

  const items: any[] = cart?.items ?? [];
  const hasOutOfStockItems = items.some((item) => !isLineItemInStock(item));
  // Disney promo removed — stub yields null promotion
  const disneyState = useDisneyPromoState(null, items);
  const adjustedCart = useMemo(() => {
    const disneyAdjusted =
      getDisneyAdjustedCartTotals(cart, disneyState) ?? cart;
    return getHiddenProductAdjustedCartTotals(disneyAdjusted) ?? disneyAdjusted;
  }, [cart, disneyState]);

  const handleRemovePromotion = async (code: string) => {
    const current = (cart?.promotions ?? []) as any[];
    const remainingCodes = current
      .filter((p) => p?.code && p.code !== code && !p?.is_automatic)
      .map((p) => p.code as string);
    try {
      const response = await fetch("/api/store/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "applyPromotion",
          codes: remainingCodes,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data?.cart) {
        useCartStore.setState({ cart: data.cart });
      }
      await fetchCart();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cart-updated"));
      }
    } catch (error) {
      console.error("[CHECKOUT SUMMARY] Failed to remove promotion:", error);
      await fetchCart();
    }
  };
  const totalItems = items.reduce(
    (acc: number, item: any) => acc + (item.quantity ?? 0),
    0,
  );

  const formattedTotal = adjustedCart
    ? "$ " +
      convertToLocale({
        amount: adjustedCart.total ?? 0,
        currency_code: adjustedCart.currency_code ?? "ars",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        locale: "es-AR",
      })
    : null;
  const canPlaceOrder =
    allStepsComplete && !isPlacingOrder && checkoutEligibility.canCheckout;

  const placeOrderButton = (compact: boolean) => (
    <button
      className={`${compact ? "h-11" : "h-12"} w-full ${isSportsTemplate ? "rounded-none" : "rounded-[14px]"} bg-[--primary-color] font-semibold text-base text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50`}
      disabled={!canPlaceOrder}
      onClick={onPlaceOrder}
      type="button"
    >
      {isPlacingOrder ? (
        <span className="flex items-center justify-center gap-2">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
          Procesando...
        </span>
      ) : (
        "Finalizar compra"
      )}
    </button>
  );

  /* ── Desktop: sticky sidebar card ─────────────────── */
  const desktopCard = (
    <div className="hidden lg:block rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex w-full items-center justify-between gap-3 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-bold text-[--text-dark] text-base shrink-0">
            Mi pedido ({totalItems})
          </span>
          {!isSportsTemplate && <AvatarGroup items={items} />}
        </div>
        <button
          className="font-medium text-[--primary-color] text-sm whitespace-nowrap"
          onClick={openCart}
          type="button"
        >
          Ver detalle
        </button>
      </div>
      {isSportsTemplate && items.length > 0 && (
        <div className="border-gray-100 border-t px-5 py-4">
          <ProductLines items={items} currencyCode={cart?.currency_code} />
        </div>
      )}
      <div className="px-5 pb-5">
        {items.length > 0 && (
          <div className="overflow-hidden rounded-xl bg-[--primary-soft-bg]">
            <MinimumPurchaseNotice
              className="!bg-transparent"
              currencyCode={cart?.currency_code}
              hasMinimumPurchase={checkoutEligibility.hasMinimumPurchase}
              progress={checkoutEligibility.progress}
              remaining={checkoutEligibility.remaining}
              minimumPurchaseAmount={checkoutEligibility.minimumPurchaseAmount}
              showTopBorder={false}
            />
          </div>
        )}
        {items.length > 0 && (
          <TransportConditionNotice className="mt-3" items={items} />
        )}
        <CartTotals
          totals={adjustedCart}
          promotions={cart?.promotions ?? []}
          onRemovePromotion={handleRemovePromotion}
        />
      </div>
      {!checkoutEligibility.hasMinimumPurchase && (
        <div className="mx-5 mb-3 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-amber-800 text-xs">
          <ExclamationTriangleIcon className="size-4 shrink-0 text-amber-500" />
          <p>
            No podés finalizar la compra hasta alcanzar el mínimo requerido.
          </p>
        </div>
      )}
      {hasOutOfStockItems && (
        <div className="mx-5 mb-3 flex items-start gap-2 rounded-md bg-red-50 p-3 text-red-700 text-xs">
          <ExclamationTriangleIcon className="size-4 shrink-0 text-red-500" />
          <p>Hay productos sin stock. Eliminalos para continuar.</p>
        </div>
      )}
      <div className="px-5 pb-5">{placeOrderButton(false)}</div>
    </div>
  );

  /* ── Mobile: fixed panel that expands in place ─── */
  const mobileBar = (
    <div className="fixed inset-x-0 bottom-0 z-[60] lg:hidden">
      <AnimatePresence>
        {sheetOpen && (
          <motion.button
            animate={{ opacity: 1 }}
            aria-label="Cerrar detalle"
            className="fixed inset-0 z-40 cursor-modal-close bg-black/20"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            onClick={() => setSheetOpen(false)}
            transition={SHEET_TRANSITION}
            type="button"
          />
        )}
      </AnimatePresence>

      <div
        className={`relative z-50 bg-white ${isSportsTemplate ? "rounded-none border-[#0a0a0a] border-t-2 shadow-none" : "rounded-t-2xl shadow-[0_-4px_16px_rgba(0,0,0,0.10)]"}`}
      >
        {/* Header: Mi pedido + avatars + Ver detalle */}
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="font-bold text-[--text-dark] text-base shrink-0">
              Mi pedido ({totalItems})
            </span>
            <AvatarGroup items={items} square={isSportsTemplate} />
          </div>
          <button
            className="font-medium text-[--primary-color] text-sm whitespace-nowrap"
            onClick={openCart}
            type="button"
          >
            Ver detalle
          </button>
        </div>

        {/* Expanded breakdown — animated open/close */}
        <AnimatePresence initial={false}>
          {sheetOpen && (
            <motion.div
              animate={{ height: "auto" }}
              className="overflow-hidden"
              exit={{ height: 0 }}
              initial={{ height: 0 }}
              key="sheet"
              transition={SHEET_TRANSITION}
            >
              <div className="space-y-4 border-gray-100 border-t px-4 pt-4 pb-2">
                {items.length > 0 && (
                  <div className="overflow-hidden rounded-xl bg-[--primary-soft-bg]">
                    <MinimumPurchaseNotice
                      className="!bg-transparent"
                      compact
                      currencyCode={cart?.currency_code}
                      hasMinimumPurchase={
                        checkoutEligibility.hasMinimumPurchase
                      }
                      progress={checkoutEligibility.progress}
                      remaining={checkoutEligibility.remaining}
                      minimumPurchaseAmount={
                        checkoutEligibility.minimumPurchaseAmount
                      }
                      showTopBorder={false}
                    />
                  </div>
                )}
                {items.length > 0 && (
                  <TransportConditionNotice compact items={items} />
                )}
                <CartTotals
                  onRemovePromotion={handleRemovePromotion}
                  promotions={cart?.promotions ?? []}
                  showTotal={false}
                  totals={adjustedCart}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!checkoutEligibility.hasMinimumPurchase && (
          <div className="mx-4 mt-2 flex items-start gap-2 rounded-md bg-amber-50 p-2 text-amber-800 text-[11px]">
            <ExclamationTriangleIcon className="size-3.5 shrink-0 text-amber-500" />
            <p>No podés finalizar la compra hasta alcanzar el mínimo.</p>
          </div>
        )}
        {hasOutOfStockItems && (
          <div className="mx-4 mt-2 flex items-start gap-2 rounded-md bg-red-50 p-2 text-red-700 text-[11px]">
            <ExclamationTriangleIcon className="size-3.5 shrink-0 text-red-500" />
            <p>Hay productos sin stock. Eliminalos para continuar.</p>
          </div>
        )}

        {/* Bottom action row. El padding inferior contempla el safe-area del
            dispositivo para que el total no quede pegado al borde de la pantalla. */}
        <div className="flex items-center gap-3 border-gray-100 border-t px-4 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          <button
            aria-label={sheetOpen ? "Ocultar desglose" : "Ver desglose"}
            className={`flex h-10 w-10 shrink-0 items-center justify-center bg-[--primary-color] ${isSportsTemplate ? "rounded-none" : "rounded-full"}`}
            onClick={() => setSheetOpen((v) => !v)}
            type="button"
          >
            <ChevronUpIcon
              className={`h-5 w-5 text-white transition-transform duration-200 ${sheetOpen ? "rotate-180" : ""}`}
            />
          </button>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[--label-color] text-xs leading-none">
              Total
            </span>
            <span className="font-bold text-[--text-dark] text-base leading-tight">
              {formattedTotal ?? "—"}
            </span>
          </div>
          <div className="w-40 shrink-0">{placeOrderButton(true)}</div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {desktopCard}
      {mounted && typeof document !== "undefined"
        ? createPortal(mobileBar, document.body)
        : null}
    </>
  );
};

export default CheckoutSummary;
