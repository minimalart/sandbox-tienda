import type { HttpTypes } from "@medusajs/types";

type CartLineItem = NonNullable<HttpTypes.StoreCart["items"]>[number];
type CartPromotion = NonNullable<HttpTypes.StoreCart["promotions"]>[number];

// No minimum by default — set NEXT_PUBLIC_MIN_PURCHASE_AMOUNT per project to enable
const DEFAULT_MIN_PURCHASE_AMOUNT = 0;

const parsedEnvMinPurchase = Number(
  process.env.NEXT_PUBLIC_MIN_PURCHASE_AMOUNT,
);

export const MIN_PURCHASE_AMOUNT =
  Number.isFinite(parsedEnvMinPurchase) && parsedEnvMinPurchase >= 0
    ? parsedEnvMinPurchase
    : DEFAULT_MIN_PURCHASE_AMOUNT;

export type CartCheckoutEligibility = {
  canCheckout: boolean;
  hasMinimumPurchase: boolean;
  hasOutOfStockItems: boolean;
  minimumPurchaseAmount: number;
  minimumPurchaseTotal: number;
  progress: number;
  remaining: number;
};

type GetCartCheckoutEligibilityInput = {
  items: CartLineItem[] | null | undefined;
  hasOutOfStockItems?: boolean;
  minimumPurchaseAmount?: number;
  cartPromotions?: CartPromotion[] | null;
};

// Collect product IDs explicitly listed as `items.product.id` targets across
// the cart's active promotions. Used to identify "free gift" lines so we can
// exclude them from the minimum-purchase threshold.
function collectPromoTargetProductIds(
  promotions: CartPromotion[] | null | undefined,
): Set<string> {
  const ids = new Set<string>();
  for (const promo of promotions ?? []) {
    const targetRules =
      (promo as { application_method?: { target_rules?: unknown } } | null)
        ?.application_method?.target_rules;
    if (!Array.isArray(targetRules)) continue;
    for (const rule of targetRules) {
      const r = rule as {
        attribute?: string | null;
        values?: Array<{ value?: string | null }> | null;
      };
      if (r?.attribute !== "items.product.id") continue;
      for (const val of r.values ?? []) {
        if (val?.value) ids.add(val.value);
      }
    }
  }
  return ids;
}

export function getCartMinimumPurchaseTotal(
  items: CartLineItem[] | null | undefined,
  cartPromotions?: CartPromotion[] | null,
): number {
  // Mínimo de compra se compone por línea, con dos ramas:
  //
  // 1) Items que SON target explícito de alguna promo activa
  //    Usamos `item.total` (post-descuento) — refleja exactamente lo que
  //    paga el cliente por esa línea.
  //    - qty 1 totalmente regalada (Mundial / FREEFIXTURE / Disney): total = 0
  //      → no aporta nada al mínimo
  //    - qty 2 con apply_to_quantity = 1 (ej. Mundial: 1 gratis + 1 paga):
  //      total = precio_de_1_unidad → solo la unidad paga cuenta
  //    - parcialmente descontado a < 100% (ej. 20% off): total = paid amount
  //      → cuenta lo que el cliente efectivamente paga
  //
  // 2) Items que NO son target de ninguna promo activa
  //    Usamos el total pre-descuento CON impuestos (`original_total`). Esto
  //    protege contra el bug del recompute de Medusa: un cupón que excluye
  //    categorías puede poner los ítems excluidos transitoriamente en $0 —
  //    pero esos ítems excluidos NO son target de la promo (justamente la
  //    promo los excluye), así que quedan en esta rama y siguen contando su
  //    monto pre-descuento estable.
  //
  //    `original_total` y NO `subtotal`: con precios tax-inclusive (Argentina)
  //    Medusa deja en `subtotal` el neto SIN IVA, mientras que lo que el
  //    comprador ve —y lo que el propio drawer muestra como subtotal, ver
  //    `cart-drawer/index.tsx`— es `original_total`. Sumar `subtotal` contra un
  //    umbral expresado en precios de góndola comparaba dos bases distintas y
  //    el cartel pedía de más: reportado en QA (DESDEELSUR-33, TC-001) con
  //    $1330 agregados que sólo movieron el faltante $1099 = 1330 / 1,21.
  //
  // Fallback a `unit_price × quantity` cuando los campos pre-calculados no
  // vienen en la respuesta (retrieveCart solo pide `+items.total`).
  const promoTargetIds = collectPromoTargetProductIds(cartPromotions);

  return (items ?? []).reduce((sum, item) => {
    const isPromoTarget =
      Boolean(item.product_id) &&
      promoTargetIds.has(item.product_id as string);

    if (isPromoTarget) {
      return sum + (item.total ?? 0);
    }

    const lineSubtotal =
      item.original_total ??
      item.subtotal ??
      (typeof item.unit_price === "number" && typeof item.quantity === "number"
        ? item.unit_price * item.quantity
        : (item.total ?? 0));
    return sum + lineSubtotal;
  }, 0);
}

export function getCartCheckoutEligibility({
  items,
  hasOutOfStockItems = false,
  minimumPurchaseAmount = MIN_PURCHASE_AMOUNT,
  cartPromotions,
}: GetCartCheckoutEligibilityInput): CartCheckoutEligibility {
  const minimumPurchaseTotal = getCartMinimumPurchaseTotal(
    items,
    cartPromotions,
  );
  const hasMinimumPurchase = minimumPurchaseTotal >= minimumPurchaseAmount;
  const hasItems = (items ?? []).length > 0;

  return {
    // Carrito vacío nunca es checkout-elegible, aunque el mínimo sea 0 y no
    // haya items sin stock. Antes canCheckout salía `true` con carrito vacío
    // (0 >= 0 y sin OOS), habilitando un click que iba a un checkout sin
    // líneas.
    canCheckout: hasItems && hasMinimumPurchase && !hasOutOfStockItems,
    hasMinimumPurchase,
    hasOutOfStockItems,
    minimumPurchaseAmount,
    minimumPurchaseTotal,
    progress:
      minimumPurchaseAmount > 0
        ? Math.min(minimumPurchaseTotal / minimumPurchaseAmount, 1)
        : 1,
    remaining: Math.max(minimumPurchaseAmount - minimumPurchaseTotal, 0),
  };
}
