import type { MedusaRequest } from '@medusajs/framework/http';
import { resolveSite } from './resolve-site';
import type { SiteResolution } from './types';

/**
 * La tienda de una request del STOREFRONT.
 *
 * Es el gemelo de `siteFromRequest` (`request.ts`) para `/store/*`, y existe porque
 * el eje de los dos lados NO es el mismo dato:
 *
 *   admin      `x-site-id` — lo elige un operador en el selector del backoffice.
 *   storefront la PUBLISHABLE KEY — Medusa la traduce a
 *              `publishable_key_context.sales_channel_ids` antes de que el handler
 *              corra.
 *
 * Por qué la key y no un header propio: `attachSiteHint` está registrado sólo para
 * `/admin/*` (ver `api/multistore-middlewares.ts` en el host), y es deliberado — un
 * header de tienda en el store sería una vía de spoofing sin ningún consumidor. La
 * key, en cambio, ya viene autenticada por el middleware de Medusa: el cliente no
 * la puede cambiar sin tener la key de la otra tienda.
 *
 * Y por eso mismo NO se lee `req.query.sales_channel_id`: ese lo escribe el
 * cliente. Varias rutas del store lo usan como eje y el resultado es que pasar el
 * canal de otra tienda alcanza para ver su contenido. Quien necesite respetar el
 * query param que lo lea aparte y a sabiendas; este helper devuelve el eje
 * CONFIABLE.
 *
 * Memoizado por request igual que `siteFromRequest`, y por la misma razón: cinco
 * helpers en el mismo handler no pueden producir cinco queries.
 */

/** Se memoiza la PROMESA, no el valor: dos llamadas concurrentes harían dos queries. */
const PENDING = Symbol.for('multistore.store-pending');

type Carrier = {
  [PENDING]?: Promise<SiteResolution>;
  publishable_key_context?: { sales_channel_ids?: string[] };
};

/** Los canales que la publishable key de esta request habilita. `[]` sin key. */
export const channelsFromPublishableKey = (req: MedusaRequest): string[] =>
  (req as unknown as Carrier).publishable_key_context?.sales_channel_ids ?? [];

/**
 * `allowMainFallback` va en `false` a propósito, igual que en el admin.
 *
 * Es tentador prenderlo —"el storefront quiere la principal"— pero acá significaría
 * que una key sin canal, o con un canal que no es de ninguna tienda, resuelve a la
 * tienda PRINCIPAL y filtra por ella. Es decir: el visitante de una demo mal
 * configurada vería el contenido de la principal creyendo que es el de la demo. Con
 * `false` el resultado es `allSites`/`registryAbsent`, que NO filtra — se ve de más,
 * pero se ve lo que ya se veía, y eso no es una regresión silenciosa.
 */
export function siteFromPublishableKey(req: MedusaRequest): Promise<SiteResolution> {
  const carrier = req as unknown as Carrier;
  const pending = carrier[PENDING];
  if (pending) return pending;

  const promise = resolveSite(req.scope, {
    salesChannelId: channelsFromPublishableKey(req)[0] ?? null,
    allowMainFallback: false,
  });
  carrier[PENDING] = promise;
  return promise;
}

/**
 * El `site_id` de esta request, o `null` para la fila GLOBAL.
 *
 * Es el atajo para las tablas de configuración con precedencia
 * (`readSetting(key, siteId)`): ahí `null` NO significa "sin filtrar", significa
 * "la fila global", que es exactamente lo que corresponde cuando no hay tienda
 * resuelta.
 *
 * Ojo: para LISTAR filas de datos hay que usar `siteFromPublishableKey` y
 * `siteFilter`, no esto. Colapsar la resolución en un `string | null` pierde la
 * distinción entre `singleSite` —no filtrar— y `site` —filtrar—, que es justo la
 * que evita que un proyecto mono-tienda se esconda sus propias filas.
 */
export async function siteIdFromPublishableKey(req: MedusaRequest): Promise<string | null> {
  const resolution = await siteFromPublishableKey(req);
  return resolution.status === 'site' ? resolution.site.id : null;
}
