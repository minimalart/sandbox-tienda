// Stub — Freefixture promo removed from this storefront
import type { HttpTypes } from "@medusajs/types";

type AdminPromotion = HttpTypes.StorePromotion | null;
type CartItem = NonNullable<HttpTypes.StoreCart["items"]>[number];

export const FREEFIXTURE_PROMO_CODE = "FREEFIXTURE";
export const FREEFIXTURE_BADGE_LABEL = "PROMO FIXTURE";

export type FreefixturePromoState = {
  promo: AdminPromotion | null;
  targetProductIds: string[];
  unlocked: boolean;
  hasGift: boolean;
};

export function shouldSuppressFreefixtureTargetDiscount(
  _item: CartItem,
  _state: FreefixturePromoState,
): boolean {
  return false;
}
