import { getMyCompany } from "@lib/data/company";
import {
  getActiveSitePrefix,
  getActiveSiteSlug,
  getActiveTenant,
} from "@lib/site-config/active-tenant";
import { withSitePrefix } from "@lib/site-config/site-path";
import B2BLogin from "@modules/b2b/components/b2b-login";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Ingreso" };

export default async function B2BLoginPage() {
  const siteSlug = await getActiveSiteSlug();

  // Si la cuenta ya es de una empresa mayorista, directo al portal (preservando
  // el prefijo del demo para no perder branding/canal).
  const { company } = await getMyCompany();
  if (company) {
    redirect(withSitePrefix("/b2b", await getActiveSitePrefix()));
  }

  const storeLogo = siteSlug
    ? ((await getActiveTenant()).assets?.logos?.main ?? undefined)
    : undefined;

  return <B2BLogin storeLogo={storeLogo} />;
}
