"use server";

import { deleteLineItem } from "@lib/data/cart";

/**
 * Delete every line item that shares a `bundle_instance_id`. Runs the
 * deletions in parallel; each `deleteLineItem` already invalidates the
 * `carts` cache tag on success so no extra revalidation is needed here.
 *
 * Errors from individual `deleteLineItem` calls are swallowed on purpose:
 * a partial failure leaves the surviving line items in the cart — strictly
 * better than aborting halfway with an inconsistent state that the customer
 * has to clean up manually.
 */
export async function removeBundleInstance(lineItemIds: string[]): Promise<void> {
  await Promise.allSettled(lineItemIds.map((id) => deleteLineItem(id)));
}
