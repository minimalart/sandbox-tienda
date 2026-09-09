import { getActiveTenant, getActiveSitePrefix } from "@lib/site-config/active-tenant";
import { withSitePrefix } from "@lib/site-config/site-path";
import { requireB2BStore } from "@lib/site-config/require-b2b-store";
import { getMyCompany } from "@lib/data/company";
import { MercattoLogo, MinimalartAttribution } from "@modules/b2b/components/b2b-brand";
import CompanyRegisterForm from "@modules/b2b/components/register-form";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Registrar empresa | Portal Mayorista" };

export default async function B2BRegisterPage() {
  await requireB2BStore();
  const tenant = await getActiveTenant();
  // Si ya tiene empresa mayorista, lo mandamos al portal.
  const { company } = await getMyCompany();
  if (company) {
    redirect(withSitePrefix("/b2b", await getActiveSitePrefix()));
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {tenant.assets?.logos?.main ? <img src={tenant.assets.logos.main} alt={tenant.metadata?.name ?? "Tienda"} className="mx-auto mb-6 h-9 w-auto object-contain" /> : <MercattoLogo className="mx-auto mb-6 h-9 w-auto" />}
      <CompanyRegisterForm />
      <MinimalartAttribution className="mt-10" />
    </div>
  );
}
