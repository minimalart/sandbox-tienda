import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../lib/multistore/request';
import { siteChannelFilter } from '../../../../lib/multistore/scope';
import { productIdsForSite } from '../../../../lib/multistore/product-scope';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { SEO_GEO_MODULE } from '../../../../modules/seo-geo';
import type SeoGeoModuleService from '../../../../modules/seo-geo/service';

/**
 * GET /admin/seo-geo/keywords — keywords/preguntas derivadas de la taxonomía del
 * catálogo (PRD §17). Por cada categoría genera una pregunta representativa y
 * marca si está "cubierta": hay al menos un producto de esa categoría con score
 * GEO suficiente en la última auditoría. Las queries reales de búsqueda
 * (Typesense popular queries) se integran en una iteración futura.
 *
 * LA TAXONOMÍA SE ARMA DESDE LOS PRODUCTOS DE LA TIENDA, no desde la lista global
 * de categorías. Listar `product_category` y quedarse con las primeras 100 tiene un
 * modo de falla que se ve como un dato y no como un error: las categorías son
 * globales y esta instalación tiene MILES (cada import de demo crea las suyas —520,
 * 525, 547—), así que esas 100 son un recorte arbitrario que casi siempre cae en la
 * tienda principal. La tienda que no entra en la ventana no ve "otras preguntas":
 * ve la pantalla vacía, con el catálogo entero categorizado. Es lo que pasó con Desde
 * el sur: 2.658 de 2.660 productos con categoría y cero preguntas.
 *
 * Recorriendo los productos de la tienda, en cambio, la ventana no puede dejar
 * afuera una categoría que la tienda usa: si un producto suyo la tiene, aparece.
 * Es el mismo camino que ya hace `geo/load-products.ts` para puntuar el catálogo.
 */

/** Página del recorrido de productos. Igual que `loadGeoProducts`. */
const PAGE = 200;

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const service = req.scope.resolve<SeoGeoModuleService>(SEO_GEO_MODULE);

  // Set de productos con score suficiente en la última auditoría completada
  const latest = await service.listSeoAudits({ status: 'completed', ...siteChannelFilter(await siteFromRequest(req), undefined) }, { take: 1, order: { completed_at: 'DESC' } });
  const sufficient = new Set<string>();
  if (latest[0]) {
    const scores = await service.listSeoGeoProductScores(
      { audit_id: latest[0].id },
      { take: null as unknown as number }
    );
    for (const s of scores) if (s.score >= 70) sufficient.add(s.product_id);
  }

  // `null` = instalación de una sola tienda: no hay que filtrar. `[]` NO es lo mismo
  // —una tienda sin catálogo no tiene ninguna pregunta— y por eso se distingue.
  const allowed = await productIdsForSite(req);
  if (allowed !== null && allowed.length === 0) {
    res.status(200).json({ keywords: [], has_audit: Boolean(latest[0]) });
    return;
  }

  type Bucket = { name: string; handle: string | null; products: Set<string> };
  const byCategory = new Map<string, Bucket>();

  for (let skip = 0; ; skip += PAGE) {
    const { data } = await query.graph({
      entity: 'product',
      fields: ['id', 'categories.id', 'categories.name', 'categories.handle'],
      filters: {
        status: 'published',
        ...(allowed === null ? {} : { id: allowed }),
      },
      pagination: { skip, take: PAGE },
    });

    const rows = data as Array<{
      id?: string;
      categories?: Array<{ id?: string; name?: string; handle?: string }>;
    }>;
    for (const p of rows) {
      if (!p.id) continue;
      for (const c of p.categories ?? []) {
        if (!c?.id || !c.name) continue;
        const bucket = byCategory.get(c.id) ?? { name: c.name, handle: c.handle ?? null, products: new Set() };
        bucket.products.add(p.id);
        byCategory.set(c.id, bucket);
      }
    }
    if (rows.length < PAGE) break;
  }

  const keywords = [...byCategory.values()]
    .map((c) => ({
      term: c.name,
      handle: c.handle,
      question: `¿Cuál es el mejor ${c.name.toLowerCase()}?`,
      product_count: c.products.size,
      covered: [...c.products].some((id) => sufficient.has(id)),
    }))
    .sort((a, b) => b.product_count - a.product_count);

  res.status(200).json({ keywords, has_audit: Boolean(latest[0]) });
}
