import { hiddenProductIds } from '../../lib/multistore/sales-mode';

/**
 * Productos `bundle_only` dentro del documento de Typesense (PRD Bundles V2 §47).
 *
 * El índice es UNO para todas las tiendas, así que la exclusión no puede ser un
 * booleano del producto: el mismo producto puede estar oculto en una tienda y
 * venderse suelto en otra. Se indexa entonces la lista de CANALES donde está
 * oculto, y el storefront —que ya sabe en qué canal está— filtra con
 * `bundle_only_channels:!=[<canal>]`.
 *
 * Canales y no ids de tienda: el filtro del storefront ya se arma con el
 * `sales_channel_id` activo, así que buscar por canal no le agrega ninguna
 * resolución extra en el browser.
 *
 * Los documentos que todavía no tienen el campo (índice sin re-sincronizar)
 * MATCHEAN el `!=` —medido contra el Typesense real—, o sea que siguen visibles:
 * la migración no esconde nada de golpe, sólo deja de mostrar lo configurado una
 * vez que corre el sync.
 *
 * Sin imports del framework a propósito: el `query` entra por parámetro, así que
 * todo el archivo se puede testear sin levantar Medusa.
 */

export type BundleOnlyChannelMap = Map<string, string[]>;

type SalesModeRow = { product_id: string; site_id: string; sales_mode: string };
type SiteChannel = { id: string; sales_channel_id?: string | null };

/** Lo mínimo que se necesita de Query, para no atar este archivo al framework. */
type QueryGraph = {
  graph: (args: unknown) => Promise<{ data?: unknown[] }>;
};

/**
 * PURA: cruza las filas de modo de venta con el canal de cada tienda.
 *
 * Una tienda sin canal asignado no aporta nada — no hay por dónde filtrar — y se
 * ignora en silencio en vez de inventar un canal vacío que escondería productos
 * de todo el catálogo.
 */
export const buildBundleOnlyChannelMap = (
  rows: readonly SalesModeRow[],
  sites: readonly SiteChannel[],
): BundleOnlyChannelMap => {
  const channelOfSite = new Map<string, string>();
  for (const site of sites) {
    if (site.sales_channel_id) channelOfSite.set(site.id, site.sales_channel_id);
  }

  const map: BundleOnlyChannelMap = new Map();
  for (const siteId of new Set(rows.map((row) => row.site_id))) {
    const channel = channelOfSite.get(siteId);
    if (!channel) continue;
    const hidden = hiddenProductIds(rows.filter((row) => row.site_id === siteId));
    for (const productId of hidden) {
      const current = map.get(productId);
      if (current) {
        if (!current.includes(channel)) current.push(channel);
      } else {
        map.set(productId, [channel]);
      }
    }
  }
  return map;
};

/**
 * Lee el mapa desde la base. Fail-open: sin módulo de tiendas, sin tabla o con
 * la query rota devuelve un mapa vacío y el índice queda como estaba — un error
 * de infraestructura no puede terminar escondiendo catálogo.
 */
export const getBundleOnlyChannelMap = async (
  query: QueryGraph,
): Promise<BundleOnlyChannelMap> => {
  try {
    const { data: rows } = await query.graph({
      entity: 'product_sales_mode',
      fields: ['product_id', 'site_id', 'sales_mode'],
      filters: { sales_mode: 'bundle_only' },
    });
    if (!rows?.length) return new Map();

    const { data: sites } = await query.graph({
      entity: 'demo_store',
      fields: ['id', 'sales_channel_id'],
    });
    return buildBundleOnlyChannelMap(rows as SalesModeRow[], (sites ?? []) as SiteChannel[]);
  } catch {
    return new Map();
  }
};

/** Cuelga `bundle_only_channels` de cada producto antes de mapear el documento. */
export const attachBundleOnlyChannels = (
  products: Array<Record<string, unknown>>,
  map: BundleOnlyChannelMap,
): void => {
  for (const product of products) {
    const id = product.id as string | undefined;
    product.bundle_only_channels = id ? (map.get(id) ?? []) : [];
  }
};
