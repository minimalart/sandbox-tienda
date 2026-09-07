import { TenantProvider } from "@lib/site-config/context";
import { tenantForClient } from "@lib/site-config/tenant-for-client";
import {
  getActiveDemoSlug,
  getActiveSitePrefix,
  getActiveTenant,
} from "@lib/site-config/active-tenant";
import { getTenantThemeStyles } from "@lib/site-config/theme/inject-theme";
import { getCanonicalOrigin } from "@lib/util/site-url";
import type { Metadata } from "next";

// `metadataBase` tiene que ser REQUEST-AWARE: es la base de toda URL absoluta que
// Next genera (canonicals, OG). Estático quedaba congelado al valor de build, así
// que todas las tiendas emitían URLs del sitio principal.
export async function generateMetadata(): Promise<Metadata> {
  return { metadataBase: new URL(await getCanonicalOrigin()) };
}

/**
 * Layout del visor de catálogos PDF: pantalla completa, SIN header ni footer.
 * El catálogo es una experiencia inmersiva (flipbook + carrito propio por
 * WhatsApp) y no debe compartir el chrome de la tienda. Solo inyecta el tenant
 * (para el tema/colores) y renderiza los children a pantalla completa.
 */
export default async function CatalogoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [tenant, demoSlug, sitePrefix, themeStyles] = await Promise.all([
    getActiveTenant(),
    getActiveDemoSlug(),
    getActiveSitePrefix(),
    getTenantThemeStyles(),
  ]);

  return (
    <TenantProvider tenant={tenantForClient(tenant)} siteSlug={demoSlug ?? undefined} sitePrefix={sitePrefix}>
      <div style={themeStyles}>{children}</div>
    </TenantProvider>
  );
}
