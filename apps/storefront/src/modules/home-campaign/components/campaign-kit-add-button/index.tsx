"use client";

import { useCartQuantityForVariant } from "@lib/hooks/use-cart-quantity-for-variant";
import type { TypesenseProductDocument } from "@lib/typesense";

/**
 * Botón "Agregar" de la card del grid del template Campaña.
 *
 * A diferencia del `TypesenseProductCard` genérico (que dibuja un stepper
 * completo con +/-/trash cuando el producto ya está en el carrito), acá el
 * click SIEMPRE incrementa: la landing institucional es lineal (hero → grid →
 * checkout) y el operador quiere que cada click sume una unidad sin ambigüedad.
 *
 * Se muestra la cantidad en carrito arriba a la izquierda solo como feedback
 * pasivo — si el user quiere modificar cantidad va al carrito. Mantiene la
 * UX simple del v0 y evita el modo "quick-add-variant-sheet" para productos
 * multi-variante (el catálogo del template asume variante única por producto).
 *
 * `openCartOnAdd` deja abierto el drawer del carrito para que el operador vea
 * el resultado sin salir de la landing — cerraría el circuito de conversión
 * de la campaña.
 */
export function CampaignKitAddButton({
  product,
  countryCode,
  label,
}: {
  product: TypesenseProductDocument;
  countryCode: string;
  label: string;
}) {
  const {
    quantity,
    handleIncrement,
    isLoading,
    canIncrement,
    buttonRef,
    variantId,
  } = useCartQuantityForVariant(product, countryCode, { openCartOnAdd: true });

  const disabled = !variantId || (!canIncrement && quantity > 0) || isLoading;

  return (
    <div ref={buttonRef} className="flex items-center gap-2">
      {quantity > 0 ? (
        <span className="text-xs text-neutral-500">{quantity} en carrito</span>
      ) : null}
      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled}
        aria-label={
          quantity > 0 ? `Agregar otro ${product.title}` : `Agregar ${product.title} al carrito`
        }
        className="inline-flex items-center rounded-full bg-[color:var(--campaign-bg,#0f1114)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isLoading ? "…" : label}
      </button>
    </div>
  );
}

export default CampaignKitAddButton;
