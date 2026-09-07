// Stub — Mundial promo removed from this storefront
import type { HttpTypes } from "@medusajs/types";

type AdminPromotion = HttpTypes.StorePromotion | null;
type CartItem = NonNullable<HttpTypes.StoreCart["items"]>[number];

export const MUNDIAL_PROMO_CODE = "Mundial";

export type MundialPromoState = {
  promo: AdminPromotion | null;
  buyProductIds: string[];
  targetProductIds: string[];
  minQuantity: number;
  distinctBuyProductCount: number;
  unlocked: boolean;
  hasGift: boolean;
};

export function shouldSuppressMundialTargetDiscount(
  _item: CartItem,
  _state: MundialPromoState,
): boolean {
  return false;
}
