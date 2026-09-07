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
 * `/admin/*` (ver `api/multistore-middlewares.ts`), y es deliberado — un header de
 * tienda en el store sería una vía de spoofing sin ningún consumidor. La key, en
 * cambio, ya viene autenticada por el middleware de Medusa: el cliente no la puede
 * cambiar sin tener la key de la otra tienda.
 *
 * Y por eso mismo NO se lee `req.query.sales_channel_id`: ese lo escribe el cliente.
 * Varias rutas del store lo usan como eje y el resultado es que pasar el canal de otra
 * tienda alcanza para ver su contenido. Quien necesite respetar el query param que lo
 * lea aparte y a sabiendas; este helper devuelve el eje CONFIABLE.
 *
 * `channel_ids[0]`: la key resuelve a una lista, pero una tienda B2B tiene sus dos
 * canales en la MISMA fila del registro (`sales_channel_id` + `b2b_sales_channel_id`),
 * así que cualquiera de los dos la encuentra. Recorrerlos todos sólo cambiaría algo si
 * una key mezclara canales de dos tiendas distintas, y en ese caso no hay respuesta
 * correcta: se devuelve la de la primera y no se inventa una unión.
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
 * (`getSettings(siteId)`, `readSetting(key, siteId)`): ahí `null` NO significa "sin
 * filtrar", significa "la fila global", que es exactamente lo que corresponde cuando
 * no hay tienda resuelta.
 *
 * `singleSite` cae en `null` igual que `allSites` y `registryAbsent`, y es el MISMO
 * criterio que `siteIdOfChannel`: ahí la key no identificó ninguna tienda, así que la
 * fila global no es "la de otra" — es la única que hay.
 *
 * OJO con lo que `singleSite` NO significa: `resolveSite` devuelve `site` en cuanto una
 * pista MATCHEA, ANTES de contar cuántas tiendas existen. O sea que un proyecto con una
 * sola tienda y su publishable key bien emitida resuelve `site` y SÍ filtra. Es
 * correcto, y es lo que hace que agregar la segunda tienda no cambie nada: todos los
 * descriptores que se filtran del lado store llevan `empty: 'all'`, así que las filas
 * globales —las anteriores a la columna, que son todas en una instalación vieja— se
 * siguen viendo.
 *
 * Ojo: para LISTAR filas de datos hay que usar `siteFromPublishableKey` y
 * `siteFilter`, no esto. Colapsar la resolución en un `string | null` pierde la
 * distinción entre `singleSite` —no filtrar— y `site` —filtrar—, que es justo la que
 * evita que un proyecto mono-tienda se esconda sus propias filas.
 */
async function siteIdFromPublishableKey(req) {
    const resolution = await siteFromPublishableKey(req);
    return resolution.status === 'site' ? resolution.site.id : null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHVibGlzaGFibGUta2V5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL2xpYi9tdWx0aXN0b3JlL3B1Ymxpc2hhYmxlLWtleS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUEwREEsd0RBV0M7QUEyQkQsNERBR0M7QUFsR0QsaURBQTZDO0FBRzdDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7R0E4Qkc7QUFFSCx3RkFBd0Y7QUFDeEYsTUFBTSxPQUFPLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO0FBT3ZELGlGQUFpRjtBQUMxRSxNQUFNLDBCQUEwQixHQUFHLENBQUMsR0FBa0IsRUFBWSxFQUFFLENBQ3hFLEdBQTBCLENBQUMsdUJBQXVCLEVBQUUsaUJBQWlCLElBQUksRUFBRSxDQUFDO0FBRGxFLFFBQUEsMEJBQTBCLDhCQUN3QztBQUUvRTs7Ozs7Ozs7O0dBU0c7QUFDSCxTQUFnQixzQkFBc0IsQ0FBQyxHQUFrQjtJQUN2RCxNQUFNLE9BQU8sR0FBRyxHQUF5QixDQUFDO0lBQzFDLE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNqQyxJQUFJLE9BQU87UUFBRSxPQUFPLE9BQU8sQ0FBQztJQUU1QixNQUFNLE9BQU8sR0FBRyxJQUFBLDBCQUFXLEVBQUMsR0FBRyxDQUFDLEtBQUssRUFBRTtRQUNyQyxjQUFjLEVBQUUsSUFBQSxrQ0FBMEIsRUFBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxJQUFJO1FBQzFELGlCQUFpQixFQUFFLEtBQUs7S0FDekIsQ0FBQyxDQUFDO0lBQ0gsT0FBTyxDQUFDLE9BQU8sQ0FBQyxHQUFHLE9BQU8sQ0FBQztJQUMzQixPQUFPLE9BQU8sQ0FBQztBQUNqQixDQUFDO0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztHQXdCRztBQUNJLEtBQUssVUFBVSx3QkFBd0IsQ0FBQyxHQUFrQjtJQUMvRCxNQUFNLFVBQVUsR0FBRyxNQUFNLHNCQUFzQixDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3JELE9BQU8sVUFBVSxDQUFDLE1BQU0sS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDbEUsQ0FBQyJ9