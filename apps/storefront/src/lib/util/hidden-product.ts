// Medusa stores boolean metadata as `true`, but Typesense indexes it as the
// string `"true"`. Accept both so this helper works against either source.
export function isHiddenFromStore(
  product: { metadata?: Record<string, unknown> | null } | null | undefined,
): boolean {
  const value = product?.metadata?.hidden_from_store;
  return value === true || value === "true";
}

type HiddenAdjustableCart = {
  items?: Array<{
    product_id?: string | null;
    subtotal?: number | null;
    original_total?: number | null;
    total?: number | null;
    variant?: {
      product?: { metadata?: Record<string, unknown> | null } | null;
    } | null;
    product?: { metadata?: Record<string, unknown> | null } | null;
  } | null> | null;
  subtotal?: number | null;
  discount_total?: number | null;
};

/**
 * Subtracts the contribution of hidden-from-store products (typically gifts
 * auto-added by promos like FREEFIXTURE) from the cart's displayed `subtotal`
 * and `discount_total`. Total stays untouched: the delta cancels out because
 * hidden gifts are always at total = 0 (subtotal_delta = discount_delta).
 *
 * Why we don't mutate `total`: the user pays exactly the same amount; we just
 * don't want the summary to surface the gift's catalog price as a "subtotal
 * inflado" with a matching "descuento promocional" — those two cancel out
 * visually and noisily.
 */
export function getHiddenProductAdjustedCartTotals<
  TCart extends HiddenAdjustableCart,
>(cart: TCart | null | undefined): TCart | null | undefined {
  if (!cart?.items?.length) return cart;

  let hiddenSubtotalDelta = 0;
  let hiddenDiscountDelta = 0;

  for (const item of cart.items) {
    if (!item) continue;
    const product = item.product ?? item.variant?.product ?? null;
    if (!isHiddenFromStore(product)) continue;
    const lineSubtotal = item.subtotal ?? item.original_total ?? 0;
    const lineTotal = item.total ?? 0;
    hiddenSubtotalDelta += lineSubtotal;
    hiddenDiscountDelta += Math.max(0, lineSubtotal - lineTotal);
  }

  if (hiddenSubtotalDelta === 0 && hiddenDiscountDelta === 0) return cart;

  return {
    ...cart,
    subtotal: (cart.subtotal ?? 0) - hiddenSubtotalDelta,
    discount_total: Math.max(
      0,
      (cart.discount_total ?? 0) - hiddenDiscountDelta,
    ),
  };
}
