import type { HttpTypes } from "@medusajs/types"

/**
 * Umbral REAL de envío gratis, derivado de las shipping options del carrito.
 *
 * Extraído de `computeTarget` (que vivía dentro de
 * `modules/shipping/components/free-shipping-price-nudge`) para poder reusarlo y, sobre
 * todo, para poder testearlo. Es la única fuente de verdad del umbral: el PRD §17
 * prohíbe mostrar un valor promocional que no coincida con las condiciones reales de
 * envío, así que el `threshold` configurable del backoffice es informativo y NUNCA pisa
 * lo que se calcula acá.
 *
 * Bugs de la versión original que se corrigen (todos estaban en producción):
 *
 *  - `gte` usaba `current > target` tanto para saber si se alcanzó como para el
 *    faltante, o sea que en el umbral exacto seguía diciendo "te faltan $0".
 *  - `gt` sumaba 1 unidad mínima al faltante sin explicar por qué.
 *  - las ramas `lt`/`lte` devolvían `target_remaining: 0` cuando el objetivo NO se
 *    había alcanzado: invertido.
 *  - `remaining_percentage` no estaba clampeado y se pasaba directo a `style.width`,
 *    así que con el carrito por encima del umbral la barra se desbordaba del riel.
 *  - el `.find(...)!` era un non-null assertion que sólo funcionaba porque el llamador
 *    pre-filtraba; cualquier reuso lo rompía.
 */

export type FreeShippingTarget = {
  shipping_option_id: string
  /** Monto a partir del cual el envío es gratis. */
  target_amount: number
  /** Subtotal considerado (`item_total` del carrito). */
  current_amount: number
  /** Cuánto falta. Nunca negativo. */
  remaining: number
  /** Progreso normalizado 0..1, clampeado. */
  progress: number
  reached: boolean
}

type PriceRule = { attribute?: string | null; operator?: string | null; value?: string | null }

const ITEM_TOTAL = "item_total"

/**
 * Evalúa una regla de precio contra el subtotal del carrito.
 *
 * Sólo se soportan `gt`/`gte`, que son las que expresan "envío gratis a partir de X".
 * `lt`/`lte`/`eq` devuelven `null` a propósito: "envío gratis cuando el total está POR
 * DEBAJO de X" no es una barra de progreso, y la versión original producía un faltante
 * invertido y una barra sin sentido. Devolver `null` hace que simplemente no se muestre,
 * que es lo honesto.
 */
function evaluateRule(
  rule: PriceRule,
  currentAmount: number
): Pick<FreeShippingTarget, "target_amount" | "current_amount" | "remaining" | "progress" | "reached"> | null {
  const targetAmount = Number.parseFloat(String(rule.value ?? ""))
  if (!Number.isFinite(targetAmount) || targetAmount <= 0) return null

  const operator = (rule.operator ?? "").toLowerCase()
  let reached: boolean
  if (operator === "gte") {
    reached = currentAmount >= targetAmount
  } else if (operator === "gt") {
    reached = currentAmount > targetAmount
  } else {
    return null
  }

  return {
    target_amount: targetAmount,
    current_amount: currentAmount,
    remaining: reached ? 0 : Math.max(0, targetAmount - currentAmount),
    // Clampeado: sin esto, un carrito por encima del umbral desborda el riel.
    progress: Math.min(1, Math.max(0, currentAmount / targetAmount)),
    reached,
  }
}

/**
 * Busca entre las shipping options del carrito una que sea GRATIS a partir de cierto
 * `item_total`, y devuelve el estado del progreso hacia ese umbral.
 *
 * Devuelve `null` cuando no existe tal condición para la moneda del carrito — que es lo
 * que hace que la barra y los bridge products no se muestren en tiendas sin envío gratis
 * en lugar de inventar un umbral.
 */
export function deriveFreeShippingTarget(
  cart: HttpTypes.StoreCart | null | undefined,
  shippingOptions: HttpTypes.StoreCartShippingOption[] | null | undefined
): FreeShippingTarget | null {
  if (!cart || !shippingOptions?.length) return null

  const currentAmount = cart.item_total ?? 0

  for (const option of shippingOptions) {
    for (const price of option.prices ?? []) {
      // Sólo precios en la moneda del carrito y sólo el que vale 0 (envío gratis).
      if (price.currency_code !== cart.currency_code) continue
      if (price.amount !== 0) continue

      const rule = (price.price_rules ?? []).find(
        (candidate) => candidate.attribute === ITEM_TOTAL
      )
      if (!rule) continue

      const evaluated = evaluateRule(rule as PriceRule, currentAmount)
      if (evaluated) {
        return { shipping_option_id: option.id, ...evaluated }
      }
    }
  }

  return null
}
