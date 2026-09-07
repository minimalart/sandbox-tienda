import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { getSeoGeoConfig } from '../../../../modules/seo-geo/config';
import { OPEN_GRAPH_DEFAULTS } from '../../../../modules/seo-geo/open-graph';
import { siteIdFromPublishableKey } from '../../../../lib/multistore/publishable-key';

/**
 * GET /store/seo-geo/open-graph — la card social de la tienda.
 *
 * Lo consume `generateMetadata()` del layout del storefront para emitir `og:*` y
 * `twitter:*`. Es la ÚNICA ruta pública de esta extensión: el resto de la config
 * (presupuesto de crawl, umbrales, modelo de IA) no tiene por qué salir del admin,
 * y por eso acá se publica la sección `open_graph` y nada más.
 *
 * El eje es la publishable key y no `x-site-id`: `attachSiteHint` está registrado
 * sólo para `/admin/*`, así que en el store la key ES la tienda. Sin ella —o sin
 * fila propia— se cae a la config global, que es la herencia normal de
 * `store_setting`.
 *
 * Siempre 200. Un error acá no puede tumbar el `<head>` de la home: el storefront
 * tiene defaults dignos (el nombre de la tienda y la tarjeta 1200x630 generada) y
 * un 500 lo dejaría sin card en vez de con la de siempre.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const siteId = await siteIdFromPublishableKey(req);
    const config = await getSeoGeoConfig(req.scope, siteId);
    res.status(200).json({ open_graph: config.open_graph });
  } catch {
    res.status(200).json({ open_graph: OPEN_GRAPH_DEFAULTS });
  }
}
