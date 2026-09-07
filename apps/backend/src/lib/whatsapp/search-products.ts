import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { QueryContext } from '@medusajs/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import { salesChannelProductIds } from '../../api/store/b2b/channel-products';
import { resolveWaOrderContext, type WaOrderContext } from './order-context';
import { TYPESENSE } from '../../modules/typesense';

export type WaProductHit = {
  product_id: string;
  variant_id: string;
  product_title: string;
  variant_title: string;
  /** "Producto — Variante" listo para mostrar. */
  title: string;
  unit_price: number | null;
  in_stock: boolean;
  image_url: string | null;
};

type VariantRow = {
  id: string;
  title?: string;
  manage_inventory?: boolean;
  calculated_price?: { calculated_amount?: number } | null;
  inventory_items?: Array<{
    inventory?: { location_levels?: Array<{ available_quantity?: number }> } | null;
  }>;
};
type ProductRow = { id: string; title?: string; thumbnail?: string | null; variants?: VariantRow[] };

/** Títulos de variante "placeholder" que no aportan info (no se muestran al cliente). */
const PLACEHOLDER_VARIANT_TITLES = new Set(
  ['default variant', 'default title', 'único', 'unico', 'default'].map((s) => s.toLowerCase()),
);

/**
 * Título para mostrar al cliente: "Producto — Variante", pero omite la variante
 * cuando es un placeholder (ej. "Único", "Default variant") o repite el producto.
 * Evita ruido tipo "Coca-Cola — Default variant".
 */
export function displayTitle(productTitle?: string | null, variantTitle?: string | null): string {
  const p = (productTitle ?? '').trim();
  const v = (variantTitle ?? '').trim();
  if (!v || PLACEHOLDER_VARIANT_TITLES.has(v.toLowerCase()) || v.toLowerCase() === p.toLowerCase()) {
    return p || v;
  }
  return p ? `${p} — ${v}` : v;
}

const stockOf = (v: VariantRow): number => {
  if (v.manage_inventory === false) return 999999;
  return (v.inventory_items ?? []).reduce((acc, it) => {
    const levels = it.inventory?.location_levels ?? [];
    return acc + levels.reduce((a, l) => a + (l.available_quantity || 0), 0);
  }, 0);
};

/**
 * Orden de los resultados: primero lo que TIENE STOCK, después el mejor match de
 * texto, y a igualdad el ranking comercial. Espeja `buildSortBy('relevance')` del
 * storefront (`apps/storefront/src/lib/typesense/core/sort.ts`), que no se puede
 * importar desde el backend.
 */
const WA_SORT_BY =
  '_eval(stock_available:>0):desc,_text_match:desc,metadata.ranking(missing_values: last):desc';

/**
 * IDs de producto relevantes vía Typesense (typo-tolerante, sinónimos, relevancia
 * por título/categoría/descripción), en orden de relevancia. Devuelve null si
 * Typesense no está disponible o no matcheó nada → el caller cae al filtro ILIKE.
 *
 * El `filter_by` acota al canal de WhatsApp DENTRO de Typesense. Sin eso la página
 * de 30 hits se llenaba con productos de otros canales (la instancia es
 * multi-tienda) y recién después se intersectaba en JS, así que una búsqueda
 * legítima podía quedar en cero resultados.
 */
async function typesenseProductIds(
  container: MedusaContainer,
  q: string,
  salesChannelIds: string[],
): Promise<string[] | null> {
  try {
    const ts = container.resolve(TYPESENSE) as {
      search: (p: Record<string, unknown>) => Promise<{ hits?: Array<{ document?: { id?: string } }> }>;
    };
    const resp = await ts.search({
      q,
      query_by: 'title,category_path_label,description',
      query_by_weights: '6,3,1',
      num_typos: 2,
      prefix: true,
      per_page: 30,
      filter_by: [
        `sales_channels.id:=[${salesChannelIds.join(',')}]`,
        'metadata.hidden_from_store:!=true',
      ].join(' && '),
      sort_by: WA_SORT_BY,
    });
    const ids = (resp?.hits ?? []).map((h) => h?.document?.id).filter(Boolean) as string[];
    return ids.length ? ids : null;
  } catch {
    return null;
  }
}

/**
 * Hidrata una lista de `product_id` (en orden de relevancia) contra Medusa:
 * precio CALCULADO para la región y stock real. Devuelve UNA fila por VARIANTE
 * comprable, no `variants[0]` — en una pinturería 1 l y 20 l son opciones
 * distintas y el cliente tiene que poder elegir.
 *
 * Está separado de `searchWaProducts` porque el asesor guiado llega con ids que ya
 * salieron de un filtrado por facetas y necesita exactamente esta validación
 * (§5.5 y §18: precio y stock se confirman contra Medusa, nunca contra el índice).
 */
export async function hydrateWaProductIds(
  container: MedusaContainer,
  productIds: string[],
  opts: { limit?: number; ctx?: WaOrderContext } = {},
): Promise<{ hits: WaProductHit[]; ctx: WaOrderContext }> {
  const ctx = opts.ctx ?? (await resolveWaOrderContext(container));
  const limit = Math.min(Math.max(Number(opts.limit) || 5, 1), 10);
  if (productIds.length === 0) return { hits: [], ctx };

  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const priceContext = QueryContext({
    currency_code: ctx.currency_code,
    region_id: ctx.region_id,
  });

  const { data: products } = (await query.graph({
    entity: 'product',
    fields: [
      'id',
      'title',
      'thumbnail',
      'variants.id',
      'variants.title',
      'variants.manage_inventory',
      'variants.calculated_price.calculated_amount',
      'variants.inventory_items.inventory.location_levels.available_quantity',
    ],
    filters: { status: 'published', id: productIds },
    context: { variants: { calculated_price: priceContext } },
    pagination: { skip: 0, take: Math.max(productIds.length, 30) },
  })) as { data: ProductRow[] };

  // `query.graph` no respeta el orden de los ids: se restaura el del ranking.
  const position = new Map(productIds.map((id, i) => [id, i]));
  const ordered = [...products].sort(
    (a, b) => (position.get(a.id) ?? 9999) - (position.get(b.id) ?? 9999),
  );

  const hits: WaProductHit[] = [];
  for (const p of ordered) {
    for (const v of p.variants ?? []) {
      hits.push({
        product_id: p.id,
        variant_id: v.id,
        product_title: p.title ?? '',
        variant_title: v.title ?? '',
        title: displayTitle(p.title, v.title),
        unit_price: v.calculated_price?.calculated_amount ?? null,
        in_stock: stockOf(v) > 0,
        image_url: p.thumbnail ?? null,
      });
    }
  }
  hits.sort((a, b) => Number(b.in_stock) - Number(a.in_stock));
  // Ocultar sin stock por defecto (§29). Si TODO está sin stock se muestran igual:
  // mejor ofrecer algo marcado que dejar la búsqueda vacía.
  const inStock = hits.filter((h) => h.in_stock);
  const finalHits = inStock.length ? inStock : hits;
  return { hits: finalHits.slice(0, limit), ctx };
}

/**
 * Busca productos publicados scopeados al sales channel de WhatsApp, con precio
 * calculado para la región y stock. Usa Typesense para la relevancia (con fallback
 * a `title ILIKE`) y devuelve UNA fila por VARIANTE comprable (no `variants[0]`),
 * con imagen y stock, para ofrecer al cliente y agregar por `variant_id`.
 */
export async function searchWaProducts(
  container: MedusaContainer,
  opts: { query: string; limit?: number; ctx?: WaOrderContext },
): Promise<{ hits: WaProductHit[]; ctx: WaOrderContext }> {
  const q = opts.query?.trim();
  const limit = Math.min(Math.max(Number(opts.limit) || 8, 1), 10);
  const ctx = opts.ctx ?? (await resolveWaOrderContext(container));
  if (!q) return { hits: [], ctx };

  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  // Scopear por canal vía ids (query.graph no filtra products por sales_channels).
  // Unión de todos los canales que atiende el bot: `salesChannelProductIds`
  // resuelve uno por llamada, así que con varios canales se juntan los ids.
  const scopedIds = Array.from(
    new Set(
      (
        await Promise.all(
          ctx.sales_channel_ids.map((id) => salesChannelProductIds(query, id)),
        )
      ).flat(),
    ),
  );
  if (scopedIds.length === 0) return { hits: [], ctx };
  const scopedSet = new Set(scopedIds);

  // Relevancia por Typesense (si está), acotada al canal; si no, fallback ILIKE.
  const tsIds = await typesenseProductIds(container, q, ctx.sales_channel_ids);
  const orderedIds = tsIds ? tsIds.filter((id) => scopedSet.has(id)) : null;
  const useTs = Boolean(orderedIds && orderedIds.length);

  const priceContext = QueryContext({
    currency_code: ctx.currency_code,
    region_id: ctx.region_id,
  });

  const { data: products } = (await query.graph({
    entity: 'product',
    fields: [
      'id',
      'title',
      'thumbnail',
      'variants.id',
      'variants.title',
      'variants.manage_inventory',
      'variants.calculated_price.calculated_amount',
      'variants.inventory_items.inventory.location_levels.available_quantity',
    ],
    filters: useTs
      ? { status: 'published', id: orderedIds as string[] }
      : { status: 'published', title: { $ilike: `%${q}%` }, id: scopedIds },
    context: { variants: { calculated_price: priceContext } },
    pagination: { skip: 0, take: 30 },
  })) as { data: ProductRow[] };

  // Preservar el orden de relevancia de Typesense (query.graph no lo respeta).
  let ordered = products;
  if (useTs) {
    const pos = new Map((orderedIds as string[]).map((id, i) => [id, i]));
    ordered = [...products].sort((a, b) => (pos.get(a.id) ?? 999) - (pos.get(b.id) ?? 999));
  }

  // Una fila por VARIANTE (no variants[0]): en un súper, 500 g y 1 kg son opciones
  // distintas y el cliente debe poder elegir. Con stock primero.
  const hits: WaProductHit[] = [];
  for (const p of ordered) {
    for (const v of p.variants ?? []) {
      hits.push({
        product_id: p.id,
        variant_id: v.id,
        product_title: p.title ?? '',
        variant_title: v.title ?? '',
        title: displayTitle(p.title, v.title),
        unit_price: v.calculated_price?.calculated_amount ?? null,
        in_stock: stockOf(v) > 0,
        image_url: p.thumbnail ?? null,
      });
    }
  }
  hits.sort((a, b) => Number(b.in_stock) - Number(a.in_stock));
  // Ocultar sin stock por defecto (evita frustración). Si TODO está sin stock,
  // se muestran igual (mejor ofrecer algo con la marca "sin stock" que nada).
  const inStock = hits.filter((h) => h.in_stock);
  const finalHits = inStock.length ? inStock : hits;
  return { hits: finalHits.slice(0, limit), ctx };
}

/**
 * Hidrata un conjunto de `variant_id` (los del borrador) con título y precio para
 * mostrar el carrito y calcular el subtotal.
 */
export async function hydrateWaVariants(
  container: MedusaContainer,
  variantIds: string[],
  ctx?: WaOrderContext,
): Promise<Map<string, { title: string; unit_price: number | null }>> {
  const out = new Map<string, { title: string; unit_price: number | null }>();
  if (variantIds.length === 0) return out;
  const resolved = ctx ?? (await resolveWaOrderContext(container));
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const priceContext = QueryContext({
    currency_code: resolved.currency_code,
    region_id: resolved.region_id,
  });
  const { data: variants } = (await query.graph({
    entity: 'product_variant',
    fields: [
      'id',
      'title',
      'product.title',
      'calculated_price.calculated_amount',
    ],
    filters: { id: variantIds },
    context: { calculated_price: priceContext },
  })) as { data: Array<{ id: string; title?: string; product?: { title?: string }; calculated_price?: { calculated_amount?: number } | null }> };
  for (const v of variants) {
    out.set(v.id, {
      title: displayTitle(v.product?.title, v.title),
      unit_price: v.calculated_price?.calculated_amount ?? null,
    });
  }
  return out;
}

export type WaVariantDetail = {
  title: string;
  unit_price: number | null;
  currency_code: string;
  image_url: string | null;
  handle: string | null;
  country_code: string;
};

/**
 * Detalle de una variante para mostrarla "en grande": título, precio, imagen y
 * handle (para armar el link a la ficha del producto en el storefront). Devuelve
 * null si no se encuentra.
 */
export async function getWaVariantDetail(
  container: MedusaContainer,
  variantId: string,
): Promise<WaVariantDetail | null> {
  const ctx = await resolveWaOrderContext(container);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const priceContext = QueryContext({
    currency_code: ctx.currency_code,
    region_id: ctx.region_id,
  });
  const { data: variants } = (await query.graph({
    entity: 'product_variant',
    fields: [
      'id',
      'title',
      'product.title',
      'product.handle',
      'product.thumbnail',
      'calculated_price.calculated_amount',
    ],
    filters: { id: variantId },
    context: { calculated_price: priceContext },
  })) as {
    data: Array<{
      id: string;
      title?: string;
      product?: { title?: string; handle?: string | null; thumbnail?: string | null };
      calculated_price?: { calculated_amount?: number } | null;
    }>;
  };
  const v = variants?.[0];
  if (!v) return null;
  return {
    title: displayTitle(v.product?.title, v.title),
    unit_price: v.calculated_price?.calculated_amount ?? null,
    currency_code: ctx.currency_code,
    image_url: v.product?.thumbnail ?? null,
    handle: v.product?.handle ?? null,
    country_code: ctx.country_code,
  };
}
