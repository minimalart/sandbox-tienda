import { requireB2BStore } from "@lib/site-config/require-b2b-store";
import { ChannelProvider } from "@lib/context/channel-context";
import { retrieveCart } from "@lib/data/cart";
import { TenantProvider } from "@lib/site-config/context";
import { tenantForClient } from "@lib/site-config/tenant-for-client";
import {
  getActiveDemoSlug,
  getActiveSitePrefix,
  getActiveTenant,
} from "@lib/site-config/active-tenant";
import { getB2BPortalDarkThemeStyles, getB2BPortalThemeStyles } from "@lib/site-config/theme/inject-theme";
import { StoreProvider } from "@lib/stores/store-provider";
import { Toaster } from "@medusajs/ui";
import type { Metadata } from "next";

export const metadata: Metadata = { title: { default: "Portal Mayorista", template: "%s | Portal Mayorista" } };

/**
 * Shell del portal B2B (mayorista). Es una sección totalmente separada del
 * storefront B2C: NO incluye el header/nav/footer/bottom-nav del e-commerce.
 * Solo aporta los providers necesarios (tenant + cart) y un header propio con
 * el logo. El gate de acceso vive en `(b2b)/b2b/(portal)/layout.tsx`.
 */
export default async function B2BSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireB2BStore();
  const [tenant, themeStyles, darkThemeStyles, cart, demoSlug, sitePrefix] = await Promise.all([
    getActiveTenant(),
    getB2BPortalThemeStyles(),
    getB2BPortalDarkThemeStyles(),
    retrieveCart(),
    getActiveDemoSlug(),
    getActiveSitePrefix(),
  ]);

  // Además del `style` en el div (que scopea las vars al subárbol del portal),
  // las inyectamos en `:root`. Los componentes que se montan en un portal de
  // Radix (Sheet/Dialog/Dropdown) renderizan en `document.body`, FUERA de ese
  // div, y sin esto heredaban el `--primary` verde por defecto de globals.css.
  // Este layout solo envuelve rutas B2B, así que pisar `:root` por request no
  // afecta al B2C.
  const rootThemeCss = `:root{${Object.entries(themeStyles)
    .map(([k, v]) => `${k}:${v}`)
    .join(";")}}`;

  // Modo oscuro: la clase `.dark` de globals.css pisa las vars de marca con el
  // verde por defecto sobre su propio subárbol. Inyectamos los valores derivados
  // del demo en un `.dark{}` (después de globals.css → gana por orden a igual
  // especificidad) para que el color del demo también valga en oscuro.
  const darkThemeCss = Object.keys(darkThemeStyles).length
    ? `.dark{${Object.entries(darkThemeStyles)
        .map(([k, v]) => `${k}:${v}`)
        .join(";")}}`
    : "";

  return (
    <TenantProvider tenant={tenantForClient(tenant)} siteSlug={demoSlug ?? undefined} sitePrefix={sitePrefix}>
      {/* ChannelProvider expone el canal/grupo del tenant a los componentes
          cliente del portal (p. ej. el perfil reutiliza ChangePasswordCard del
          B2C, que llama useChannel()). Sin él, esas vistas crashean. */}
      <ChannelProvider
        customerGroupId={tenant.medusa.customerGroupId || process.env.NEXT_PUBLIC_CUSTOMER_GROUP_ID}
        salesChannelId={tenant.medusa.salesChannelId || process.env.NEXT_PUBLIC_SALES_CHANNEL_ID}
      >
        <StoreProvider cart={cart}>
          <style dangerouslySetInnerHTML={{ __html: rootThemeCss + darkThemeCss }} />
          <div className="min-h-screen bg-background" style={themeStyles}>
            {children}
            <Toaster />
          </div>
        </StoreProvider>
      </ChannelProvider>
    </TenantProvider>
  );
}
