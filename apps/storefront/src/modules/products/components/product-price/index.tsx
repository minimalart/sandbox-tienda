"use client";

import { useTenant } from "@lib/site-config/context";
import { getProductPrice } from "@lib/util/get-product-price";
import { convertToLocale } from "@lib/util/money";
import { isPromotionActiveForStorefront } from "@lib/util/promotion-active";
import {
  promotionBadgeName,
  selectPrimaryPromotion,
} from "@lib/util/promotion-primary";
import type { HttpTypes } from "@medusajs/types";
import { clx } from "@medusajs/ui";

function extractPromotionProductIds(
  rules: Array<{
    attribute?: string | null;
    values?: Array<{ value?: string | null }> | null;
  }> | null | undefined,
): string[] {
  return (rules ?? [])
    .filter((rule) => rule?.attribute === "items.product.id")
    .flatMap((rule) => rule.values ?? [])
    .map((value) => value?.value)
    .filter((value): value is string => Boolean(value));
}

export default function ProductPrice({
  product,
  variant,
}: {
  product: HttpTypes.StoreProduct & {
    discount?: number;
    subtotal?: number;
    price?: number;
    promotions?: Array<{
      application_method?: { type?: string; value?: number };
      status?: string;
      type?: string;
      code?: string;
      is_automatic?: boolean;
      campaign?: {
        id?: string;
        name?: string;
        status?: string | null;
        is_active?: boolean | null;
        starts_at?: string | null;
        ends_at?: string | null;
        deleted_at?: string | null;
      };
    }> | null;
  };
  variant?: HttpTypes.StoreProductVariant;
}) {
  const tenant = useTenant();
  const isSports = tenant.template === "sports";
  const { cheapestPrice, variantPrice } = getProductPrice({
    product,
    variantId: variant?.id,
  });

  const selectedPrice = variant ? variantPrice : cheapestPrice;
  // Disney promo removed — always false
  const isInDisneyPromo = false;

  const activePromotions = (product.promotions ?? []).filter((promotion) =>
    isPromotionActiveForStorefront(promotion),
  );

  // Acceder directamente al calculated_amount si está disponible
  const calculatedAmount = variant?.calculated_price?.calculated_amount;
  const originalAmount = variant?.calculated_price?.original_amount;
  const currencyCode = variant?.calculated_price?.currency_code;

  // Una sola promo "primaria": la que se aplica al carrito y define el precio
  // mostrado. Aun si los datos trajeran varias, mostramos un solo badge.
  const rankingBase =
    (typeof originalAmount === "number" && originalAmount > 0
      ? originalAmount
      : 0) ||
    (typeof calculatedAmount === "number" && calculatedAmount > 0
      ? calculatedAmount
      : 0) ||
    (product.price ?? 0);
  const primaryPromo = selectPrimaryPromotion(activePromotions, rankingBase);
  const primaryBadgeName = promotionBadgeName(primaryPromo);
  const promotionBadges = primaryBadgeName ? [primaryBadgeName] : [];

  // Check for Typesense discount data
  const hasTypesenseDiscount =
    activePromotions.length > 0 &&
    (product.discount ?? 0) > 0 && (product.subtotal ?? 0) > 0;

  // Buyget / percentage derivados de la primaria (a lo sumo uno es truthy).
  const buygetPromo =
    primaryPromo?.type === "buyget" ? primaryPromo : undefined;
  const percentagePromo =
    primaryPromo &&
    primaryPromo.type !== "buyget" &&
    primaryPromo.application_method?.type === "percentage"
      ? primaryPromo
      : undefined;
  const promoPercentage = percentagePromo?.application_method?.value || 0;

  // Calculate discount percentage from variant data
  const hasCalculatedDiscount = Boolean(
    typeof calculatedAmount === "number" &&
    typeof originalAmount === "number" &&
    originalAmount > calculatedAmount,
  );
  const calculatedDiscountPercentage = hasCalculatedDiscount
    ? Math.round(
        ((originalAmount! - calculatedAmount!) / originalAmount!) * 100,
      )
    : 0;

  // Determine if there's a discount
  const hasDiscount =
    hasTypesenseDiscount ||
    promoPercentage > 0 ||
    hasCalculatedDiscount ||
    Boolean(buygetPromo);
  const discountPercentage =
    promoPercentage > 0 ? promoPercentage : calculatedDiscountPercentage;

  // Promotion type and label (for buyget promotions)
  const promotionType = buygetPromo ? "buyget" : null;
  const promotionLabel = buygetPromo?.code || null;
  const promotionName =
    percentagePromo?.campaign?.name ||
    percentagePromo?.code ||
    buygetPromo?.campaign?.name ||
    buygetPromo?.code ||
    null;
  const showDisneyBadge = !hasDiscount && isInDisneyPromo;
  const buygetBadgeLabel =
    promotionType === "buyget" ? promotionLabel : showDisneyBadge ? "Disney" : null;

  // Si tenemos acceso directo al calculated_amount, lo usamos
  const formattedPrice = hasTypesenseDiscount
    ? convertToLocale({
        amount: product.subtotal!,
        currency_code: "ARS",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        locale: "es-AR",
      })
    : calculatedAmount && currencyCode
      ? convertToLocale({
          amount: calculatedAmount,
          currency_code: currencyCode,
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
          locale: "es-AR",
        })
      : selectedPrice?.calculated_price;

  const formattedOriginalPrice =
    hasTypesenseDiscount && product.price
      ? convertToLocale({
          amount: product.price,
          currency_code: "ARS",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
          locale: "es-AR",
        })
      : hasCalculatedDiscount && originalAmount
        ? convertToLocale({
            amount: originalAmount,
            currency_code: currencyCode || "ARS",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
            locale: "es-AR",
          })
        : selectedPrice?.original_price;

  // Determinar si es un precio de oferta
  const isPriceSale = hasDiscount || selectedPrice?.price_type === "sale";

  const formatWithSymbol = (value?: string | null) =>
    value ? `$ ${value}` : value;

  // Calculate tax-free price (sin impuestos nacionales - 21% IVA)
  const priceWithoutTax = (() => {
    let numericAmount: number | null = null;
    if (hasTypesenseDiscount && product.subtotal) {
      numericAmount = product.subtotal;
    } else if (calculatedAmount) {
      numericAmount = calculatedAmount;
    } else if (selectedPrice?.calculated_price_number) {
      numericAmount = selectedPrice.calculated_price_number;
    }
    if (numericAmount === null || numericAmount <= 0) return null;
    const taxFree = Math.round(numericAmount / 1.21);
    return convertToLocale({
      amount: taxFree,
      currency_code: "ARS",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      locale: "es-AR",
    });
  })();

  if (!(selectedPrice || formattedPrice)) {
    return <div className="block h-9 w-32 animate-pulse bg-gray-100" />;
  }

  return (
    <div className="text-gray-900">
      <div className="flex items-center gap-2">
        <span className="font-bold text-2xl">
          <span
            data-testid="product-price"
            data-value={
              hasTypesenseDiscount
                ? product.subtotal
                : calculatedAmount || selectedPrice?.calculated_price_number
            }
          >
            {formatWithSymbol(
              formattedPrice || selectedPrice?.calculated_price,
            )}
          </span>
        </span>
        {/* Badge de promo junto al precio. En sports usa el acento (amarillo)
            rectangular, igual que las cards; en el resto, el pill naranja. */}
        {promotionBadges.map((badge) => (
          <span
            key={badge}
            className={
              isSports
                ? "inline-flex h-[24px] items-center justify-center rounded-none bg-[--accent-color] px-2.5 font-bold text-[--sp-ink] text-xs uppercase tracking-[0.06em]"
                : "inline-flex h-[24px] items-center justify-center rounded-[8px] bg-[var(--accent-color,#f97316)] px-2.5 font-semibold text-white text-xs"
            }
          >
            {badge}
          </span>
        ))}
        {isPriceSale && promotionType !== "buyget" && (
          <span
            className="text-gray-500 text-sm line-through"
            data-testid="original-product-price"
            data-value={
              hasTypesenseDiscount
                ? product.price
                : selectedPrice?.original_price_number
            }
          >
            {formatWithSymbol(formattedOriginalPrice)}
          </span>
        )}
      </div>
      {priceWithoutTax && (
        <p className="text-[#6B7280] text-xs leading-snug mt-1">
          Precio sin imp. nac. ${priceWithoutTax}
        </p>
      )}
    </div>
  );
}
