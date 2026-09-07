// Stub — Freefixture promo removed from this storefront
import type { FreefixturePromoState } from "@lib/util/freefixture-promo";

const EMPTY_STATE: FreefixturePromoState = {
  promo: null,
  targetProductIds: [],
  unlocked: false,
  hasGift: false,
};

export function useFreefixturePromoState(
  _promo: unknown,
  _items: unknown,
): FreefixturePromoState {
  return EMPTY_STATE;
}
