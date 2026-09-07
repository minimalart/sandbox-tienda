// Stub — Disney promo removed from this storefront
import type { HttpTypes } from "@medusajs/types";

type AdminPromotion = HttpTypes.StorePromotion | null;
type CartItem = NonNullable<HttpTypes.StoreCart["items"]>[number];

export const DISNEY_PROMO_CODE = "Disney";
export const VELEZ_PROMO_CODE = "AROMATIZATUPASION";

export type DisneyPromoState = {
  promo: AdminPromotion | null;
  buyProductIds: string[];
  targetProductIds: string[];
  minQuantity: number;
  buyProductQuantity: number;
  diffuserQuantity: number;
  textileQuantity: number;
  otherBuyQuantity: number;
  requiredDiffuserQuantity: number;
  requiredTextileQuantity: number;
  unlocked: boolean;
  hasFreeGift: boolean;
};

const EMPTY_STATE: DisneyPromoState = {
  promo: null,
  buyProductIds: [],
  targetProductIds: [],
  minQuantity: 0,
  buyProductQuantity: 0,
  diffuserQuantity: 0,
  textileQuantity: 0,
  otherBuyQuantity: 0,
  requiredDiffuserQuantity: 0,
  requiredTextileQuantity: 0,
  unlocked: false,
  hasFreeGift: false,
};

export function isDisneyPromoActive(
  _promotions: Array<{ code?: string | null }> | null | undefined,
): boolean {
  return false;
}

export function getDisneyAdjustedCartTotals(
  cart: HttpTypes.StoreCart,
  _state: DisneyPromoState,
): HttpTypes.StoreCart {
  return cart;
}

export function getDisneyEffectiveItemTotal(
  item: CartItem,
  _state: DisneyPromoState,
): number {
  return item.total ?? 0;
}

export function isDisneyGiftDiscountApplied(
  _items: CartItem[] | null | undefined,
  _state: DisneyPromoState,
): boolean {
  return false;
}

export function shouldSuppressDisneyTargetDiscount(
  _item: CartItem,
  _state: DisneyPromoState,
): boolean {
  return false;
}

export function getDisneyEmptyState(): DisneyPromoState {
  return EMPTY_STATE;
}
