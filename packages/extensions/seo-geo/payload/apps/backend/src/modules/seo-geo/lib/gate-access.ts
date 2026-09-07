import type { MedusaContainer } from '@medusajs/framework/types';
import { buildGateToken, resolveGatePassword } from '../../store-config/site-gate';
import { gateScopeForUrl, SITE_GATE_COOKIE } from './gate-scope';

export { gateScopeForUrl, SITE_GATE_COOKIE } from './gate-scope';

/**
 * Paso del crawler por la página de contraseña (site gate).
 *
 * Una tienda que todavía no abrió al público es EXACTAMENTE cuando hay que
 * auditarla —antes de abrirla, no después—, y hasta ahora el gate la dejaba sin
 * SEO justo en ese momento: el crawler recibía la pantalla de acceso, se quedaba
 * sin enlaces que seguir y la auditoría terminaba en una página.
 *
 * El backend puede entrar sin saber nada nuevo: el token del gate es un HMAC
 * determinístico de `${scope}:${password}` (`store-config/site-gate.ts`), las dos
 * cosas viven en la base, y es el mismo valor que el storefront revalida cuando lo
 * recibe en la cookie. O sea que el crawler pasa por la puerta de siempre, no por
 * una de servicio: si la palabra cambia, el token que firmemos deja de servir y la
 * auditoría vuelve a reportar `site-gated` en vez de mentir.
 *
 * La contraseña NUNCA sale de acá: lo que viaja al crawl es el token ya firmado, y
 * no se persiste en la config congelada de la auditoría (que se muestra entera en
 * el admin y se re-usa al volver a correrla).
 */

/**
 * Cookie lista para mandar en el crawl, o `null` si el sitio no tiene gate activo
 * (o si el módulo que guarda la palabra no está instalado).
 *
 * Nunca tira: quedarse sin cookie degrada a lo de antes —la auditoría reporta
 * `site-gated`—, mientras que tirar acá perdería también la mitad de catálogo y
 * GEO, que no depende del crawl.
 */
export async function resolveGateCookie(
  container: MedusaContainer,
  baseUrl: string
): Promise<string | null> {
  try {
    const scope = gateScopeForUrl(baseUrl);
    const password = await resolveGatePassword(container, scope);
    if (!password) return null;
    return `${SITE_GATE_COOKIE}=${buildGateToken(scope, password)}`;
  } catch {
    return null;
  }
}
