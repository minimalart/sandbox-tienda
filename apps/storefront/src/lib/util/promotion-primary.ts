// Selección de la promoción "primaria" de un producto: la única que se aplicaría
// al agregarlo al carrito y que, por ende, define el precio mostrado.
//
// Regla (consistente con el dedup de datos del backend): entre las promos
// automáticas que bajan el precio unitario (percentage / fixed) gana la de mayor
// descuento; si no hay ninguna, cae al buyget (2x1, que es solo badge y no baja
// el precio unitario). Las promos de código (is_automatic === false) se aplican
// recién en el checkout, así que no cuentan para el badge del card.
//
// Tras el dedup cada producto tiene una sola promo, así que normalmente esto
// devuelve esa única — el ranking es la red de seguridad para no mostrar nunca
// más de un badge y que el que se muestre sea el que aplica.

export type RankablePromotion = {
  type?: string | null;
  is_automatic?: boolean | null;
  code?: string | null;
  campaign?: { name?: string | null } | null;
  application_method?: {
    type?: string | null;
    value?: number | number[] | null;
  } | null;
};

/**
 * Descuento (en unidades de precio) que una promo percentage/fixed aplica sobre
 * el precio unitario de referencia. Buyget devuelve 0 (no baja el precio unitario).
 */
function unitDiscount(promotion: RankablePromotion, basePrice: number): number {
  const am = promotion.application_method;
  if (!am || promotion.type === "buyget") return 0;
  const rawValue = Array.isArray(am.value) ? am.value[0] : am.value;
  if (typeof rawValue !== "number") return 0;
  if (am.type === "percentage") return (basePrice * rawValue) / 100;
  if (am.type === "fixed") return Math.min(rawValue, basePrice || rawValue);
  return 0;
}

/**
 * De una lista de promos activas devuelve UNA: la que se aplicaría al carrito.
 * `basePrice` es el precio unitario de referencia para rankear (original o
 * calculado). Devuelve `null` si no hay ninguna promo automática.
 */
export function selectPrimaryPromotion<T extends RankablePromotion>(
  activePromotions: T[],
  basePrice: number,
): T | null {
  const automatic = activePromotions.filter((p) => p.is_automatic !== false);

  const priceAffecting = automatic
    .filter(
      (p) =>
        p.type !== "buyget" &&
        (p.application_method?.type === "percentage" ||
          p.application_method?.type === "fixed"),
    )
    .slice()
    .sort((a, b) => unitDiscount(b, basePrice) - unitDiscount(a, basePrice));

  if (priceAffecting[0]) return priceAffecting[0];
  return automatic.find((p) => p.type === "buyget") ?? null;
}

/** Nombre para el badge de una promo: nombre de campaña o, en su defecto, el código. */
export function promotionBadgeName(
  promotion: RankablePromotion | null | undefined,
): string | null {
  if (!promotion) return null;
  return promotion.campaign?.name || promotion.code || null;
}
