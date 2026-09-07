import type { MedusaRequest } from '@medusajs/framework/http';
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
export declare function productIdsForSite(req: MedusaRequest): Promise<string[] | null>;
/**
 * El filtro por id listo para spreadear sobre los `filters` del modulo Product.
 *
 * Devuelve `{}` cuando no hay que filtrar. Cuando la tienda no vende nada devuelve
 * `{ id: [] }` y NO `{}`: el call site tiene que quedarse sin resultados, no con todos.
 */
export declare function siteProductFilter(req: MedusaRequest): Promise<Record<string, unknown>>;
