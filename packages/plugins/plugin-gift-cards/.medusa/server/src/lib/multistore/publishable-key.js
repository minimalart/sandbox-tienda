"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.channelsFromPublishableKey = void 0;
exports.siteFromPublishableKey = siteFromPublishableKey;
exports.siteIdFromPublishableKey = siteIdFromPublishableKey;
const resolve_site_1 = require("./resolve-site");
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
/** Los canales que la publishable key de esta request habilita. `[]` sin key. */
const channelsFromPublishableKey = (req) => req.publishable_key_context?.sales_channel_ids ?? [];
exports.channelsFromPublishableKey = channelsFromPublishableKey;
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
function siteFromPublishableKey(req) {
    const carrier = req;
    const pending = carrier[PENDING];
    if (pending)
        return pending;
    const promise = (0, resolve_site_1.resolveSite)(req.scope, {
        salesChannelId: (0, exports.channelsFromPublishableKey)(req)[0] ?? null,
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
async function siteIdFromPublishableKey(req) {
    const resolution = await siteFromPublishableKey(req);
    return resolution.status === 'site' ? resolution.site.id : null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHVibGlzaGFibGUta2V5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2xpYi9tdWx0aXN0b3JlL3B1Ymxpc2hhYmxlLWtleS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFxREEsd0RBV0M7QUFlRCw0REFHQztBQWpGRCxpREFBNkM7QUFHN0M7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0F5Qkc7QUFFSCx3RkFBd0Y7QUFDeEYsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO0FBT3ZELGlGQUFpRjtBQUMxRSxNQUFNLDBCQUEwQixHQUFHLENBQUMsR0FBa0IsRUFBWSxFQUFFLENBQ3hFLEdBQTBCLENBQUMsdUJBQXVCLEVBQUUsaUJBQWlCLElBQUksRUFBRSxDQUFDO0FBRGxFLFFBQUEsMEJBQTBCLDhCQUN3QztBQUUvRTs7Ozs7Ozs7O0dBU0c7QUFDSCxTQUFnQixzQkFBc0IsQ0FBQyxHQUFrQjtJQUN2RCxNQUFNLE9BQU8sR0FBRyxHQUF5QixDQUFDO0lBQzFDLE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNqQyxJQUFJLE9BQU87UUFBRSxPQUFPLE9BQU8sQ0FBQztJQUU1QixNQUFNLE9BQU8sR0FBRyxJQUFBLDBCQUFXLEVBQUMsR0FBRyxDQUFDLEtBQUssRUFBRTtRQUNyQyxjQUFjLEVBQUUsSUFBQSxrQ0FBMEIsRUFBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJO1FBQzFELGlCQUFpQixFQUFFLEtBQUs7S0FDekIsQ0FBQyxDQUFDO0lBQ0gsT0FBTyxDQUFDLE9BQU8sQ0FBQyxHQUFHLE9BQU8sQ0FBQztJQUMzQixPQUFPLE9BQU8sQ0FBQztBQUNqQixDQUFDO0FBRUQ7Ozs7Ozs7Ozs7OztHQVlHO0FBQ0ksS0FBSyxVQUFVLHdCQUF3QixDQUFDLEdBQWtCO0lBQy9ELE1BQU0sVUFBVSxHQUFHLE1BQU0sc0JBQXNCLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDckQsT0FBTyxVQUFVLENBQUMsTUFBTSxLQUFLLE1BQU0sQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUNsRSxDQUFDIn0=