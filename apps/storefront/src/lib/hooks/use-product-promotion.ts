"use client";

import { useMemo } from "react";
import { useChannelSafe } from "@lib/context/channel-context";
import { getIndividualVariant } from "@lib/util/get-individual-variant";
import { convertToLocale } from "@lib/util/money";
import { isPromotionActiveForStorefront } from "@lib/util/promotion-active";
import {
  promotionBadgeName,
  selectPrimaryPromotion,
} from "@lib/util/promotion-primary";
import type { TypesenseProductDocument } from "@lib/typesense";
import type { HttpTypes } from "@medusajs/types";

/** Shape mínimo de una entry en `variant.channel_prices`. Se replica local
 *  para no acoplar el hook a la definición completa del doc de Typesense. */
type ChannelPriceLike = {
  sales_channel_id: string;
  calculated_amount: number;
  original_amount: number;
  currency_code: string;
};

/** Busca en `variant.channel_prices` la entry que corresponde al canal activo.
 *  Devuelve `null` si el array no está o si ninguna entry matchea. Este es el
 *  puente entre el widget de PR #1101 y el hook: el sync ya indexó los
 *  overrides por canal, el ChannelContext tiene el canal activo, este helper
 *  los cruza. */
function pickChannelPrice(
  variant: unknown,
  activeChannelId: string | null | undefined,
): ChannelPriceLike | null {
  if (!activeChannelId) return null;
  const cp = (variant as { channel_prices?: ChannelPriceLike[] } | null | undefined)
    ?.channel_prices;
  if (!Array.isArray(cp) || cp.length === 0) return null;
  return cp.find((entry) => entry?.sales_channel_id === activeChannelId) ?? null;
}

type ProductWithPromotions =
  | TypesenseProductDocument
  | (HttpTypes.StoreProduct & {
      discount?: number;
      subtotal?: number;
      price?: number;
      promotions?: Array<{
        application_method?: {
          type?: string;
          value?: number | number[];
          max_quantity?: number;
        };
        status?: string;
        code?: string;
        type?: string;
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
      }>;
    });

type PromotionData = {
  hasDiscount: boolean;
  discountPercentage: number;
  formattedPrice: string;
  formattedOriginalPrice: string | null;
  priceWithSymbol: string;
  originalPriceWithSymbol: string | null;
  priceWithoutTax: string | null;
  promotionType: string | null;
  promotionLabel: string | null;
  promotionName: string | null;
  /** Badge de la promo primaria (la que se aplica al carrito). 0 o 1 elemento. */
  promotionBadges: string[];
  maxQuantity: number | null;
};

type UseProductPromotionParams = {
  product?: ProductWithPromotions;
  selectedVariant?:
    | HttpTypes.StoreProductVariant
    | TypesenseProductDocument["variants"][0];
  currencyCode?: string;
  region?: HttpTypes.StoreRegion;
};

export function useProductPromotion({
  product,
  selectedVariant,
  currencyCode = "ARS",
  region,
}: UseProductPromotionParams): PromotionData {
  const regionCurrency = region?.currency_code || currencyCode;
  // Canal activo desde el ChannelContext (client-side). Fuera del provider
  // (checkout/auth) el safe hook devuelve null y caemos al `calculated_price`
  // base — comportamiento idéntico al anterior a EDUCABOT-9.
  const channelState = useChannelSafe();
  const activeChannelId = channelState?.config.salesChannelId ?? null;

  return useMemo(() => {
    // Sin producto (ej: video sin producto vinculado) devolvemos defaults seguros
    // para que el hook nunca rompa al consumirse de forma incondicional.
    if (!product) {
      return {
        hasDiscount: false,
        discountPercentage: 0,
        formattedPrice: "Consultar",
        formattedOriginalPrice: null,
        priceWithSymbol: "Consultar",
        originalPriceWithSymbol: null,
        priceWithoutTax: null,
        promotionType: null,
        promotionLabel: null,
        promotionName: null,
        promotionBadges: [],
        maxQuantity: null,
      };
    }

    // REGLA B2C: fallback a la variante Individual, no a variants[0] (que puede ser Bulto).
    const productVariant =
      selectedVariant ||
      getIndividualVariant(
        product.variants as HttpTypes.StoreProductVariant[] | undefined,
      ) ||
      product.variants?.[0];

    // Prioridad: override channel-scoped (EDUCABOT-9) > calculated_price base.
    // El `pickChannelPrice` devuelve null si no hay `channel_prices` en el doc
    // (site sin reglas de canal) o si el canal activo no está entre los
    // linkeados — en ambos casos caemos al `calculated_price` de siempre.
    const channelPrice = pickChannelPrice(productVariant, activeChannelId);
    const calculatedAmount =
      channelPrice?.calculated_amount ??
      productVariant?.calculated_price?.calculated_amount;
    const originalAmount =
      channelPrice?.original_amount ??
      productVariant?.calculated_price?.original_amount;
    const variantCurrency =
      channelPrice?.currency_code ||
      productVariant?.calculated_price?.currency_code ||
      regionCurrency;

    const activePromotions = (product.promotions ?? []).filter((promotion) =>
      isPromotionActiveForStorefront(promotion),
    );

    const hasTypesenseDiscount =
      activePromotions.length > 0 &&
      (product.discount ?? 0) > 0 && (product.subtotal ?? 0) > 0;

    // Elegimos UNA sola promo "primaria": la que se aplicaría al carrito y que,
    // por ende, define el precio mostrado. Ver selectPrimaryPromotion. Tras el
    // dedup de datos cada producto tiene una sola promo, así que esto normalmente
    // devuelve esa única; el ranking es la red de seguridad para no mostrar nunca
    // más de un badge y que el que se muestre sea el que aplica.
    const rankingBase =
      (typeof originalAmount === "number" && originalAmount > 0
        ? originalAmount
        : 0) ||
      (typeof calculatedAmount === "number" && calculatedAmount > 0
        ? calculatedAmount
        : 0) ||
      (product.price ?? 0);
    const primaryPromo = selectPrimaryPromotion(activePromotions, rankingBase);

    // Derivamos buyget/percentage/fixed desde la primaria: a lo sumo una es
    // truthy, así tipo, nombre, % y badge quedan siempre consistentes entre sí.
    const buygetPromo =
      primaryPromo?.type === "buyget" ? primaryPromo : undefined;
    const percentagePromo =
      primaryPromo &&
      primaryPromo.type !== "buyget" &&
      primaryPromo.application_method?.type === "percentage"
        ? primaryPromo
        : undefined;
    const fixedPromo =
      primaryPromo &&
      primaryPromo.type !== "buyget" &&
      primaryPromo.application_method?.type === "fixed"
        ? primaryPromo
        : undefined;
    const promoValue = percentagePromo?.application_method?.value;
    const promoPercentage = Array.isArray(promoValue)
      ? promoValue[0] || 0
      : promoValue || 0;

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

    // % derived from the sync-computed discount (covers both percentage and
    // fixed promos surfaced via Typesense).
    const typesenseDiscountPercentage =
      hasTypesenseDiscount && (product.price ?? 0) > 0
        ? Math.round(((product.discount ?? 0) / (product.price as number)) * 100)
        : 0;

    const hasDiscount =
      hasTypesenseDiscount ||
      promoPercentage > 0 ||
      hasCalculatedDiscount ||
      Boolean(buygetPromo) ||
      Boolean(fixedPromo);
    const discountPercentage =
      promoPercentage > 0
        ? promoPercentage
        : typesenseDiscountPercentage > 0
          ? typesenseDiscountPercentage
          : calculatedDiscountPercentage;

    let formattedPrice = "Consultar";
    let formattedOriginalPrice: string | null = null;

    if (hasTypesenseDiscount && product.subtotal) {
      formattedPrice = convertToLocale({
        amount: product.subtotal,
        currency_code: regionCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        locale: "es-AR",
      });

      if (product.price) {
        formattedOriginalPrice = convertToLocale({
          amount: product.price,
          currency_code: regionCurrency,
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
          locale: "es-AR",
        });
      }
    } else if (calculatedAmount) {
      formattedPrice = convertToLocale({
        amount: calculatedAmount,
        currency_code: variantCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        locale: "es-AR",
      });

      if (hasDiscount && originalAmount) {
        formattedOriginalPrice = convertToLocale({
          amount: originalAmount,
          currency_code: variantCurrency,
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
          locale: "es-AR",
        });
      }
    } else if (product.price && product.price > 0) {
      formattedPrice = convertToLocale({
        amount: product.price,
        currency_code: regionCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        locale: "es-AR",
      });
    }

    const priceWithSymbol =
      formattedPrice === "Consultar" ? formattedPrice : `$ ${formattedPrice}`;
    const originalPriceWithSymbol = formattedOriginalPrice
      ? `$ ${formattedOriginalPrice}`
      : null;

    const priceWithoutTax = (() => {
      let numericAmount: number | null = null;
      if (hasTypesenseDiscount && product.subtotal) {
        numericAmount = product.subtotal;
      } else if (calculatedAmount) {
        numericAmount = calculatedAmount;
      } else if (product.price && product.price > 0) {
        numericAmount = product.price;
      }
      if (numericAmount === null || numericAmount <= 0) return null;
      const taxFree = Math.round(numericAmount / 1.21);
      return convertToLocale({
        amount: taxFree,
        currency_code: variantCurrency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
        locale: "es-AR",
      });
    })();

    const promotionType = buygetPromo
      ? "buyget"
      : percentagePromo
        ? "percentage"
        : fixedPromo
          ? "fixed"
          : null;
    const promotionLabel = buygetPromo?.code || null;
    const promotionName =
      (percentagePromo as any)?.campaign?.name ||
      percentagePromo?.code ||
      (fixedPromo as any)?.campaign?.name ||
      fixedPromo?.code ||
      (buygetPromo as any)?.campaign?.name ||
      buygetPromo?.code ||
      null;
    const maxQuantity =
      percentagePromo?.application_method?.max_quantity ??
      fixedPromo?.application_method?.max_quantity ??
      buygetPromo?.application_method?.max_quantity ??
      null;

    // Un único badge: el de la promo primaria (la que se aplica al carrito). Aun
    // si los datos trajeran varias promos, mostramos solo una.
    const primaryBadgeName = promotionBadgeName(primaryPromo);
    const promotionBadges = primaryBadgeName ? [primaryBadgeName] : [];

    return {
      hasDiscount,
      discountPercentage,
      formattedPrice,
      formattedOriginalPrice,
      priceWithSymbol,
      originalPriceWithSymbol,
      priceWithoutTax,
      promotionType,
      promotionLabel,
      promotionName,
      promotionBadges,
      maxQuantity,
    };
  }, [product, selectedVariant, regionCurrency, activeChannelId]);
}
