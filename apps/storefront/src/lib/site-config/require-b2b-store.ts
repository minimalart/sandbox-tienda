import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getActiveDemoB2B, getActiveSitePrefix } from "./active-tenant";
import { withSitePrefix } from "./site-path";

/** Validate the requested store before rendering any wholesale screen. */
export const requireB2BStore = cache(async () => {
  const b2b = await getActiveDemoB2B();
  if (!b2b) redirect(withSitePrefix("/", await getActiveSitePrefix()));
  return b2b;
});
