import type { MiddlewareRoute } from '@medusajs/framework/http';
import { attachSiteHint } from '../lib/multistore';

/**
 * Pistas de tienda para las rutas de admin.
 *
 * Va en un archivo propio y se registra desde `middlewares.ts` —que es CORE— y NO
 * desde `extension-middlewares.ts`: ese archivo lo GENERA el composer y lo mergea
 * `apps/platform/src/github.js` al instalar una extensión, así que lo que se agregue
 * ahí a mano se pierde.
 *
 * El matcher es `/admin/*` y no `/*` porque el storefront resuelve su tienda por
 * otro camino (host o path, en el proxy de Next) y meterle un header acá sólo
 * agregaría una vía de spoofing sin ningún consumidor.
 */
export const multistoreMiddlewares: MiddlewareRoute[] = [
  { matcher: '/admin/*', middlewares: [attachSiteHint] },
];
