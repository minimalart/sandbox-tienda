"use server";

import { sdk } from "@lib/config";
import { revalidateTag } from "next/cache";
import type { BranchResolution } from "./branch-types";
import {
  getBranchId,
  getCacheTag,
  getSalesChannelIdCookie,
  removeBranchId,
  removeSalesChannelIdCookie,
  setBranchId,
  setSalesChannelIdCookie,
} from "./cookies";

/**
 * Resolves which branch (and B2C sales channel) covers a lat/lng, via the
 * backend polygon engine. Pure lookup — does not persist anything.
 */
export async function resolveBranchByPoint(
  lat: number | string,
  lng: number | string,
): Promise<BranchResolution> {
  try {
    return await sdk.client.fetch<BranchResolution>(
      "/store/store-locations/resolve",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: { lat, lng },
      },
    );
  } catch (error) {
    console.error("[branch] resolveByPoint failed:", error);
    return { covered: false, branch: null, sales_channel_id: null };
  }
}

/**
 * Persists the resolved branch + sales channel in cookies so the whole server
 * data layer (products, cart, PDPs) switches to that channel. Drops the cached
 * catalog/cart so the new channel's data is fetched fresh.
 */
export async function setBranch(input: {
  branchId: string;
  salesChannelId: string;
}): Promise<void> {
  await setBranchId(input.branchId);
  await setSalesChannelIdCookie(input.salesChannelId);

  // The cart keeps its id (cookie) but getOrSetCart re-associates its
  // sales_channel_id on the next call; drop cached catalog + cart so the UI
  // reflects the new channel immediately.
  const productsTag = await getCacheTag("products");
  const cartsTag = await getCacheTag("carts");
  if (productsTag) revalidateTag(productsTag, "max");
  if (cartsTag) revalidateTag(cartsTag, "max");
}

/** Resolve a lat/lng and persist the result in one step. Returns the resolution. */
export async function resolveAndSetBranch(
  lat: number | string,
  lng: number | string,
): Promise<BranchResolution> {
  const result = await resolveBranchByPoint(lat, lng);
  if (result.covered && result.branch && result.sales_channel_id) {
    await setBranch({
      branchId: result.branch.id,
      salesChannelId: result.sales_channel_id,
    });
  }
  return result;
}

/** Clears the active branch (back to the default channel). */
export async function clearBranch(): Promise<void> {
  await removeBranchId();
  await removeSalesChannelIdCookie();
  const productsTag = await getCacheTag("products");
  const cartsTag = await getCacheTag("carts");
  if (productsTag) revalidateTag(productsTag, "max");
  if (cartsTag) revalidateTag(cartsTag, "max");
}

/** The currently selected branch id (cookie), if any. */
export async function getActiveBranch(): Promise<{
  branchId?: string;
  salesChannelId?: string;
}> {
  return {
    branchId: await getBranchId(),
    salesChannelId: await getSalesChannelIdCookie(),
  };
}
