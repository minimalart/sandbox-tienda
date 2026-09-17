"use client";

import { useRouter } from "next/navigation";
import type { HttpTypes } from "@medusajs/types";
import { removeBundleInstance } from "../actions/remove-bundle-instance";
import type { BundlePresentation } from "../lib/cart-presentation";
import { BundleSummaryRow } from "./bundle-summary-row";

interface BundleCartGroupProps {
  bundle: BundlePresentation;
  cart: HttpTypes.StoreCart | undefined;
}

/**
 * El kit en el carrito completo: exactamente la misma fila que en el
 * minicarrito, sin desplegable propio. El detalle de los doce productos vive en
 * el wizard, que es donde además se pueden cambiar — repetirlo acá agrega una
 * lista larga que no lleva a ninguna acción.
 *
 * El carrito sigue guardando line items estándar de Medusa: esto es una capa de
 * presentación sobre `buildCartPresentation`, no un modelo nuevo.
 */
export const BundleCartGroup = ({ bundle, cart }: BundleCartGroupProps) => {
  const router = useRouter();
  const currency = cart?.currency_code ?? "ars";

  const handleRemove = async () => {
    await removeBundleInstance(bundle.items.map((i) => i.id));
    router.refresh();
  };

  return (
    <BundleSummaryRow bundle={bundle} currencyCode={currency} onRemove={handleRemove} />
  );
};
