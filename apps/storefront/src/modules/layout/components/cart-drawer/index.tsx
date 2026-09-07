"use client";

import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  GiftIcon,
  MinusIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  TruckIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { getCartCheckoutEligibility } from "@lib/util/cart-checkout";
import type { HttpTypes } from "@medusajs/types";
// Slots generados por el composer: sin la extensión `recommendation-widgets` devuelven
// null. Nunca importar `@modules/recommendations/...` desde un archivo core.
import {
  CartRecommendations,
  FreeShippingBridge,
} from "@lib/recommendations-cart-slot";
import { useDemoHref } from "@lib/site-config/context";
import { useCartStore } from "@lib/stores/cart.store";
const cartHasKit = (_cart: import("@medusajs/types").HttpTypes.StoreCart): boolean => false;
import { isLineItemInStock } from "@lib/util/is-line-item-in-stock";
import {
  canIncrementQuantity,
  getLineItemMaxQuantity,
} from "@lib/util/max-purchasable-quantity";
import { convertToLocale } from "@lib/util/money";
import {
  PLACEHOLDER_IMAGE,
  handleImageError,
} from "@lib/util/placeholder-image";
import { isNewProduct } from "@lib/util/is-new-product";
import { useCartPromotions } from "@lib/hooks/use-cart-promotions";
import { useMinimumPurchaseAmount } from "@lib/hooks/use-minimum-purchase";
import { useDisneyPromoState } from "@lib/hooks/use-disney-promo-state";
import { useFreefixturePromoState } from "@lib/hooks/use-freefixture-promo-state";
import { useMundialPromoState } from "@lib/hooks/use-mundial-promo-state";
import { usePromotionByCode } from "@lib/hooks/use-promotion-by-code";
import DisneyBadge from "@modules/common/components/disney-badge";
import LocalizedClientLink from "@modules/common/components/localized-client-link";
import MinimumPurchaseNotice from "@modules/common/components/minimum-purchase-notice";
import MundialPromoNotice from "@modules/common/components/mundial-promo-notice";
import NewBadge from "@modules/common/components/new-badge";
import Thumbnail from "@modules/products/components/thumbnail";
import {
  DISNEY_PROMO_CODE,
  getDisneyEffectiveItemTotal,
  isDisneyGiftDiscountApplied,
  shouldSuppressDisneyTargetDiscount,
} from "@lib/util/disney-promo";
import {
  MUNDIAL_PROMO_CODE,
  shouldSuppressMundialTargetDiscount,
} from "@lib/util/mundial-promo";
import {
  FREEFIXTURE_BADGE_LABEL,
  FREEFIXTURE_PROMO_CODE,
  shouldSuppressFreefixtureTargetDiscount,
} from "@lib/util/freefixture-promo";
import { isHiddenFromStore } from "@lib/util/hidden-product";
import { isPromotionActiveForStorefront } from "@lib/util/promotion-active";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingCart } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTypesenseProducts } from "@lib/hooks/use-typesense-products";
import { searchProductsFromBrowser } from "@lib/typesense/search-browser";
import type { TypesenseProductDocument } from "@lib/typesense";

type DisneyPromoNoticeProps = {
  state: ReturnType<typeof useDisneyPromoState>;
  discountApplied?: boolean;
};

function DisneyPromoNotice({ state }: DisneyPromoNoticeProps) {
  const { promo, buyProductQuantity, minQuantity, unlocked, hasFreeGift } =
    state;

  if (!promo) return null;

  // Don't show anything until at least one Disney product is in the cart
  if (buyProductQuantity === 0) return null;

  const missing = Math.max(0, minQuantity - buyProductQuantity);

  let tone: "progress" | "gift" | "complete" = "progress";
  let title = "";
  let message = "";

  if (!unlocked) {
    tone = "progress";
    title = "Promo Disney";
    message = `Te ${missing === 1 ? "falta" : "faltan"} ${missing} producto${missing === 1 ? "" : "s"} Disney para llevarte un peluche gratis.`;
  } else if (!hasFreeGift) {
    tone = "gift";
    title = "¡Promo Disney desbloqueada!";
    message = "Agregá un peluche Disney a tu carrito — es gratis.";
  } else {
    tone = "complete";
    title = "Promo Disney aplicada";
    message = "Ya incluiste tu peluche gratis. ¡A disfrutar!";
  }

  const palette =
    tone === "progress"
      ? {
          bg: "bg-amber-50",
          border: "border-amber-200",
          text: "text-amber-900",
          iconClass: "text-amber-500",
          Icon: SparklesIcon,
        }
      : tone === "gift"
        ? {
            bg: "bg-green-50",
            border: "border-green-200",
            text: "text-green-800",
            iconClass: "text-green-600",
            Icon: GiftIcon,
          }
        : {
            bg: "bg-green-50",
            border: "border-green-200",
            text: "text-green-800",
            iconClass: "text-green-600",
            Icon: GiftIcon,
          };

  const { Icon } = palette;

  return (
    <div
      className={`mb-10 flex items-start gap-2 rounded-xl border ${palette.border} ${palette.bg} px-3 py-2`}
      data-testid="disney-promo-notice"
    >
      <Icon className={`h-5 w-5 shrink-0 ${palette.iconClass}`} />
      <div className={`flex flex-col text-xs ${palette.text}`}>
        <span className="font-semibold">{title}</span>
        <span className="leading-snug">{message}</span>
      </div>
    </div>
  );
}

function DisneyPromoStatusNotice({
  state,
  discountApplied = false,
}: DisneyPromoNoticeProps) {
  const {
    promo,
    buyProductQuantity,
    diffuserQuantity,
    textileQuantity,
    requiredDiffuserQuantity,
    requiredTextileQuantity,
    unlocked,
    hasFreeGift,
  } = state;

  if (!promo || buyProductQuantity === 0) {
    return null;
  }

  const missingDiffusers = Math.max(
    0,
    requiredDiffuserQuantity - diffuserQuantity,
  );
  const missingTextiles = Math.max(
    0,
    requiredTextileQuantity - textileQuantity,
  );

  let title = "";
  let message: React.ReactNode = null;

  if (!unlocked) {
    title = "¡Promo Disney!";

    const missingParts: React.ReactNode[] = [];
    if (missingDiffusers > 0) {
      missingParts.push(
        <strong className="font-bold" key="diffusers">
          {missingDiffusers} difusor{missingDiffusers === 1 ? "" : "es"}
        </strong>,
      );
    }
    if (missingTextiles > 0) {
      missingParts.push(
        <strong className="font-bold" key="textiles">
          {missingTextiles} textil{missingTextiles === 1 ? "" : "es"}
        </strong>,
      );
    }

    const verb = missingParts.length > 1 ? "faltan" : "falta";

    message = (
      <>
        Te {verb}{" "}
        {missingParts.map((part, idx) => (
          <span key={idx}>
            {idx > 0 && (idx === missingParts.length - 1 ? " y " : ", ")}
            {part}
          </span>
        ))}{" "}
        Disney para llevarte un{" "}
        <strong className="font-bold">peluche gratis</strong>.
      </>
    );
  } else if (!hasFreeGift) {
    title = "¡Promo Disney desbloqueada!";
    message = (
      <>
        Agregá un <strong className="font-bold">peluche Disney</strong> a tu
        carrito: queda <strong className="font-bold">gratis</strong>.
      </>
    );
  } else if (discountApplied) {
    title = "Promo Disney aplicada";
    message = (
      <>
        Ya incluiste tu <strong className="font-bold">peluche gratis</strong>.
      </>
    );
  } else {
    title = "Promo Disney desbloqueada";
    message = (
      <>
        Estamos actualizando el descuento del{" "}
        <strong className="font-bold">peluche Disney</strong>.
      </>
    );
  }

  return (
    <div
      className="-mt-4 mb-2 flex items-center gap-3 rounded-xl border bg-white p-2"
      data-testid="disney-promo-notice"
      style={{
        background: "linear-gradient(180deg, var(--mc-green-pale) 0%, var(--mc-green-soft) 100%)",
        borderColor: "var(--primary-color)",
      }}
    >
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[10px]"
        style={{ backgroundColor: "var(--primary-color)" }}
      >
        <img
          alt="Disney"
          className="h-12 max-w-none brightness-0 invert"
          src="/disney-sub-brands/disney.svg"
        />
      </div>
      <div className="flex flex-col justify-center gap-0.5 text-sm">
        <span className="font-bold" style={{ color: "var(--tertiary-color)" }}>
          {title}
        </span>
        <span
          className="leading-snug"
          style={{ color: "var(--tertiary-color)" }}
        >
          {message}
        </span>
      </div>
    </div>
  );
}

type CartItemRowProps = {
  item: NonNullable<
    NonNullable<ReturnType<typeof useCartStore.getState>["cart"]>["items"]
  >[number];
  currencyCode: string;
  isRemoving: boolean;
  isUpdating: boolean;
  maxQuantity: number | null;
  // Delta relativo (+1 / -1): lee la cantidad ACTUAL del store, así los clicks
  // rápidos no se pierden por un `item.quantity` viejo del render.
  onQuantityDelta: (lineId: string, delta: number) => void;
  onRemove: (lineId: string) => void;
  onNavigate?: () => void;
  promotions?: any[];
  suppressDisneyPromo?: boolean;
  showDisneyBadge?: boolean;
  suppressMundialPromo?: boolean;
  showMundialBadge?: boolean;
  suppressFreefixturePromo?: boolean;
  showFreefixtureBadge?: boolean;
};

function CartItemRow({
  item,
  currencyCode,
  isRemoving,
  isUpdating,
  maxQuantity,
  onQuantityDelta,
  onRemove,
  onNavigate,
  promotions,
  suppressDisneyPromo,
  showDisneyBadge,
  suppressMundialPromo,
  showMundialBadge,
  suppressFreefixturePromo,
  showFreefixtureBadge,
}: CartItemRowProps) {
  const itemTotal = item.total ?? 0;
  const originalTotal = item.original_total ?? 0;
  const suppressAnyPromo =
    suppressDisneyPromo || suppressMundialPromo || suppressFreefixturePromo;
  const hasDiscount = !suppressAnyPromo && itemTotal < originalTotal;
  const inStock = isLineItemInStock(item);

  // OJO: `maxQuantity` (prop) es el tope de la PROMO ("válido en N unidades"),
  // no el stock. El techo de stock es este otro, y sale del enriquecimiento del
  // carrito (stock real por variante). `null` = sin techo conocido.
  const stockCeiling = getLineItemMaxQuantity(item);
  const canIncrementLine = canIncrementQuantity(item.quantity, stockCeiling);

  const isHidden =
    isHiddenFromStore(
      (item as unknown as { product?: { metadata?: Record<string, unknown> } })
        .product,
    ) ||
    isHiddenFromStore(
      item.variant?.product as
        | { metadata?: Record<string, unknown> }
        | undefined,
    );
  const displayThumbnail =
    item.thumbnail ||
    item.variant?.product?.thumbnail ||
    item.variant?.product?.images?.[0]?.url ||
    undefined;

  // Línea entonada (sistema tintométrico): el color es parte de la IDENTIDAD de
  // la línea —la misma base en dos colores son dos líneas— así que sin mostrarlo
  // el carrito queda con dos filas idénticas y el comprador no sabe cuál borrar.
  // Se lee con validación defensiva: `metadata` viene del carrito, no de acá.
  const tint = (() => {
    const raw = (
      item.metadata as
        | { tint?: { color_name?: unknown; color_hex?: unknown } }
        | null
        | undefined
    )?.tint;
    if (!raw || typeof raw.color_name !== "string" || !raw.color_name.trim()) {
      return null;
    }
    return {
      name: raw.color_name,
      hex: typeof raw.color_hex === "string" ? raw.color_hex : null,
    };
  })();

  const activePromotions = (promotions ?? []).filter((promotion: any) =>
    isPromotionActiveForStorefront(promotion),
  );

  const promoBadgeClass =
    "inline-flex h-[20px] shrink-0 items-center justify-center rounded-[6px] bg-[var(--accent-color,#f97316)] px-2 font-semibold text-white text-[10px]";

  const buygetPromo = suppressAnyPromo
    ? null
    : activePromotions.find(
        (p: any) => p.type === "buyget" && p.is_automatic !== false,
      );
  const automaticPromo = activePromotions.find(
    (p: any) =>
      (p.application_method?.type === "percentage" ||
        p.application_method?.type === "fixed") &&
      p.type !== "buyget" &&
      p.is_automatic !== false,
  );
  const automaticPromoName =
    (automaticPromo as any)?.campaign?.name ||
    automaticPromo?.code ||
    null;

  const isNew = item.variant?.product
    ? isNewProduct(item.variant.product)
    : false;

  const fmtPrice = (amount: number) =>
    `$ ${convertToLocale({ amount, currency_code: currencyCode, minimumFractionDigits: 0, maximumFractionDigits: 0, locale: "es-AR" })}`;

  const buygetRequiredQuantity = (() => {
    if (!buygetPromo) return null;

    const code = buygetPromo.code || "";
    const buygetXMatch = code.match(/(\d+)\s*x\s*\d+/i);
    if (buygetXMatch) {
      return parseInt(buygetXMatch[1], 10);
    }

    const buyRulesMinQuantity =
      buygetPromo.application_method?.buy_rules_min_quantity;
    if (typeof buyRulesMinQuantity === "number" && buyRulesMinQuantity > 0) {
      return buyRulesMinQuantity;
    }

    const applyToQuantity = buygetPromo.application_method?.apply_to_quantity;
    if (typeof applyToQuantity === "number" && applyToQuantity > 0) {
      return applyToQuantity + 1;
    }

    return null;
  })();
  const buygetItemsNeeded =
    buygetRequiredQuantity == null
      ? 0
      : Math.max(0, buygetRequiredQuantity - item.quantity);
  const buygetUnlocked = Boolean(buygetPromo && buygetItemsNeeded === 0);
  const buygetLabel =
    (buygetPromo as any)?.campaign?.name || buygetPromo?.code || null;

  const buygetMessage =
    buygetPromo && buygetItemsNeeded > 0
      ? `Agregá ${buygetItemsNeeded} más y accedé a la promo`
      : null;

  const promoBadgeLabel =
    showDisneyBadge
      ? DISNEY_PROMO_CODE
      : showMundialBadge
        ? MUNDIAL_PROMO_CODE
        : showFreefixtureBadge
          ? FREEFIXTURE_BADGE_LABEL
          : buygetUnlocked
            ? buygetLabel
            : hasDiscount
              ? automaticPromoName
              : null;
  return (
    <motion.li
      animate={{ opacity: 1, height: "auto" }}
      className={`flex gap-3 overflow-hidden rounded-[14px] bg-white p-[13px]${!inStock ? " opacity-70" : ""}`}
      data-testid="cart-item"
      exit={{
        opacity: 0,
        height: 0,
        marginTop: 0,
        marginBottom: 0,
        paddingTop: 0,
        paddingBottom: 0,
      }}
      initial={{ opacity: 0, height: 0 }}
      // Stable across the optimistic→server line swap (see list render): keying
      // by item.id would remount this <li> when the id changes and replay the
      // enter animation (flicker). variant_id stays constant.
      key={item.variant_id ?? item.id}
      layout
      transition={{ duration: 0.2 }}
    >
      <div className="relative size-20 shrink-0 rounded-lg border border-gray-200 bg-white p-1">
        {isNew && (
          <div className="absolute top-0.5 left-0.5 z-10 origin-top-left scale-[0.55]">
            <NewBadge />
          </div>
        )}
        <LocalizedClientLink
          href={`/products/${item.product_handle}`}
          onClick={onNavigate}
        >
          <Thumbnail
            className="rounded-none bg-transparent p-0 shadow-none"
            images={item.variant?.product?.images || []}
            size="square"
            thumbnail={displayThumbnail}
          />
        </LocalizedClientLink>
      </div>
      <div className="flex min-h-16 flex-1 flex-col justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="min-w-0 flex-1 font-medium leading-snug text-gray-900 text-sm">
              <LocalizedClientLink
                data-testid="product-link"
                href={`/products/${item.product_handle}`}
                onClick={onNavigate}
              >
                {item.title}
              </LocalizedClientLink>
            </h3>
            <button
              aria-label="Eliminar producto"
              className="shrink-0 text-gray-500 hover:text-red-600 disabled:opacity-50"
              data-testid="cart-item-remove-button"
              disabled={isRemoving}
              onClick={() => onRemove(item.id)}
              type="button"
            >
              {isRemoving ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
              ) : (
                <TrashIcon className="h-4 w-4" />
              )}
            </button>
          </div>
          {tint && (
            <span
              className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 font-medium text-[11px] text-gray-700"
              data-testid="cart-item-tint"
            >
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full border border-black/10"
                // Sin hex de la carta va gris: no se inventa un color.
                style={{ backgroundColor: tint.hex ?? "#e5e7eb" }}
              />
              <span className="truncate">Color: {tint.name}</span>
            </span>
          )}
          {(promoBadgeLabel ||
            (hasDiscount &&
              maxQuantity != null &&
              maxQuantity !== 999 &&
              maxQuantity <= 10)) && (
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              {promoBadgeLabel && (
                <span className={promoBadgeClass} data-promo-badge>
                  {promoBadgeLabel}
                </span>
              )}
              {hasDiscount &&
                maxQuantity != null &&
                maxQuantity !== 999 &&
                maxQuantity <= 10 && (
                  <span className="inline-flex shrink-0 items-center rounded-full border border-green-100 bg-green-50 px-2 py-0.5 text-[10px] font-medium text-[--primary-color]">
                    Válido en {maxQuantity} unidad
                    {maxQuantity !== 1 ? "es" : ""}
                  </span>
                )}
            </div>
          )}
          {!inStock && (
            <span className="inline-flex w-fit items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 font-medium text-red-600 text-[10px]">
              <ExclamationTriangleIcon className="h-3 w-3" />
              Sin stock
            </span>
          )}
          {buygetMessage && (
            <span className="inline-flex w-fit items-center rounded-[6px] border border-orange-100 bg-orange-50 px-2 py-1 text-[10px] font-medium text-orange-700">
              {buygetMessage}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-end justify-between">
          {isHidden ? (
            <span />
          ) : inStock ? (
            <div
              className={`flex items-stretch divide-x divide-gray-200 overflow-hidden rounded-[10px] border border-gray-200 ${isUpdating ? "opacity-70" : ""}`}
            >
              {item.quantity <= 1 ? (
                <button
                  aria-label="Eliminar producto"
                  className="p-1 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isRemoving}
                  onClick={() => onRemove(item.id)}
                  type="button"
                >
                  {isRemoving ? (
                    <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" />
                  ) : (
                    <TrashIcon className="h-3.5 w-3.5" />
                  )}
                </button>
              ) : (
                <button
                  className="p-1 hover:bg-gray-100"
                  onClick={() => onQuantityDelta(item.id, -1)}
                  type="button"
                >
                  <MinusIcon className="h-3.5 w-3.5" />
                </button>
              )}
              <span className="flex w-7 items-center justify-center font-medium text-xs">
                {item.quantity}
              </span>
              {/* Techo de stock: la línea del carrito viene enriquecida con el
                  stock real por variante, así que apagamos el "+" en vez de
                  tragarnos clicks que el server iba a rechazar (y cuyo rollback
                  devolvía la cantidad al valor previo al burst). */}
              <button
                className="p-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!canIncrementLine}
                title={
                  canIncrementLine ? undefined : "No hay más stock disponible"
                }
                onClick={() => onQuantityDelta(item.id, 1)}
                type="button"
              >
                <PlusIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <span className="text-gray-400 text-xs">Cant: {item.quantity}</span>
          )}
          <div className="flex items-baseline gap-2">
            {hasDiscount && !isHidden && (
              <span className="text-gray-400 text-[10px] line-through">
                {fmtPrice(originalTotal)}
              </span>
            )}
            <span
              className="font-semibold text-[15px]"
              style={{ color: "#101828" }}
            >
              {fmtPrice(suppressAnyPromo ? originalTotal : itemTotal)}
            </span>
          </div>
        </div>
      </div>
    </motion.li>
  );
}

function CartFooter({
  items,
  subtotal,
  total,
  canCheckout,
  hasOutOfStockItems,
  currencyCode,
  onClose,
}: {
  items: { length: number };
  subtotal: number;
  total: number;
  canCheckout: boolean;
  hasOutOfStockItems: boolean;
  currencyCode: string;
  onClose: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const fmtPrice = (amount: number) =>
    `$ ${convertToLocale({ amount, currency_code: currencyCode, minimumFractionDigits: 0, maximumFractionDigits: 0, locale: "es-AR" })}`;

  const hasDiscount = subtotal > total;

  return (
    <div className="border-gray-200 border-t p-4 sm:px-6">
      {items.length > 0 && (
        <div className="mb-4">
          <button
            className="flex w-full items-center justify-between gap-2"
            onClick={() => setShowDetails((v) => !v)}
            type="button"
          >
            <p className="font-bold text-[20px]" style={{ color: "#101828" }}>
              Total{" "}
              <span
                className="text-[11px] font-normal"
                style={{ color: "var(--price-strikethrough)" }}
              >
                (Impuestos incluidos)
              </span>
            </p>
            <div className="flex items-center gap-1.5">
              <p
                className="font-bold text-[20px]"
                data-testid="cart-total"
                data-value={total}
                style={{ color: "#101828" }}
              >
                {fmtPrice(total)}
              </p>
              <ChevronRightIcon
                className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${showDetails ? "rotate-90" : ""}`}
              />
            </div>
          </button>
          <AnimatePresence initial={false}>
            {showDetails && (
              <motion.div
                animate={{ height: "auto", opacity: 1 }}
                className="overflow-hidden"
                exit={{ height: 0, opacity: 0 }}
                initial={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mt-2 space-y-1.5 border-t border-gray-100 pt-2">
                  <div className="flex justify-between text-sm text-gray-500">
                    <p>Subtotal ({items.length} artículos)</p>
                    <p data-testid="cart-subtotal" data-value={subtotal}>
                      {fmtPrice(subtotal)}
                    </p>
                  </div>
                  {hasDiscount && (
                    <div className="flex justify-between text-sm text-green-600">
                      <p>Descuento</p>
                      <p
                        data-testid="cart-discount"
                        data-value={subtotal - total}
                      >
                        - {fmtPrice(subtotal - total)}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      {hasOutOfStockItems && items.length > 0 && (
        <p className="mb-3 text-center text-red-600 text-xs">
          Eliminá los productos sin stock para continuar.
        </p>
      )}
      <LocalizedClientLink href="/checkout" passHref>
        <button
          className="h-12 w-full rounded-md bg-gray-300 font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="go-to-cart-button"
          disabled={!canCheckout}
          onClick={onClose}
          style={{
            backgroundColor: canCheckout ? "var(--primary-color)" : undefined,
          }}
          type="button"
        >
          Finalizar compra
        </button>
      </LocalizedClientLink>
    </div>
  );
}

function CartFooterExact({
  items,
  subtotal,
  total,
  canCheckout,
  hasOutOfStockItems,
  currencyCode,
  onClose,
  promotions,
  onRemovePromotion,
  onCheckoutClick,
}: {
  items: { length: number };
  subtotal: number;
  total: number;
  canCheckout: boolean;
  hasOutOfStockItems: boolean;
  currencyCode: string;
  onClose: () => void;
  promotions?: any[];
  onRemovePromotion?: (code: string) => Promise<void> | void;
  onCheckoutClick?: () => void;
}) {
  const [showDetails, setShowDetails] = useState(false);
  const [removingCode, setRemovingCode] = useState<string | null>(null);
  const fmtPrice = (amount: number) =>
    `$ ${convertToLocale({ amount, currency_code: currencyCode, minimumFractionDigits: 0, maximumFractionDigits: 0, locale: "es-AR" })}`;

  const manualPromotions = (promotions ?? []).filter(
    (p) => p?.code && !p?.is_automatic,
  );

  const hasDiscount = subtotal > total;

  return (
    <div className="border-gray-200 border-t p-4 sm:px-6">
      {items.length > 0 && (
        <div className="mb-4">
          <button
            className="flex w-full items-center justify-between gap-2"
            onClick={() => setShowDetails((value) => !value)}
            type="button"
          >
            <p className="font-bold text-[20px]" style={{ color: "#101828" }}>
              Total{" "}
              <span
                className="text-[11px] font-normal"
                style={{ color: "var(--price-strikethrough)" }}
              >
                (Impuestos incluidos)
              </span>
            </p>
            <div className="flex items-center gap-1.5">
              <p
                className="font-bold text-[20px]"
                data-testid="cart-total"
                data-value={total}
                style={{ color: "#101828" }}
              >
                {fmtPrice(total)}
              </p>
              <ChevronRightIcon
                className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${showDetails ? "rotate-90" : ""}`}
              />
            </div>
          </button>
          <AnimatePresence initial={false}>
            {showDetails && (
              <motion.div
                animate={{ height: "auto", opacity: 1 }}
                className="overflow-hidden"
                exit={{ height: 0, opacity: 0 }}
                initial={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mt-2 space-y-1.5 border-t border-gray-100 pt-2">
                  <div className="flex justify-between text-sm text-gray-500">
                    <p>Subtotal ({items.length} articulos)</p>
                    <p data-testid="cart-subtotal" data-value={subtotal}>
                      {fmtPrice(subtotal)}
                    </p>
                  </div>
                  {hasDiscount && (
                    <div className="flex justify-between text-sm text-green-600">
                      <p>Descuento</p>
                      <p
                        data-testid="cart-discount"
                        data-value={subtotal - total}
                      >
                        - {fmtPrice(subtotal - total)}
                      </p>
                    </div>
                  )}
                  {manualPromotions.length > 0 && (
                    <div className="mt-2 space-y-1 border-t border-gray-100 pt-2">
                      <p className="text-xs font-medium text-gray-500">
                        Cupones aplicados
                      </p>
                      {manualPromotions.map((promo) => (
                        <div
                          className="flex items-center justify-between gap-2 text-xs"
                          data-testid="cart-promo-row"
                          key={promo.id ?? promo.code}
                        >
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 font-medium">
                            <GiftIcon className="h-3 w-3" />
                            {promo.code}
                          </span>
                          {onRemovePromotion && (
                            <button
                              aria-label={`Quitar cupón ${promo.code}`}
                              className="flex items-center text-gray-400 hover:text-red-600 disabled:opacity-50"
                              data-testid="cart-promo-remove"
                              disabled={removingCode === promo.code}
                              onClick={async () => {
                                setRemovingCode(promo.code);
                                try {
                                  await onRemovePromotion(promo.code);
                                } finally {
                                  setRemovingCode(null);
                                }
                              }}
                              type="button"
                            >
                              {removingCode === promo.code ? (
                                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
                              ) : (
                                <TrashIcon className="h-3.5 w-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      {hasOutOfStockItems && items.length > 0 && (
        <p className="mb-3 text-center text-red-600 text-xs">
          Eliminá los productos sin stock para continuar.
        </p>
      )}
      {canCheckout ? (
        onCheckoutClick ? (
          <button
            className="h-12 w-full rounded-md font-medium text-white transition-colors"
            data-testid="go-to-cart-button"
            onClick={onCheckoutClick}
            style={{ backgroundColor: "var(--primary-color)" }}
            type="button"
          >
            Finalizar compra
          </button>
        ) : (
          <LocalizedClientLink href="/checkout" passHref>
            <button
              className="h-12 w-full rounded-md font-medium text-white transition-colors"
              data-testid="go-to-cart-button"
              onClick={onClose}
              style={{ backgroundColor: "var(--primary-color)" }}
              type="button"
            >
              Finalizar compra
            </button>
          </LocalizedClientLink>
        )
      ) : (
        <button
          className="h-12 w-full rounded-md bg-gray-300 font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="go-to-cart-button"
          disabled
          type="button"
        >
          Finalizar compra
        </button>
      )}
    </div>
  );
}

type SuggestedProduct = {
  id: string;
  title: string;
  handle: string;
  thumbnail: string | null;
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

function CartSuggestedProducts({ countryCode }: { countryCode: string }) {
  const { products, isLoading: loading } = useTypesenseProducts({
    limit: 12,
    sortBy: "created_at",
  });
  const [addingId, setAddingId] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const addItem = useCartStore((s) => s.addItem);
  const cartItems = useCartStore((s) => s.cart?.items) ?? [];

  const updateScrollButtons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  const scroll = useCallback((direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollAmount = el.clientWidth * 0.6;
    el.scrollBy({
      left: direction === "left" ? -scrollAmount : scrollAmount,
      behavior: "smooth",
    });
  }, []);

  const cartVariantIds = useMemo(
    () => new Set(cartItems.map((i) => i.variant_id)),
    [cartItems],
  );

  const visibleProducts = useMemo(
    () =>
      products.filter((p) => {
        const variantId = p.variants?.[0]?.id;
        return variantId ? !cartVariantIds.has(variantId) : true;
      }),
    [products, cartVariantIds],
  );

  const handleAddToCart = useCallback(
    async (product: SuggestedProduct) => {
      const variant = product.variants?.[0];
      if (!variant) return;
      setAddingId(variant.id);
      try {
        await addItem(variant.id, 1, countryCode, product.id, undefined, {
          title: product.title,
          handle: product.handle,
          thumbnail: product.thumbnail,
          unitPrice: variant.calculated_price?.calculated_amount,
          currencyCode: variant.calculated_price?.currency_code,
        });
      } finally {
        setAddingId(null);
      }
    },
    [addItem, countryCode],
  );

  // Update scroll buttons when products change
  useEffect(() => {
    updateScrollButtons();
  }, [updateScrollButtons, visibleProducts.length]);

  if (loading) {
    return (
      <div className="mt-6">
        <div className="mx-auto mb-3 h-4 w-48 animate-pulse rounded bg-gray-200" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div
              className="h-16 w-[47%] shrink-0 animate-pulse rounded-xl bg-gray-100"
              key={i}
            />
          ))}
        </div>
      </div>
    );
  }

  if (!visibleProducts.length) return null;

  return (
    <div className="mt-8 w-full">
      <p className="mb-3 text-center font-semibold text-gray-600 text-sm">
        Te puede interesar
      </p>
      <div className="relative">
        {/* Left arrow */}
        {canScrollLeft && (
          <button
            aria-label="Anterior"
            className="absolute top-1/2 left-0 z-10 flex h-7 w-7 -translate-y-1/2 -translate-x-2 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md transition hover:bg-gray-50"
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
            className="absolute top-1/2 right-0 z-10 flex h-7 w-7 -translate-y-1/2 translate-x-2 items-center justify-center rounded-full border border-gray-200 bg-white shadow-md transition hover:bg-gray-50"
            onClick={() => scroll("right")}
            type="button"
          >
            <ChevronRightIcon className="h-4 w-4 text-gray-600" />
          </button>
        )}
        <div
          className="no-scrollbar flex snap-x snap-mandatory gap-2 overflow-x-auto scroll-smooth px-1"
          onScroll={updateScrollButtons}
          ref={scrollRef}
        >
          <AnimatePresence initial={false}>
            {visibleProducts.map((product) => {
              const variant = product.variants?.[0];
              const price = variant?.calculated_price;
              const isAdding = addingId === variant?.id;

              return (
                <motion.div
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex w-[47%] shrink-0 snap-start items-center gap-2 rounded-xl border border-gray-200 bg-white px-2.5 py-2 shadow-sm"
                  exit={{ opacity: 0, scale: 0.8 }}
                  initial={{ opacity: 1, scale: 1 }}
                  key={product.id}
                  layout
                  transition={{ duration: 0.3 }}
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                    <img
                      alt={product.title}
                      // object-contain: con object-cover las imágenes
                      // verticales se recortaban y se veían incompletas.
                      className="h-full w-full object-contain p-0.5"
                      height={40}
                      onError={handleImageError}
                      src={product.thumbnail || PLACEHOLDER_IMAGE}
                      width={40}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900 text-xs leading-tight">
                      {product.title}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {price && (
                        <p className="font-semibold text-[--primary-color] text-xs">
                          ${" "}
                          {convertToLocale({
                            amount: price.calculated_amount,
                            currency_code: price.currency_code,
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0,
                            locale: "es-AR",
                          })}
                        </p>
                      )}
                      <DisneyBadge productId={product.id} />
                    </div>
                  </div>
                  <button
                    aria-label="Agregar"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[--primary-color] bg-[--primary-color] text-white transition hover:opacity-90 disabled:opacity-40"
                  disabled={!variant}
                  onClick={() => handleAddToCart(product)}
                  type="button"
                >
                    {isAdding ? (
                      <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent" />
                    ) : (
                      <ShoppingCart className="h-3.5 w-3.5 text-white" />
                    )}
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function pickVariantForProduct(
  product: TypesenseProductDocument,
): string | null {
  return product.variants?.[0]?.id ?? null;
}

function PelucheGiftModalContent({
  targetProductIds,
  countryCode,
  onContinueWithout,
  onSuccess,
}: {
  targetProductIds: string[];
  countryCode: string;
  onContinueWithout: () => void;
  onSuccess: () => void;
}) {
  const { products, isLoading } = useTypesenseProducts({
    productIds: targetProductIds,
    limit: 20,
  });
  const addItem = useCartStore((s) => s.addItem);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const selectedProduct = products.find((p) => p.id === selectedId) ?? null;

  const handleAdd = async () => {
    if (!selectedProduct) return;
    const variantId = pickVariantForProduct(selectedProduct);
    if (!variantId) return;
    setIsAdding(true);
    try {
      const variant = selectedProduct.variants?.[0];
      await addItem(variantId, 1, countryCode, selectedProduct.id, undefined, {
        title: selectedProduct.title,
        handle: selectedProduct.handle,
        thumbnail: selectedProduct.thumbnail || selectedProduct.images?.[0]?.url,
        unitPrice: variant?.calculated_price?.calculated_amount,
        currencyCode: variant?.calculated_price?.currency_code,
      });
      onSuccess();
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="flex max-h-[90vh] w-full max-w-sm flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl"
      exit={{ opacity: 0, y: 40 }}
      initial={{ opacity: 0, y: 40 }}
      transition={{ damping: 25, stiffness: 300, type: "spring" }}
    >
      {/* Disney-style header */}
      <div
        className="flex shrink-0 flex-col items-center px-5 pb-4 pt-5 text-center text-white"
        style={{
          background:
            "linear-gradient(135deg, var(--mc-green-hover) 0%, var(--mc-green) 50%, var(--mc-green-hover) 100%)",
        }}
      >
        <img
          alt="Disney"
          className="mb-2 brightness-0 invert"
          src="/brands/Disney_logo.svg"
          style={{ height: 26, width: "auto" }}
        />
        <h3 className="text-lg font-bold leading-tight">
          ¡Tu peluche gratis está esperando!
        </h3>
        <p className="mt-0.5 text-xs text-white/70">
          Elegí uno para agregar a tu compra
        </p>
      </div>

      {/* Products grid */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                className="aspect-square animate-pulse rounded-xl bg-gray-100"
                key={i}
              />
            ))}
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {products.map((p) => {
              const isSelected = selectedId === p.id;
              return (
                <button
                  className="flex flex-col items-center gap-2 rounded-xl border-2 p-2 text-left transition"
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  style={
                    isSelected
                      ? { borderColor: "var(--primary-color)" }
                      : { borderColor: "#f3f4f6" }
                  }
                  type="button"
                >
                  <div className="aspect-square w-full overflow-hidden rounded-lg bg-white">
                    {p.thumbnail ? (
                      <img
                        alt={p.title}
                        className="h-full w-full object-contain"
                        onError={handleImageError}
                        src={p.thumbnail}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gray-100 text-3xl">
                        🧸
                      </div>
                    )}
                  </div>
                  <p className="line-clamp-2 w-full text-center text-[11px] font-medium leading-tight text-gray-700">
                    {p.title}
                  </p>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-gray-400">
            No hay peluches disponibles.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 flex-col gap-3 border-t border-gray-100 px-4 pb-7 pt-4">
        <button
          className="h-12 w-full rounded-full font-bold text-sm text-white transition disabled:opacity-40"
          disabled={!selectedId || isAdding}
          onClick={handleAdd}
          style={{ backgroundColor: "var(--primary-color)" }}
          type="button"
        >
          {isAdding ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
              Agregando...
            </span>
          ) : selectedId ? (
            "Agregar al carrito"
          ) : (
            "Seleccioná un peluche"
          )}
        </button>
        <button
          className="h-12 w-full rounded-full border border-gray-200 font-medium text-gray-500 text-sm transition hover:bg-gray-50 active:bg-gray-100"
          onClick={onContinueWithout}
          type="button"
        >
          Continuar sin peluche
        </button>
      </div>
    </motion.div>
  );
}

type CartDrawerProps = {
  open: boolean;
  onClose: () => void;
  /**
   * Clase de tema opcional aplicada al root del Dialog. El Dialog se portea a
   * <body> (fuera del wrapper del template), así que esta clase es el hook para
   * re-tematizarlo por template (p.ej. "sports-cart") vía CSS global.
   */
  themeClassName?: string;
};

// Tracks which cart ids have already triggered the Mundial gift auto-add in
// the current page session. Module-level so it survives React Strict Mode's
// double-invocation and any drawer remounts; cleared on full page reload,
// which is what we want — a fresh tab can re-trigger if conditions hold.
const mundialAutoAddedCartIds = new Set<string>();
// Last observed `hasGift` value per cart id, used to detect the true→false
// transition (user manually removed the gift). Module-level so it survives
// Strict Mode just like the Set above; without this, the `hasGift=false`
// window between mount and addItem completing would clear the Set on every
// remount and cause duplicate adds.
const mundialLastObservedHasGift = new Map<string, boolean>();

// Same once-per-session guard pair, but for the FREEFIXTURE auto-add.
const freefixtureAutoAddedCartIds = new Set<string>();
const freefixtureLastObservedHasGift = new Map<string, boolean>();
// Tracks line ids we've already issued a remove for. `removeItem` is optimistic
// and a duplicate call (Strict Mode or rapid re-render) would hit the server
// twice with a stale line id.
const freefixtureAutoRemovedLineIds = new Set<string>();

const CartDrawer = ({ open, onClose, themeClassName }: CartDrawerProps) => {
  const { countryCode } = useParams() as { countryCode: string };
  const router = useRouter();
  const demoHref = useDemoHref();

  // Zustand store
  const cart = useCartStore((state) => state.cart);
  const changeItemQuantity = useCartStore((state) => state.changeItemQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const resetCartState = useCartStore((state) => state.clearCart);
  const fetchCart = useCartStore((state) => state.fetchCart);
  const addItem = useCartStore((state) => state.addItem);
  const pendingQuantityUpdates = useCartStore(
    (state) => state.pendingQuantityUpdates,
  );

  // Fetch promotions for cart items using Typesense (only when cart is opened)
  const { promotions, isLoading: promotionsLoading } = useCartPromotions(
    open ? cart : null,
  );

  // Disney promo removed — stub yields null promotion
  const disneyAdminPromo = null;
  const disneyState = useDisneyPromoState(disneyAdminPromo, cart?.items ?? []);
  const disneyGiftDiscountApplied = isDisneyGiftDiscountApplied(
    cart?.items,
    disneyState,
  );
  const disneyTargetIdsSet = useMemo(
    () => new Set(disneyState.targetProductIds),
    [disneyState.targetProductIds],
  );
  const disneyPromoIdsSet = useMemo(
    () =>
      new Set<string>([
        ...disneyState.buyProductIds,
        ...disneyState.targetProductIds,
      ]),
    [disneyState.buyProductIds, disneyState.targetProductIds],
  );
  const suppressDisneyOnTargets =
    Boolean(disneyState.promo) && !disneyState.unlocked;

  // Mundial buyget promo: same pattern as Disney
  const { promotion: mundialAdminPromo } = usePromotionByCode(
    open ? MUNDIAL_PROMO_CODE : null,
  );
  const mundialState = useMundialPromoState(
    mundialAdminPromo,
    cart?.items ?? [],
  );
  const mundialTargetIdsSet = useMemo(
    () => new Set(mundialState.targetProductIds),
    [mundialState.targetProductIds],
  );
  const mundialPromoIdsSet = useMemo(
    () =>
      new Set<string>([
        ...mundialState.buyProductIds,
        ...mundialState.targetProductIds,
      ]),
    [mundialState.buyProductIds, mundialState.targetProductIds],
  );
  const suppressMundialOnTargets =
    Boolean(mundialState.promo) && !mundialState.unlocked;

  // FREEFIXTURE buyget promo: same pattern as Mundial but without the notice
  // (purely silent auto-add when any qualifying-category product is in cart).
  const { promotion: freefixtureAdminPromo } = usePromotionByCode(
    open ? FREEFIXTURE_PROMO_CODE : null,
  );
  const freefixtureState = useFreefixturePromoState(
    freefixtureAdminPromo,
    cart?.items ?? [],
  );
  const suppressFreefixtureOnTargets =
    Boolean(freefixtureState.promo) && !freefixtureState.unlocked;

  const [removingItems, setRemovingItems] = useState<Record<string, boolean>>(
    {},
  );
  const [clearingCart, setClearingCart] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showPelucheModal, setShowPelucheModal] = useState(false);

  // Reset peluche modal state whenever the drawer closes so that on the next
  // open it starts clean (avoids stale state + avoids fetching without filters
  // while the Disney promo is still loading).
  useEffect(() => {
    if (!open) setShowPelucheModal(false);
  }, [open]);

  const disneyRecalcRequestedRef = useRef<string | null>(null);

  useEffect(() => {
    if (
      !open ||
      !cart?.id ||
      !disneyState.unlocked ||
      !disneyState.hasFreeGift ||
      disneyGiftDiscountApplied
    ) {
      if (disneyGiftDiscountApplied) {
        disneyRecalcRequestedRef.current = null;
      }
      return;
    }

    if (disneyRecalcRequestedRef.current === cart.id) {
      return;
    }

    const manualCodes = (cart.promotions ?? [])
      .filter((promotion) => promotion?.code && !promotion?.is_automatic)
      .map((promotion) => promotion.code as string);

    disneyRecalcRequestedRef.current = cart.id;
    void fetch("/api/store/cart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "applyPromotion",
        codes: manualCodes,
      }),
    })
      .then((response) => response.json().catch(() => ({})))
      .then((data) => {
        if (data?.cart) {
          useCartStore.setState({ cart: data.cart });
          return;
        }

        void fetchCart();
      })
      .catch(() => {
        void fetchCart();
      });
  }, [
    cart?.id,
    disneyGiftDiscountApplied,
    disneyState.hasFreeGift,
    disneyState.unlocked,
    fetchCart,
    open,
  ]);

  // Mundial promo auto-add: once the buy condition (4 textiles) is met, drop
  // exactly one gift botella into the cart. Guarded by `mundialAutoAddedCartIds`
  // (module-level) so React Strict Mode remounts, dep churn, and back-to-back
  // renders during the async addItem can never fire it more than once per
  // cart session. We also re-check the live cart state right before adding so
  // a parallel auto-add (e.g. from a remount) can't double up either.
  useEffect(() => {
    // Detect the true→false transition (user just removed the gift while the
    // promo is still valid) and only then clear the guard so we can re-add.
    // A plain `!hasGift` check would also fire during the brief window between
    // mount and addItem completing, which under Strict Mode causes duplicates.
    if (cart?.id) {
      const prevHasGift = mundialLastObservedHasGift.get(cart.id) ?? false;
      if (prevHasGift && !mundialState.hasGift) {
        mundialAutoAddedCartIds.delete(cart.id);
      }
      mundialLastObservedHasGift.set(cart.id, mundialState.hasGift);
    }
    if (
      !open ||
      !cart?.id ||
      !mundialState.unlocked ||
      mundialState.hasGift ||
      mundialState.targetProductIds.length === 0 ||
      // Kits are mutually exclusive with any other product in the cart (see
      // `validateKitCompatibility`). Trying to auto-add the gift botella when
      // a kit is present would fail at addItem with a "Producto incompatible"
      // toast. Should be unreachable in normal flow (4 textiles + kit can't
      // coexist) but guarded for safety against bulk imports / API direct.
      cartHasKit(cart)
    ) {
      return;
    }
    const cartId = cart.id;
    if (mundialAutoAddedCartIds.has(cartId)) return;
    mundialAutoAddedCartIds.add(cartId);

    void (async () => {
      try {
        const liveCart = useCartStore.getState().cart;
        const liveHasGift = (liveCart?.items ?? []).some(
          (item) =>
            Boolean(item.product_id) &&
            mundialState.targetProductIds.includes(item.product_id as string),
        );
        if (liveHasGift) return;

        const result = await searchProductsFromBrowser({
          productIds: mundialState.targetProductIds,
          limit: mundialState.targetProductIds.length,
        });
        const candidates: TypesenseProductDocument[] = result.products;
        const target =
          candidates.find((p) => (p.stock_available ?? 0) > 0) ?? candidates[0];
        const variantId = target?.variants?.[0]?.id;
        if (!target || !variantId) {
          mundialAutoAddedCartIds.delete(cartId);
          return;
        }

        // Re-check after the network round-trip: another concurrent add may
        // have already dropped the gift in.
        const cartAfterFetch = useCartStore.getState().cart;
        const stillNeedsGift = !(cartAfterFetch?.items ?? []).some(
          (item) =>
            Boolean(item.product_id) &&
            mundialState.targetProductIds.includes(item.product_id as string),
        );
        if (!stillNeedsGift) return;

        await addItem(variantId, 1, countryCode, target.id, undefined, {
          title: target.title,
          handle: target.handle,
          thumbnail: target.thumbnail || target.images?.[0]?.url,
          unitPrice: target.variants?.[0]?.calculated_price?.calculated_amount,
          currencyCode: target.variants?.[0]?.calculated_price?.currency_code,
        });
      } catch (error) {
        console.error("[CART] Failed to auto-add Mundial gift botella:", error);
        mundialAutoAddedCartIds.delete(cartId);
      }
    })();
  }, [
    open,
    cart?.id,
    mundialState.unlocked,
    mundialState.hasGift,
    mundialState.targetProductIds,
    addItem,
    countryCode,
  ]);

  // FREEFIXTURE auto-add: whenever the cart has any product belonging to the
  // promo's buy categories (and the gift fixture isn't already in the cart),
  // drop in one unit of the configured target product. Same guard pair as
  // Mundial: the Set blocks re-fires within the same "session" of the gift
  // being present; the Map detects the true→false transition so removing the
  // fixture manually while the qualifying item is still in cart re-arms it.
  useEffect(() => {
    if (cart?.id) {
      const prevHasGift = freefixtureLastObservedHasGift.get(cart.id) ?? false;
      if (prevHasGift && !freefixtureState.hasGift) {
        freefixtureAutoAddedCartIds.delete(cart.id);
      }
      freefixtureLastObservedHasGift.set(cart.id, freefixtureState.hasGift);
    }

    if (
      !open ||
      !cart?.id ||
      !freefixtureState.unlocked ||
      freefixtureState.hasGift ||
      freefixtureState.targetProductIds.length === 0 ||
      // Kits are mutually exclusive with any other product in the cart (see
      // `validateKitCompatibility`). Trying to auto-add the fixture when a kit
      // is present would fail at addItem with a "Producto incompatible" toast.
      cartHasKit(cart)
    ) {
      return;
    }

    const cartId = cart.id;
    if (freefixtureAutoAddedCartIds.has(cartId)) return;
    freefixtureAutoAddedCartIds.add(cartId);

    void (async () => {
      try {
        const liveCart = useCartStore.getState().cart;
        const liveHasGift = (liveCart?.items ?? []).some(
          (item) =>
            Boolean(item.product_id) &&
            freefixtureState.targetProductIds.includes(
              item.product_id as string,
            ),
        );
        if (liveHasGift) return;

        const result = await searchProductsFromBrowser({
          productIds: freefixtureState.targetProductIds,
          limit: freefixtureState.targetProductIds.length,
        });
        const candidates: TypesenseProductDocument[] = result.products;
        const target =
          candidates.find((p) => (p.stock_available ?? 0) > 0) ?? candidates[0];
        const variantId = target?.variants?.[0]?.id;
        if (!target || !variantId) {
          freefixtureAutoAddedCartIds.delete(cartId);
          return;
        }

        const cartAfterFetch = useCartStore.getState().cart;
        const stillNeedsGift = !(cartAfterFetch?.items ?? []).some(
          (item) =>
            Boolean(item.product_id) &&
            freefixtureState.targetProductIds.includes(
              item.product_id as string,
            ),
        );
        if (!stillNeedsGift) return;

        await addItem(variantId, 1, countryCode, target.id, undefined, {
          title: target.title,
          handle: target.handle,
          thumbnail: target.thumbnail || target.images?.[0]?.url,
          unitPrice: target.variants?.[0]?.calculated_price?.calculated_amount,
          currencyCode: target.variants?.[0]?.calculated_price?.currency_code,
        });
      } catch (error) {
        console.error(
          "[CART] Failed to auto-add FREEFIXTURE gift fixture:",
          error,
        );
        freefixtureAutoAddedCartIds.delete(cartId);
      }
    })();
  }, [
    open,
    cart?.id,
    freefixtureState.unlocked,
    freefixtureState.hasGift,
    freefixtureState.targetProductIds,
    addItem,
    countryCode,
  ]);

  // Mirror of the auto-add: if the fixture is in the cart but the promo is no
  // longer unlocked (user removed the qualifying-category product), pull the
  // gift out. The Set guards against duplicate `removeItem` calls (Strict Mode
  // double-mount, optimistic state churn).
  useEffect(() => {
    if (!open || !cart?.id) return;
    if (!freefixtureState.promo) return;
    if (freefixtureState.unlocked || !freefixtureState.hasGift) return;

    const targetIds = freefixtureState.targetProductIds;
    const liveCart = useCartStore.getState().cart;
    const linesToRemove = (liveCart?.items ?? []).filter(
      (item) =>
        Boolean(item.product_id) &&
        targetIds.includes(item.product_id as string),
    );
    if (!linesToRemove.length) return;

    for (const line of linesToRemove) {
      if (freefixtureAutoRemovedLineIds.has(line.id)) continue;
      freefixtureAutoRemovedLineIds.add(line.id);
      void removeItem(line.id).catch((error) => {
        console.error(
          "[CART] Failed to auto-remove FREEFIXTURE gift fixture:",
          error,
        );
        freefixtureAutoRemovedLineIds.delete(line.id);
      });
    }
  }, [
    open,
    cart?.id,
    freefixtureState.promo,
    freefixtureState.unlocked,
    freefixtureState.hasGift,
    freefixtureState.targetProductIds,
    removeItem,
  ]);

  const items = cart?.items ?? [];
  const totalItems = items.reduce((acc, item) => acc + item.quantity, 0) || 0;

  // Total = what the user should actually pay after suppressing buyget
  // discounts whose conditions aren't fully met yet (Disney 3+3, Mundial 4+1,
  // FREEFIXTURE 1-of-category + fixture).
  const total = items.reduce((acc, item) => {
    const suppress =
      shouldSuppressDisneyTargetDiscount(item, disneyState) ||
      shouldSuppressMundialTargetDiscount(item, mundialState) ||
      shouldSuppressFreefixtureTargetDiscount(item, freefixtureState);
    if (suppress) {
      return acc + (item.original_total ?? item.total ?? 0);
    }
    return acc + getDisneyEffectiveItemTotal(item, disneyState);
  }, 0);

  // Subtotal = sum of original prices (before discounts)
  const subtotal = items.reduce(
    (acc, item) => acc + (item.original_total ?? item.total ?? 0),
    0,
  );

  const hasOutOfStockItems = items.some((item) => !isLineItemInStock(item));
  const backendMinimumPurchase = useMinimumPurchaseAmount();
  const { canCheckout, hasMinimumPurchase, progress, remaining } = useMemo(
    () =>
      getCartCheckoutEligibility({
        items,
        hasOutOfStockItems,
        cartPromotions: cart?.promotions,
        minimumPurchaseAmount: backendMinimumPurchase ?? undefined,
      }),
    [items, hasOutOfStockItems, cart?.promotions, backendMinimumPurchase],
  );

  const productMaxQuantityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const promo of cart?.promotions ?? []) {
      if (!promo) continue;
      const appMethod = promo.application_method as any;
      const mq: number | undefined = appMethod?.max_quantity;
      if (!mq) continue;
      const rules: any[] = appMethod?.target_rules ?? [];
      for (const rule of rules) {
        for (const val of rule.values ?? []) {
          if (val.value) map.set(val.value, mq);
        }
      }
    }
    return map;
  }, [cart?.promotions]);

  // Optimistic + debounced. Delta relativo (lee la cantidad actual del store):
  // los +/- del drawer ya no pierden clicks rápidos por un `item.quantity` viejo
  // del render. changeItemQuantity clampea a mínimo 1 (el "-" solo aparece con
  // cantidad > 1; eliminar es el botón de tacho).
  const handleQuantityDelta = (lineId: string, delta: number) => {
    changeItemQuantity(lineId, delta);
  };

  const handleRemovePromotion = async (code: string) => {
    const currentPromos = ((cart as any)?.promotions ?? []) as any[];
    const remainingCodes = currentPromos
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
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("cart-updated"));
        }
      } else {
        await fetchCart();
      }
    } catch (error) {
      console.error("[CART] Failed to remove promotion:", error);
      await fetchCart();
    }
  };

  const handleRemoveItem = async (lineId: string) => {
    setRemovingItems((prev) => ({ ...prev, [lineId]: true }));
    try {
      await removeItem(lineId);
    } finally {
      setRemovingItems((prev) => ({ ...prev, [lineId]: false }));
    }
  };

  const handleCheckoutAttempt = useCallback(() => {
    if (
      disneyState.unlocked &&
      !disneyState.hasFreeGift &&
      disneyState.targetProductIds.length > 0
    ) {
      setShowPelucheModal(true);
    } else {
      onClose();
      router.push(demoHref("/checkout"));
    }
  }, [
    disneyState.unlocked,
    disneyState.hasFreeGift,
    disneyState.targetProductIds.length,
    onClose,
    router,
  ]);

  const handleConfirmCheckoutWithoutGift = useCallback(() => {
    setShowPelucheModal(false);
    onClose();
    router.push(demoHref("/checkout"));
  }, [onClose, router]);

  const handlePelucheAdded = useCallback(() => {
    setShowPelucheModal(false);
    onClose();
    router.push(demoHref("/checkout"));
  }, [onClose, router]);

  const handleClearCart = async () => {
    if (!cart?.items?.length) {
      return;
    }
    // Snapshot for rollback if the server call fails
    const snapshot = cart;
    setClearingCart(true);
    // Optimistic: empty the local cart immediately so the UI is responsive
    // even on slow/flaky connections. A single atomic server call follows.
    resetCartState();
    try {
      const response = await fetch("/api/store/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clearCart" }),
      });
      const data = await response.json().catch(() => ({ success: false }));
      if (!response.ok || !data.success) {
        throw new Error(
          (data && data.message) || "No se pudo vaciar el carrito",
        );
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("cart-updated"));
      }
    } catch (error) {
      console.error("[CART] Clear failed:", error);
      // Rollback optimistic state and refresh from server to stay consistent
      useCartStore.setState({
        cart: snapshot,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo vaciar el carrito",
      });
      try {
        await fetchCart();
      } catch {
        // fetchCart already handles its own error state
      }
    } finally {
      setClearingCart(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <Dialog
          className={`relative z-[9000]${themeClassName ? ` ${themeClassName}` : ""}`}
          onClose={onClose}
          open={open}
        >
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/30"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: "linear" }}
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
                    transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <div className="relative flex h-full flex-col overflow-hidden bg-white shadow-xl">
                      <div className="border-gray-100 border-b">
                        <div className="flex h-[68px] items-center justify-between px-4 sm:px-6">
                          <DialogTitle className="flex items-center gap-2 font-bold text-gray-900 text-xl">
                            Carrito
                            {totalItems > 0 && (
                              <span className="inline-flex items-center justify-center rounded-full bg-[--primary-color] px-2 py-[3px] font-normal text-xs text-white">
                                {totalItems} unidades
                              </span>
                            )}
                          </DialogTitle>
                          <button
                            aria-label="Cerrar panel"
                            className="flex h-10 w-10 items-center justify-center text-gray-500 transition-colors hover:text-gray-900"
                            onClick={onClose}
                            type="button"
                          >
                            <span className="sr-only">Cerrar panel</span>
                            <XMarkIcon aria-hidden="true" className="size-5" />
                          </button>
                        </div>
                        {items.length > 0 && (
                          <MinimumPurchaseNotice
                            currencyCode={cart?.currency_code}
                            hasMinimumPurchase={hasMinimumPurchase}
                            progress={progress}
                            remaining={remaining}
                          />
                        )}
                        {/*
                          Barra de envío gratis + productos puente. Reemplaza el bloque muerto
                          `{false && ...}` que había acá: era una barra de progreso apagada cuyo
                          reemplazo vivo es el MinimumPurchaseNotice de arriba. El slot lo genera el
                          composer y devuelve null sin la extensión.
                        */}
                        {items.length > 0 && cart?.region ? (
                          <div className="px-4 pb-2 sm:px-6">
                            <FreeShippingBridge
                              countryCode={countryCode}
                              region={cart.region as HttpTypes.StoreRegion}
                            />
                          </div>
                        ) : null}
                      </div>
                      <div
                        className={`flex-1 bg-[--badge-bg] px-4 py-6 sm:px-6 ${items.length ? "overflow-y-auto" : ""}`}
                      >
                        <div>
                          {items.length ? (
                            <div className="flow-root">
                              <DisneyPromoStatusNotice
                                discountApplied={disneyGiftDiscountApplied}
                                state={disneyState}
                              />
                              <MundialPromoNotice
                                className="-mt-4 mb-2"
                                state={mundialState}
                              />
                              <ul className="flex flex-col gap-2">
                                <AnimatePresence initial={false}>
                                  {[...items]
                                    .sort((a, b) =>
                                      (a.created_at ?? "") >
                                      (b.created_at ?? "")
                                        ? -1
                                        : 1,
                                    )
                                    .map((item) => (
                                      <CartItemRow
                                        currencyCode={
                                          cart?.currency_code ?? "ars"
                                        }
                                        isRemoving={!!removingItems[item.id]}
                                        isUpdating={pendingQuantityUpdates.has(
                                          item.id,
                                        )}
                                        item={item}
                                        // Key by variant_id (stable) instead of
                                        // item.id: when an optimistic line
                                        // (optimistic-line-…) is reconciled with
                                        // the real server line, item.id changes
                                        // and AnimatePresence would exit+enter
                                        // the card (flicker: appears, disappears,
                                        // reappears). variant_id stays constant
                                        // across that swap, so the row just
                                        // morphs in place.
                                        key={item.variant_id ?? item.id}
                                        maxQuantity={
                                          productMaxQuantityMap.get(
                                            item.product_id ?? "",
                                          ) ??
                                          (item as any).product?.categories
                                            ?.map((c: { id: string }) =>
                                              productMaxQuantityMap.get(c.id),
                                            )
                                            .find(
                                              (v: number | undefined) =>
                                                v != null,
                                            ) ??
                                          null
                                        }
                                        onQuantityDelta={handleQuantityDelta}
                                        onRemove={handleRemoveItem}
                                        onNavigate={onClose}
                                        promotions={
                                          item.product_id
                                            ? promotions[item.product_id]
                                                ?.promotions
                                            : []
                                        }
                                        suppressDisneyPromo={
                                          suppressDisneyOnTargets &&
                                          Boolean(item.product_id) &&
                                          disneyTargetIdsSet.has(
                                            item.product_id as string,
                                          )
                                        }
                                        showDisneyBadge={
                                          Boolean(item.product_id) &&
                                          disneyPromoIdsSet.has(
                                            item.product_id as string,
                                          )
                                        }
                                        suppressMundialPromo={
                                          suppressMundialOnTargets &&
                                          Boolean(item.product_id) &&
                                          mundialTargetIdsSet.has(
                                            item.product_id as string,
                                          )
                                        }
                                        showMundialBadge={
                                          Boolean(item.product_id) &&
                                          mundialPromoIdsSet.has(
                                            item.product_id as string,
                                          )
                                        }
                                        suppressFreefixturePromo={
                                          suppressFreefixtureOnTargets &&
                                          Boolean(item.product_id) &&
                                          freefixtureState.targetProductIds.includes(
                                            item.product_id as string,
                                          )
                                        }
                                        showFreefixtureBadge={
                                          Boolean(freefixtureState.promo) &&
                                          Boolean(item.product_id) &&
                                          freefixtureState.targetProductIds.includes(
                                            item.product_id as string,
                                          )
                                        }
                                      />
                                    ))}
                                </AnimatePresence>
                              </ul>
                              <div className="mt-4">
                                <div className="flex justify-end">
                                  <button
                                    className="flex items-center gap-1.5 text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                                    disabled={clearingCart}
                                    onClick={() => setShowClearConfirm(true)}
                                    style={{
                                      fontSize: "13px",
                                      fontWeight: 500,
                                    }}
                                    type="button"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                    {clearingCart
                                      ? "Vaciando..."
                                      : "Vaciar carrito"}
                                  </button>
                                </div>
                              </div>
                              {/*
                                Recomendados del carrito, después de los items. Hasta
                                ahora el drawer no mostraba NADA con el carrito lleno:
                                esto es adición pura. El slot devuelve null sin la
                                extensión.
                              */}
                              {cart?.region ? (
                                <div className="mt-6">
                                  <CartRecommendations
                                    countryCode={countryCode || "ar"}
                                    region={cart.region as HttpTypes.StoreRegion}
                                  />
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-4 pt-12 text-center">
                              <ShoppingCart
                                aria-hidden="true"
                                className="h-20 w-20 text-gray-300"
                              />
                              <p className="font-semibold text-base text-gray-500">
                                Tu carrito está vacío
                              </p>
                              <p className="text-gray-400 text-sm">
                                Agregá algo para hacerlo feliz :)
                              </p>
                              <CartSuggestedProducts
                                countryCode={countryCode || "ar"}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Footer: always visible */}
                      <CartFooterExact
                        canCheckout={canCheckout}
                        currencyCode={cart?.currency_code ?? "ars"}
                        hasOutOfStockItems={hasOutOfStockItems}
                        items={items}
                        onCheckoutClick={handleCheckoutAttempt}
                        onClose={onClose}
                        subtotal={subtotal}
                        total={total}
                        promotions={(cart as any)?.promotions ?? []}
                        onRemovePromotion={handleRemovePromotion}
                      />
                      {/* Peluche gift modal */}
                      <AnimatePresence>
                        {showPelucheModal && (
                          <motion.div
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 z-10 flex items-end justify-center bg-black/40 sm:items-center"
                            exit={{ opacity: 0 }}
                            initial={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <PelucheGiftModalContent
                              countryCode={countryCode || "ar"}
                              onContinueWithout={
                                handleConfirmCheckoutWithoutGift
                              }
                              onSuccess={handlePelucheAdded}
                              targetProductIds={disneyState.targetProductIds}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Clear cart confirmation modal */}
                      <AnimatePresence>
                        {showClearConfirm && (
                          <motion.div
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 z-10 flex items-center justify-center bg-black/30 px-4"
                            exit={{ opacity: 0 }}
                            initial={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <motion.div
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
                              exit={{ opacity: 0, scale: 0.95, y: 10 }}
                              initial={{ opacity: 0, scale: 0.95, y: 10 }}
                              transition={{ duration: 0.2 }}
                            >
                              <h3 className="font-bold text-[20px] text-gray-900">
                                ¿Vaciar carrito de compras?
                              </h3>
                              <p className="mt-2 text-sm text-gray-500">
                                Se eliminarán todos los productos que agregaste
                                al carrito.
                              </p>
                              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                                <button
                                  className="flex-1 rounded-full bg-red-600 px-4 py-3 font-bold text-sm text-white transition hover:bg-red-700 disabled:opacity-50"
                                  disabled={clearingCart}
                                  onClick={async () => {
                                    await handleClearCart();
                                    setShowClearConfirm(false);
                                  }}
                                  type="button"
                                >
                                  {clearingCart
                                    ? "Vaciando..."
                                    : "Vaciar carrito"}
                                </button>
                                <button
                                  className="flex-1 rounded-full border border-gray-200 bg-white px-4 py-3 font-medium text-gray-700 text-sm transition hover:bg-gray-50"
                                  onClick={() => setShowClearConfirm(false)}
                                  type="button"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>
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

export default CartDrawer;
