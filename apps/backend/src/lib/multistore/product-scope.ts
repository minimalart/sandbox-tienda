import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { MedusaRequest } from '@medusajs/framework/http';
import { siteFromRequest } from './request';
import { SITE_SCOPE_MAX_IDS } from './scope';

/**
 * Los productos de una tienda, resueltos por el link de canal.
 *
 * Va aparte de `scope.ts` porque NO es una de las formas físicas: los productos son del
 * core de Medusa y su pertenencia vive en un link module, no en una columna ni en una
 * tabla puente que podamos consultar por knex.
 *
 * Y no se puede hacer con `filters: { sales_channels: … }` sobre `product` — eso tira
 * `Trying to query by not existing property Product.sales_channels`. Hay que entrar por
 * el link, que es lo que ya hacía `modules/erp/sync/run-stock-sync.ts` cuando descubrió
 * el problema.
 */

/** Tamaño de página al recorrer el link. Nada que ver con la paginación del caller. */
const LINK_PAGE = 1000;

type QueryGraph = {
  graph: (input: unknown) => Promise<{ data: unknown[] }>;
};

/**
 * Ids de producto que pertenecen a los canales de la tienda activa.
 *
 * `null` = no hay que filtrar (una sola tienda, registro ausente, o ninguna elegida).
 * `[]` = la tienda no vende NADA; el call site tiene que devolver vacío en vez de
 * ignorar el filtro, que es el error fácil de cometer con un array vacío.
 *
 * Tira si el catálogo de la tienda supera `SITE_SCOPE_MAX_IDS`. Es el mismo tope y el
 * mismo modo de falla que el subselect del seam, y por el mismo motivo: devolver una
 * página filtrada A MEDIAS se ve igual que un catálogo incompleto, sin ninguna señal.
 */
export async function productIdsForSite(req: MedusaRequest): Promise<string[] | null> {
  const resolution = await siteFromRequest(req);
  if (resolution.status !== 'site') return null;

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as unknown as QueryGraph;
  const ids = new Set<string>();

  for (let skip = 0; ; skip += LINK_PAGE) {
    const { data: links } = (await query.graph({
      entity: 'product_sales_channel',
      fields: ['product_id'],
      // LOS DOS canales de una tienda B2B: un producto mayorista es igual de suyo.
      filters: { sales_channel_id: resolution.site.channel_ids },
      pagination: { skip, take: LINK_PAGE, order: { id: 'ASC' } },
    })) as { data: Array<{ product_id?: string | null }> };

    for (const link of links) {
      if (link.product_id) ids.add(link.product_id);
    }
    if (links.length < LINK_PAGE) break;

    if (ids.size > SITE_SCOPE_MAX_IDS) {
      throw new Error(
        `El catálogo de esta tienda supera ${SITE_SCOPE_MAX_IDS} productos: la ruta ` +
          `necesita paginar por el link antes de filtrar, no traer todos los ids.`,
      );
    }
  }
  return [...ids];
}

/**
 * El filtro por id listo para spreadear sobre los `filters` del módulo Product.
 *
 * Devuelve `{}` cuando no hay que filtrar. Cuando la tienda no vende nada devuelve
 * `{ id: [] }` y NO `{}`: el call site tiene que quedarse sin resultados, no con todos.
 */
export async function siteProductFilter(req: MedusaRequest): Promise<Record<string, unknown>> {
  const ids = await productIdsForSite(req);
  return ids === null ? {} : { id: ids };
}
