import type { HttpTypes } from "@medusajs/types";
import { getIndividualVariant } from "./get-individual-variant";

export function isProductInStock(product: HttpTypes.StoreProduct): boolean {
  // REGLA B2C: el stock se mide sobre la variante Individual, no sobre el bulto.
  const variant = getIndividualVariant(product.variants);
  if (!variant) return false;
  if (variant.manage_inventory === false) return true;
  if (variant.allow_backorder) return true;
  return (variant.inventory_quantity ?? 0) > 0;
}
