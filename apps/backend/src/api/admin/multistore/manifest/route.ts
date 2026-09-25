import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ADMIN_ROUTE_SCOPE } from '../../../../lib/multistore/scoped-routes';
import { listSiteBrands, listSites, SITE_ID_HEADER, toSiteBrandColors } from '../../../../lib/multistore';

/**
 * Qué sabe el backend sobre el scoping por tienda, para que el admin no prometa
 * más de lo que hay.
 *
 * Sin esto el selector tendría que adivinar en qué pantallas filtra, y la única
 * forma de adivinar mal es hacia el lado optimista: mostrar "estás viendo Norte" en
 * una pantalla que devuelve las tres tiendas.
 *
 * `enabled: false` significa que el admin ni siquiera monta el selector: no hay
 * módulo de tiendas, o hay una sola y no hay nada que elegir.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const [sites, brands] = await Promise.all([listSites(req.scope), listSiteBrands(req.scope)]);

  const counts = Object.values(ADMIN_ROUTE_SCOPE).reduce(
    (acc, entry) => ({ ...acc, [entry.state]: (acc[entry.state] ?? 0) + 1 }),
    {} as Record<string, number>,
  );

  return res.status(200).json({
    enabled: sites.length > 1,
    header: SITE_ID_HEADER,
    /** Sin header, una ruta migrada devuelve TODAS las tiendas. Ver scoped-routes.ts. */
    default_when_absent: 'all',
    sites: sites.map((site) => ({
      id: site.id,
      slug: site.slug,
      name: site.name,
      is_main: site.is_main,
      channel_ids: site.channel_ids,
      // La paleta de la tienda, para que los formularios del admin (banners) ofrezcan
      // sus colores y no los de Mercatto. `null` = la tienda no fijó ese color.
      brand: brands[site.id] ?? toSiteBrandColors(null),
    })),
    routes: ADMIN_ROUTE_SCOPE,
    counts,
    /**
     * Lo que "filtrado por tienda" significa hoy, publicado a propósito: el eje real
     * es el sales channel, no una columna de tienda. Un canal creado a mano no
     * pertenece a ninguna tienda, y una tienda con `source_type: 'sales_channel'`
     * adopta un canal que puede estar compartido.
     */
    axis: 'sales_channel',
  });
}
