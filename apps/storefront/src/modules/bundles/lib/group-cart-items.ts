import type { HttpTypes } from "@medusajs/types";

export interface BundleGroupData {
  bundle_id: string;
  bundle_handle: string | null;
  bundle_instance_id: string;
  bundle_title: string | null;
  items: HttpTypes.StoreCartLineItem[];
}

export type CartRow =
  | { kind: "single"; item: HttpTypes.StoreCartLineItem }
  | { kind: "bundle"; group: BundleGroupData };

/**
 * Bucket cart line items by `metadata.bundle_instance_id`. Items without
 * that metadata are returned as `single` rows preserving their original
 * order. Bundle groups are positioned where the OLDEST item of the group
 * would sit, so a bundle added earlier stays visually above one added
 * later even after the customer reorders regular line items.
 */
export const groupCartItemsByBundle = (
  items: readonly HttpTypes.StoreCartLineItem[] | undefined | null,
): CartRow[] => {
  if (!items?.length) return [];
  const buckets = new Map<string, BundleGroupData>();
  const rows: CartRow[] = [];

  for (const item of items) {
    const meta = (item.metadata ?? {}) as Record<string, unknown>;
    const instanceId = typeof meta.bundle_instance_id === "string" ? meta.bundle_instance_id : null;
    if (!instanceId) {
      rows.push({ kind: "single", item });
      continue;
    }
    const bundleId = typeof meta.bundle_id === "string" ? meta.bundle_id : "";
    const bundleHandle = typeof meta.bundle_handle === "string" ? meta.bundle_handle : null;
    const title = typeof meta.bundle_title === "string" ? meta.bundle_title : null;

    let group = buckets.get(instanceId);
    if (!group) {
      group = {
        bundle_id: bundleId,
        bundle_handle: bundleHandle,
        bundle_instance_id: instanceId,
        bundle_title: title,
        items: [],
      };
      buckets.set(instanceId, group);
      rows.push({ kind: "bundle", group });
    }
    group.items.push(item);
  }

  // Stable ordering inside each group: by created_at asc so the customer sees
  // the same order the wizard walked them through.
  buckets.forEach((group) => {
    group.items.sort(
      (a: HttpTypes.StoreCartLineItem, b: HttpTypes.StoreCartLineItem) =>
        (a.created_at ?? "") > (b.created_at ?? "") ? 1 : -1,
    );
  });
  return rows;
};
