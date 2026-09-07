import { cache } from "react";
import { getDefaultTenant } from "./index";
import type { TenantConfig } from "./types";

/**
 * Returns the single-tenant site config.
 * Cached via React cache() for deduplication within a request.
 */
export const getTenant = cache(async (): Promise<TenantConfig> => {
  return getDefaultTenant();
});
