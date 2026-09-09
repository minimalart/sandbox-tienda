import type { TenantConfig } from "./types";

/** Missing or disabled store config never inherits another store's wholesale channel. */
export function enabledStoreB2B(tenant: TenantConfig | null | undefined) {
  const b2b = tenant?.medusa.b2b;
  return b2b?.enabled && b2b.salesChannelId
    ? { salesChannelId: b2b.salesChannelId, tiers: b2b.tiers }
    : undefined;
}
