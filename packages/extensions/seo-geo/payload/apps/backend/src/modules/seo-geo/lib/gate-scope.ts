import { pathSegments } from '../crawler/url-utils';

/**
 * La mitad PURA del paso por el site gate: qué scope firma cada URL.
 *
 * Vive aparte de `gate-access.ts` por lo mismo que `open-graph.ts` vive aparte de
 * `config.ts`: ese archivo resuelve la contraseña por el contenedor y arrastra
 * store-config —y con él medio framework—, así que ahí adentro esta derivación no
 * se podría testear. Y es justo la que hay que testear: el scope es entrada del
 * HMAC.
 */

/** La cookie que lee el layout del storefront. Ver `lib/site-config/site-gate.ts`. */
export const SITE_GATE_COOKIE = '_site_gate';

/**
 * Scope del gate para la URL auditada: `site:<slug>` para una tienda secundaria,
 * `store` para la principal.
 *
 * Tiene que dar IDÉNTICO a lo que calcula el storefront —`getSiteGateState()` hace
 * `slug ? \`site:${slug}\` : 'store'`—, porque el scope se hashea junto con la
 * palabra (`buildGateToken`). Un scope distinto no falla ruidosamente: firma un
 * token que no valida, y el crawl se queda afuera del gate sin señal de por qué.
 *
 * Se deriva del path con la misma convención `/tienda/<slug>` que ya repiten
 * `resolveSiteStorefrontUrl` y `store-config/site-gate.ts`, y se repite por el
 * mismo motivo que ahí está escrito: los tres viven en módulos que no dependen
 * entre sí.
 */
export function gateScopeForUrl(baseUrl: string): string {
  const seg = pathSegments(baseUrl);
  return seg[0] === 'tienda' && seg[1] ? `site:${seg[1]}` : 'store';
}
