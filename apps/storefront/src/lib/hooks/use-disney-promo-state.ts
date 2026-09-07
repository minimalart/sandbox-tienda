// Stub — Disney promo removed from this storefront
import type { DisneyPromoState } from "@lib/util/disney-promo";

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

export function useDisneyPromoState(
  _promo: unknown,
  _items: unknown,
): DisneyPromoState {
  return EMPTY_STATE;
}
