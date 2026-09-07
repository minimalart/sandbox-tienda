"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.productIdsForSite = productIdsForSite;
exports.siteProductFilter = siteProductFilter;
const utils_1 = require("@medusajs/framework/utils");
const request_1 = require("./request");
const scope_1 = require("./scope");
/**
 * Los productos de una tienda, resueltos por el link de canal.
 *
 * Va aparte de `scope.ts` porque NO es una de las formas fisicas: los productos son del
 * core de Medusa y su pertenencia vive en un link module, no en una columna ni en una
 * tabla puente que podamos consultar por knex.
 *
 * Y no se puede hacer con `filters: { sales_channels: ... }` sobre `product` — eso tira
 * `Trying to query by not existing property Product.sales_channels`. Hay que entrar por
 * el link, que es lo que ya hacia `modules/erp/sync/run-stock-sync.ts` cuando descubrio
 * el problema.
 */
/** Tamano de pagina al recorrer el link. Nada que ver con la paginacion del caller. */
const LINK_PAGE = 1000;
/**
 * Ids de producto que pertenecen a los canales de la tienda activa.
 *
 * `null` = no hay que filtrar (una sola tienda, registro ausente, o ninguna elegida).
 * `[]` = la tienda no vende NADA; el call site tiene que devolver vacio en vez de
 * ignorar el filtro, que es el error facil de cometer con un array vacio.
 *
 * Tira si el catalogo de la tienda supera `SITE_SCOPE_MAX_IDS`. Es el mismo tope y el
 * mismo modo de falla que el subselect del seam, y por el mismo motivo: devolver una
 * pagina filtrada A MEDIAS se ve igual que un catalogo incompleto, sin ninguna senal.
 */
async function productIdsForSite(req) {
    const resolution = await (0, request_1.siteFromRequest)(req);
    if (resolution.status !== 'site')
        return null;
    const query = req.scope.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const ids = new Set();
    for (let skip = 0;; skip += LINK_PAGE) {
        const { data: links } = (await query.graph({
            entity: 'product_sales_channel',
            fields: ['product_id'],
            // LOS DOS canales de una tienda B2B: un producto mayorista es igual de suyo.
            filters: { sales_channel_id: resolution.site.channel_ids },
            pagination: { skip, take: LINK_PAGE, order: { id: 'ASC' } },
        }));
        for (const link of links) {
            if (link.product_id)
                ids.add(link.product_id);
        }
        if (links.length < LINK_PAGE)
            break;
        if (ids.size > scope_1.SITE_SCOPE_MAX_IDS) {
            throw new Error(`El catalogo de esta tienda supera ${scope_1.SITE_SCOPE_MAX_IDS} productos: la ruta ` +
                `necesita paginar por el link antes de filtrar, no traer todos los ids.`);
        }
    }
    return [...ids];
}
/**
 * El filtro por id listo para spreadear sobre los `filters` del modulo Product.
 *
 * Devuelve `{}` cuando no hay que filtrar. Cuando la tienda no vende nada devuelve
 * `{ id: [] }` y NO `{}`: el call site tiene que quedarse sin resultados, no con todos.
 */
async function siteProductFilter(req) {
    const ids = await productIdsForSite(req);
    return ids === null ? {} : { id: ids };
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvZHVjdC1zY29wZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3NyYy9saWIvbXVsdGlzdG9yZS9wcm9kdWN0LXNjb3BlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBb0NBLDhDQTZCQztBQVFELDhDQUdDO0FBNUVELHFEQUFzRTtBQUV0RSx1Q0FBNEM7QUFDNUMsbUNBQTZDO0FBRTdDOzs7Ozs7Ozs7OztHQVdHO0FBRUgsdUZBQXVGO0FBQ3ZGLE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQztBQU12Qjs7Ozs7Ozs7OztHQVVHO0FBQ0ksS0FBSyxVQUFVLGlCQUFpQixDQUFDLEdBQWtCO0lBQ3hELE1BQU0sVUFBVSxHQUFHLE1BQU0sSUFBQSx5QkFBZSxFQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQzlDLElBQUksVUFBVSxDQUFDLE1BQU0sS0FBSyxNQUFNO1FBQUUsT0FBTyxJQUFJLENBQUM7SUFFOUMsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsaUNBQXlCLENBQUMsS0FBSyxDQUEwQixDQUFDO0lBQzFGLE1BQU0sR0FBRyxHQUFHLElBQUksR0FBRyxFQUFVLENBQUM7SUFFOUIsS0FBSyxJQUFJLElBQUksR0FBRyxDQUFDLEdBQUksSUFBSSxJQUFJLFNBQVMsRUFBRSxDQUFDO1FBQ3ZDLE1BQU0sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLEdBQUcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxLQUFLLENBQUM7WUFDekMsTUFBTSxFQUFFLHVCQUF1QjtZQUMvQixNQUFNLEVBQUUsQ0FBQyxZQUFZLENBQUM7WUFDdEIsNkVBQTZFO1lBQzdFLE9BQU8sRUFBRSxFQUFFLGdCQUFnQixFQUFFLFVBQVUsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFO1lBQzFELFVBQVUsRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRTtTQUM1RCxDQUFDLENBQW9ELENBQUM7UUFFdkQsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUUsQ0FBQztZQUN6QixJQUFJLElBQUksQ0FBQyxVQUFVO2dCQUFFLEdBQUcsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQ2hELENBQUM7UUFDRCxJQUFJLEtBQUssQ0FBQyxNQUFNLEdBQUcsU0FBUztZQUFFLE1BQU07UUFFcEMsSUFBSSxHQUFHLENBQUMsSUFBSSxHQUFHLDBCQUFrQixFQUFFLENBQUM7WUFDbEMsTUFBTSxJQUFJLEtBQUssQ0FDYixxQ0FBcUMsMEJBQWtCLHNCQUFzQjtnQkFDM0Usd0VBQXdFLENBQzNFLENBQUM7UUFDSixDQUFDO0lBQ0gsQ0FBQztJQUNELE9BQU8sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQ2xCLENBQUM7QUFFRDs7Ozs7R0FLRztBQUNJLEtBQUssVUFBVSxpQkFBaUIsQ0FBQyxHQUFrQjtJQUN4RCxNQUFNLEdBQUcsR0FBRyxNQUFNLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBQ3pDLE9BQU8sR0FBRyxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQztBQUN6QyxDQUFDIn0=