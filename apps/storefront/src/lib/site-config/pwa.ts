import "server-only";
import { getActiveSitePrefix, getActiveTenant } from "./active-tenant";
import { defaultConfig } from "./default";
import { buildPwaBrand, type PwaBrand } from "./pwa-brand";
import type { TenantConfig } from "./types";

export type { PwaBrand };

/**
 * Datos de marca del sitio activo para los manifests de PWA.
 *
 * Es el mismo tenant que resuelve `generateMetadata()` del layout raíz, y por el
 * mismo motivo: el manifest de una tienda tiene que decir el nombre y el ícono de ESA
 * tienda. Los dos manifests (el del storefront y el del repartidor) lo comparten para
 * que no vuelvan a divergir.
 *
 * Leer el tenant vuelve DINÁMICA la ruta que llame a esto, que es lo que corresponde:
 * un manifest cacheado a nivel CDN se serviría en todos los hosts (ver la nota de
 * cache keys en `proxy.ts`).
 */
export async function getPwaBrand(): Promise<PwaBrand> {
  let tenant: TenantConfig = defaultConfig;
  let prefix = "";
  try {
    [tenant, prefix] = await Promise.all([getActiveTenant(), getActiveSitePrefix()]);
  } catch {
    // Fuera de scope de request / sin tenant: la marca del boilerplate.
  }

  return buildPwaBrand(tenant, prefix);
}
