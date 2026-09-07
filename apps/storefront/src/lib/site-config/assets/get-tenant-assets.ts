import { cache } from "react";
import { getActiveTenant } from "../active-tenant";

export const getTenantLogo = cache(
  async (type: "main" | "footer" | "mobile"): Promise<string> => {
    const tenant = await getActiveTenant();
    const logos = tenant.assets.logos;
    if (type === "footer") return logos.footer || logos.main;
    if (type === "mobile") return logos.mobile || logos.main;
    return logos.main;
  }
);

export const getTenantFavicon = cache(async (): Promise<string> => {
  const tenant = await getActiveTenant();
  return tenant.assets.favicon || "/favicon.ico";
});

export const getTenantBanners = cache(async (): Promise<string[]> => {
  const tenant = await getActiveTenant();
  return tenant.assets.banners?.hero || [];
});
