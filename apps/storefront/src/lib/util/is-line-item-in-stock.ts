import type { HttpTypes } from "@medusajs/types";

/**
 * Checks if a cart line item's variant has enough stock to fulfil the
 * quantity in the cart.
 *
 * When enriched inventory_quantity is available (number), it is the source
 * of truth:
 *   - inventory_quantity === 0  → out of stock
 *   - inventory_quantity < item.quantity → insufficient stock (treat as OOS)
 *
 * When inventory_quantity is undefined (Product API didn't return it, e.g.
 * manage_inventory is false / inventory not tracked), fall back to the
 * manage_inventory / allow_backorder flags.
 */
export function isLineItemInStock(item: HttpTypes.StoreCartLineItem): boolean {
  const variant = item.variant;
  if (!variant) return true;

  // Variant flags take precedence over raw quantity
  if (variant.manage_inventory === false) return true;
  if (variant.allow_backorder) return true;

  // Enriched inventory data
  if (typeof variant.inventory_quantity === "number") {
    return variant.inventory_quantity >= item.quantity;
  }

  // No enriched data available — assume in stock
  return true;
}

