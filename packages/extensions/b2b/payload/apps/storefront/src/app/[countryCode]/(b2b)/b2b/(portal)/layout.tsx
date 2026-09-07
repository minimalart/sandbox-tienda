import { getMyCompany } from "@lib/data/company";
import { retrieveCustomer } from "@lib/data/customer";
import {
  getActiveSitePrefix,
  getActiveSiteSlug,
  getActiveTenant,
} from "@lib/site-config/active-tenant";
import { withSitePrefix } from "@lib/site-config/site-path";
import AppSidebar from "@modules/b2b/components/portal/app-sidebar";
import B2BGateScreen from "@modules/b2b/components/b2b-gate-screen";
import SiteHeader from "@modules/b2b/components/portal/site-header";
import { PortalThemeProvider } from "@modules/b2b/components/portal/theme";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function B2BLayout({ children }: { children: ReactNode }) {
  const customer = await retrieveCustomer().catch(() => null);

  // Sin sesión → login B2B dedicado. Preservamos el prefijo /demo/{slug} para no
  // perder el contexto del demo (branding + canal) al redirigir al login.
  if (!customer) {
    redirect(withSitePrefix("/b2b/login", await getActiveSitePrefix()));
  }

  const { company } = await getMyCompany();

  // Con sesión pero sin empresa activa → pantalla informativa.
  if (!company || company.status !== "active") {
    return <B2BGateScreen variant={!company ? "no-company" : "inactive"} />;
  }

  const userName =
    [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
    customer.email ||
    undefined;

  // Logo de la tienda del demo (cuando estamos en contexto de demo). En el store
  // principal queda undefined → el sidebar usa el logo de Mercatto. `storeIcon`
  // (favicon cuadrado) se usa en el sidebar colapsado, donde el logo completo no
  // entra.
  const siteSlug = await getActiveSiteSlug();
  const tenantAssets = siteSlug ? (await getActiveTenant()).assets : null;
  const storeLogo = tenantAssets?.logos?.main ?? undefined;
  const storeIcon = tenantAssets?.favicon ?? undefined;

  return (
    <PortalThemeProvider>
      <SidebarProvider>
        <AppSidebar
          userName={userName}
          email={customer.email ?? undefined}
          storeLogo={storeLogo}
          storeIcon={storeIcon}
        />
        <SidebarInset>
          <SiteHeader
            companyName={company.name}
            logoUrl={((company.metadata as Record<string, unknown> | null)?.logo as string) ?? undefined}
          />
          <main className="flex-1 p-4 lg:p-6">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </PortalThemeProvider>
  );
}
