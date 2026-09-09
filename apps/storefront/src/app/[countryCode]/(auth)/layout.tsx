import { TenantProvider } from "@lib/site-config/context";
import { tenantForClient } from "@lib/site-config/tenant-for-client";
import {
  getActiveSitePrefix,
  getActiveSiteSlug,
  getActiveTenant,
} from "@lib/site-config/active-tenant";

/**
 * Route group de las pantallas de autenticación que viven FUERA del chrome del
 * sitio: el callback de Google y el reseteo de contraseña. Son overlays a
 * pantalla completa (`fixed inset-0`), así que no heredan header ni footer —
 * por eso estaban sueltas bajo `[countryCode]/` en vez de dentro de `(main)`.
 *
 * El problema de estar sueltas: `TenantProvider` sólo lo montan los route
 * groups, y `useTenant()` NO falla cuando falta —
 * `if (context === null) return getDefaultTenant()`. `getDefaultTenant()`
 * devuelve el `defaultConfig` ESTÁTICO del código, sin el overlay que
 * `mergeMainTenant` arma con la fila del sitio, así que estas pantallas
 * mostraban el branding del boilerplate (el logo verde de Mercatto) en TODA
 * instalación, sin un solo error ni warning. En desdeelsur se veía el logo de
 * Mercatto al pedir/restablecer la contraseña y en el splash de "Iniciando
 * sesión…" de Google.
 *
 * Este layout existe SOLO para montar el provider: no dibuja chrome. También
 * pasa slug y prefijo, así los links internos (`useSiteHref`/`useDemoHref`, que
 * google-callback usa) no sacan al usuario del sitio activo.
 */
export const dynamic = "force-dynamic";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [tenant, siteSlug, sitePrefix] = await Promise.all([
    getActiveTenant(),
    getActiveSiteSlug(),
    getActiveSitePrefix(),
  ]);

  return (
    <TenantProvider
      tenant={tenantForClient(tenant)}
      siteSlug={siteSlug ?? undefined}
      sitePrefix={sitePrefix}
    >
      {children}
    </TenantProvider>
  );
}
