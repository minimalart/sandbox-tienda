import type { HttpTypes } from "@medusajs/types";

export const MANUAL_PROMO_CODES_METADATA_KEY = "storefront_manual_promo_codes";

type CartPromotion = NonNullable<HttpTypes.StoreCart["promotions"]>[number];

type CartWithPromotionMetadata = HttpTypes.StoreCart & {
  metadata?: Record<string, unknown> | null;
  promotions?: Array<CartPromotion | null> | null;
};

export function normalizeManualPromoCodes(codes: unknown): string[] {
  if (!Array.isArray(codes)) {
    return [];
  }

  return Array.from(
    new Set(
      codes
        .map((code) => (typeof code === "string" ? code.trim() : ""))
        .filter(Boolean),
    ),
  );
}

export function getManualPromoCodesFromMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string[] {
  return normalizeManualPromoCodes(
    metadata?.[MANUAL_PROMO_CODES_METADATA_KEY],
  );
}

export function buildManualPromoCodesMetadata(codes: string[]) {
  return {
    [MANUAL_PROMO_CODES_METADATA_KEY]: normalizeManualPromoCodes(codes),
  };
}

function createFallbackPromotion(code: string): CartPromotion {
  return {
    id: `storefront-manual-${code}`,
    code,
    is_automatic: false,
  } as CartPromotion;
}

export function hydrateCartPromotionsFromMetadata<
  TCart extends CartWithPromotionMetadata | null,
>(cart: TCart): TCart {
  if (!cart) {
    return cart;
  }

  const validPromotions = (cart.promotions ?? []).filter(
    (promotion): promotion is CartPromotion => Boolean(promotion),
  );
  const existingCodes = new Set(
    validPromotions
      .map((promotion) => promotion.code)
      .filter((code): code is string => Boolean(code)),
  );
  const fallbackPromotions = getManualPromoCodesFromMetadata(cart.metadata)
    .filter((code) => !existingCodes.has(code))
    .map(createFallbackPromotion);

  if (
    !fallbackPromotions.length &&
    validPromotions.length === cart.promotions?.length
  ) {
    return cart;
  }

  return {
    ...cart,
    promotions: [...validPromotions, ...fallbackPromotions],
  };
}
