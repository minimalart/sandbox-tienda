import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import {
  LEGACY_BRANCH_TYPES,
  resolveBranchTypes,
  type BranchType,
} from '../../../lib/branch-types';

/**
 * GET /admin/branch-types?sales_channel_ids=sc_1,sc_2
 *
 * Los tipos de sucursal disponibles para una sucursal, según las TIENDAS en
 * cuyos canales está publicada. Lo consume el Select de la ficha de sucursal.
 *
 * Vive en su propio namespace y no bajo `/admin/store-locations/branch-types`
 * para no quedar al lado de la ruta dinámica `[id]` y depender del orden en que
 * el router resuelve estática vs. dinámica.
 *
 * El módulo `demo_store` se resuelve DENTRO de un try/catch a propósito: es de
 * la extensión `multistore`, y `store-locations` no la declara como dependencia
 * (ni debería: sirve igual en una instalación de una sola tienda). Sin el
 * módulo, o si algo falla, se devuelven los tres tipos de siempre — que es
 * exactamente lo que veía el operador antes de este cambio.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const raw = typeof req.query.sales_channel_ids === 'string' ? req.query.sales_channel_ids : '';
  const channelIds = raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

  let sites: { sales_channel_id?: string | null; b2b_sales_channel_id?: string | null; content_config?: any }[];
  try {
    const service: any = req.scope.resolve('demo_store');
    sites = await service.listDemoStores({});
  } catch {
    res.status(200).json({ branch_types: LEGACY_BRANCH_TYPES });
    return;
  }

  // Sin canales, la sucursal es visible en TODOS: se ofrecen los tipos de todas
  // las tiendas. Con canales, sólo los de las tiendas que la muestran — un sitio
  // B2B publica en dos canales (b2c + mayorista) y cualquiera de los dos cuenta.
  const scoped = channelIds.length
    ? sites.filter(
        (site) =>
          (site.sales_channel_id && channelIds.includes(site.sales_channel_id)) ||
          (site.b2b_sales_channel_id && channelIds.includes(site.b2b_sales_channel_id))
      )
    : sites;

  // Dedupe por id conservando el orden de aparición: si dos tiendas nombran
  // distinto al mismo id, gana el primero. Es una ambigüedad real y sin buena
  // respuesta; lo importante es que el id que se guarda sea el mismo.
  const byId = new Map<string, BranchType>();
  for (const site of scoped) {
    for (const type of resolveBranchTypes(site.content_config?.sucursales)) {
      if (!byId.has(type.id)) byId.set(type.id, type);
    }
  }

  res.status(200).json({ branch_types: [...byId.values()] });
}
