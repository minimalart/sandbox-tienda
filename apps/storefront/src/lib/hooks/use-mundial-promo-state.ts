// Stub — Mundial promo removed from this storefront
import type { MundialPromoState } from "@lib/util/mundial-promo";

const EMPTY_STATE: MundialPromoState = {
  promo: null,
  buyProductIds: [],
  targetProductIds: [],
  minQuantity: 0,
  distinctBuyProductCount: 0,
  unlocked: false,
  hasGift: false,
};

export function useMundialPromoState(
  _promo: unknown,
  _items: unknown,
): MundialPromoState {
  return EMPTY_STATE;
}
