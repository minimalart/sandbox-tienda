import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { QueryContext } from '@medusajs/utils';
import type { MedusaContainer } from '@medusajs/framework/types';
import { salesChannelProductIds } from '../catalog/channel-products';
import { resolveWaOrderContext, type WaOrderContext } from './order-context';
import { TYPESENSE } from '../../modules/typesense';
import { buildCatalogFilterBy, catalogSortBy, type WaCatalogFilter } from './flow/catalog-filter';
import { groupHitsByProduct } from './group-hits';

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
  /**
   * Handle del producto, para armar el link a su ficha.
   *
   * No lo usa el carrusel —la tarjeta lleva un botón "Agregar", no un link— sino
   * el RESULTADO que lee el modelo. Sin esto el agente no recibía ni un link en
   * ningún turno, así que cada vez que prometía "te paso el link" mentía por
   * construcción (DESDEELSUR-72, TC-001/002/006).
   */
  handle: string | null;
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
type ProductRow = { id: string; title?: string; handle?: string | null; thumbnail?: string | null; variants?: VariantRow[] };

/** Títulos de variante "placeholder" que no aportan info (no se muestran al cliente). */
/** El tope de filas de una lista de WhatsApp. Se repite para no atar este
 * módulo —que es del catálogo— al del grafo. */
const WA_LIMITS_LIST_ROWS = 10;

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
 * Los productos que cumplen un filtro declarativo (categoría, precio, promoción…).
 *
 * No hay `q`: el paso no busca lo que el cliente escribió, muestra una SELECCIÓN. Por
 * eso `q: '*'`, que en Typesense es "traeme todo lo que pase el filtro", y por eso el
 * orden puede ser por precio sin pisar ninguna relevancia — no hay ninguna que pisar.
 *
 * Devuelve ids de producto, que es lo que `hydrateWaProductIds` sabe convertir en
 * filas con precio calculado y stock real. El índice no se usa nunca para el precio ni
 * para el stock: ahí puede estar desactualizado, y ofrecer un precio viejo es el error
 * más caro que puede cometer el bot.
 */
export async function waFilteredProductIds(
  container: MedusaContainer,
  filter: WaCatalogFilter,
  salesChannelIds: string[],
  limit = 30,
): Promise<string[]> {
  try {
    const ts = container.resolve(TYPESENSE) as {
      search: (p: Record<string, unknown>) => Promise<{ hits?: Array<{ document?: { id?: string } }> }>;
    };
    const sort = catalogSortBy(filter);
    const resp = await ts.search({
      q: '*',
      query_by: 'title',
      per_page: Math.min(Math.max(limit, 1), 100),
      filter_by: buildCatalogFilterBy(filter, salesChannelIds),
      ...(sort ? { sort_by: sort } : {}),
    });
    return (resp?.hits ?? []).map((h) => h?.document?.id).filter(Boolean) as string[];
  } catch {
    // Sin Typesense no hay filtro por catálogo: el paso queda vacío y lo dice, en vez
    // de caer a una consulta a Medusa que no sabría resolver categorías ni promociones.
    return [];
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
  // Mismo techo que la búsqueda y por lo mismo: cada fila es una variante, así que
  // quien vaya a agrupar por producto necesita pedir de más.
  const limit = Math.min(Math.max(Number(opts.limit) || 5, 1), 50);
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
      'handle',
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
        handle: p.handle ?? null,
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
  /**
   * El techo es 50 y no 10 porque el caller puede querer AGRUPAR después: cada fila es
   * una variante, así que para quedarse con diez productos distintos hay que pedir
   * bastantes más. Lo que se le muestra al cliente lo recorta quien llama, que es el
   * único que sabe si va a agrupar.
   */
  const limit = Math.min(Math.max(Number(opts.limit) || 8, 1), 50);
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
      'handle',
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
        handle: p.handle ?? null,
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

/** Una presentación comprable, con la forma que espera `optionsFrom` del recorrido. */
export type WaPresentationOption = {
  /** El `variant_id`: lo que el cliente elija sirve directo para agregar al carrito. */
  value: string;
  label: string;
  description?: string;
};

/**
 * El precio como lo lee el cliente en WhatsApp.
 *
 * Vive acá, y no dentro de la tool, porque la PRUEBA del editor tiene que mostrar el
 * mismo texto: si cada lado formatea por su cuenta, la prueba deja de probar.
 */
export function waMoney(amount: number | null | undefined, currency: string): string {
  if (amount == null) return 's/precio';
  const n = Number(amount);
  if (!Number.isFinite(n)) return 's/precio';
  return `$${new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} ${currency.toUpperCase()}`;
}

/**
 * Las opciones que una búsqueda deja en `vars` para el `ask_list` que sigue.
 *
 * Misma razón que `waMoney`, y más fuerte: el simulador no ejecuta la acción, pero sí
 * corre la búsqueda —que es de sólo lectura— y escribe el resultado en el `vars` de
 * la sesión, así el paso siguiente muestra los productos DE VERDAD en vez de salir
 * vacío. Si esta lista se armara dos veces, el operador probaría una cosa y
 * publicaría otra.
 *
 * Se espera recibir los hits YA AGRUPADOS por producto (`groupHitsByProduct`): una
 * opción por variante repetiría el mismo balde cuatro veces.
 */
export function waHitsToOptions(
  hits: readonly WaProductHit[],
  currencyCode: string,
): WaPresentationOption[] {
  return hits.map((h) => ({
    value: h.variant_id,
    label: `${h.title} · ${waMoney(h.unit_price, currencyCode)}`,
    ...(h.in_stock ? {} : { description: 'Sin stock' }),
  }));
}

/**
 * Las presentaciones comprables de un producto (1 L, 4 L, 20 L…), listas para que
 * un `ask_list` del recorrido las ofrezca.
 *
 * Se entra por `variantId` —la variante que el cliente acaba de tocar— o por
 * `productId`. Reusa `hydrateWaProductIds`, que ya devuelve UNA fila por variante
 * comprable con precio calculado y stock real contra Medusa, así que no hay una
 * segunda definición de "qué es comprable" que se pueda ir desincronizando.
 *
 * Las que no tienen stock van AL FINAL y marcadas, no se esconden: con una sola
 * presentación sin stock, ocultarla dejaría la pregunta vacía y el recorrido mudo.
 */
export async function listWaProductPresentations(
  container: MedusaContainer,
  opts: { variantId?: string; productId?: string; limit?: number },
): Promise<WaPresentationOption[]> {
  const ctx = await resolveWaOrderContext(container);
  let productId = opts.productId;

  if (!productId && opts.variantId) {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data } = (await query.graph({
      entity: 'product_variant',
      fields: ['id', 'product.id'],
      filters: { id: opts.variantId },
    })) as { data: Array<{ product?: { id?: string } }> };
    productId = data?.[0]?.product?.id;
  }
  if (!productId) return [];

  const { hits } = await hydrateWaProductIds(container, [productId], {
    limit: opts.limit ?? WA_LIMITS_LIST_ROWS,
    ctx,
  });

  const money = (cents: number | null): string =>
    cents === null ? 'sin precio' : `$${Math.round(cents).toLocaleString('es-AR')}`;

  const ordered = [...hits].sort((a, b) => Number(b.in_stock) - Number(a.in_stock));
  return ordered.map((h) => ({
    value: h.variant_id,
    // El título del producto ya lo dijo el paso anterior; acá interesa la variante.
    label: `${h.variant_title || h.product_title} · ${money(h.unit_price)}`,
    ...(h.in_stock ? {} : { description: 'Sin stock' }),
  }));
}

/**
 * Los productos que el operador ELIGIÓ A MANO para un paso del recorrido, ya
 * resueltos a opciones comprables.
 *
 * Es la cuarta forma de llenar una lista, y la única que no sale de una consulta:
 * la búsqueda por texto usa Typesense, el asesor usa facetas, y
 * `listWaProductPresentations` deriva del producto elegido. Pero el documento pide
 * "{{producto recomendado 1/2/3}}", y eso es una decisión comercial — no hay
 * relevancia que la calcule.
 *
 * DOS COSAS QUE NO SON OBVIAS:
 *
 * 1. Se respeta el ORDEN en que el operador los acomodó. `hydrateWaProductIds` ya
 *    restaura el orden de los ids que recibe, así que alcanza con no re-ordenar
 *    después — y por eso acá NO se ordena por stock como en las presentaciones:
 *    si alguien puso el recomendado primero, va primero.
 *
 * 2. El canal de venta SIGUE MANDANDO. Fijar un producto a mano es curación, no un
 *    permiso: `hydrateWaProductIds` scopea contra el catálogo y `wa_add_to_cart`
 *    vuelve a chequear el canal en `getWaVariantDetail`. Un producto fijado que no
 *    esté en el canal del bot se mostraría y no se podría comprar, así que se
 *    filtra ACÁ y el operador no lo ve aparecer.
 */
export async function listWaPinnedProducts(
  container: MedusaContainer,
  productIds: string[],
  opts: { limit?: number; ctx?: WaOrderContext } = {},
): Promise<WaPresentationOption[]> {
  const ids = productIds.map((id) => String(id ?? '').trim()).filter(Boolean);
  if (ids.length === 0) return [];

  // `ctx` inyectable por el mismo motivo que en `getWaVariantDetail`: resolverlo
  // adentro ata el test a levantar media tienda para probar una regla de filtrado.
  const ctx = opts.ctx ?? (await resolveWaOrderContext(container));
  const tope = opts.limit ?? WA_LIMITS_LIST_ROWS;
  // Se hidrata de más para poder agrupar: si cada producto tiene cuatro
  // presentaciones, pedir diez filas alcanza para dos productos y medio.
  const { hits } = await hydrateWaProductIds(container, ids, {
    limit: Math.min(ids.length * 5, 50),
    ctx,
  });

  // Sólo lo que el bot puede vender. Un producto fuera del canal se muestra y
  // después rebota en el carrito: mejor que no aparezca.
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data: rows } = (await query.graph({
    entity: 'product',
    fields: ['id', 'sales_channels.id'],
    filters: { id: [...new Set(hits.map((h) => h.product_id))] },
  })) as { data: Array<{ id: string; sales_channels?: Array<{ id?: string }> | null }> };
  const vendible = new Set(
    rows
      .filter((r) => isInBotChannels((r.sales_channels ?? []).map((c) => c?.id), ctx.sales_channel_ids))
      .map((r) => r.id),
  );

  const money = (cents: number | null): string =>
    cents === null ? 'sin precio' : `$${Math.round(cents).toLocaleString('es-AR')}`;

  /**
   * UNA opción por PRODUCTO. Sin agrupar, un producto con cuatro presentaciones se
   * come cuatro de las diez filas que acepta WhatsApp y el cliente ve el mismo nombre
   * repetido. La presentación se elige en el paso siguiente, que es para lo que existe
   * "Buscar las presentaciones de un producto".
   */
  return groupHitsByProduct(hits.filter((h) => vendible.has(h.product_id)))
    .slice(0, tope)
    .map((h) => ({
      value: h.variant_id,
      // Acá SÍ va el título del producto: el cliente todavía no lo eligió.
      label: `${h.title} · ${money(h.unit_price)}`,
      ...(h.in_stock ? {} : { description: 'Sin stock' }),
    }));
}

/**
 * Los productos que cumplen un filtro, listos para ofrecer.
 *
 * Se apoya en `listWaPinnedProducts` a propósito: una vez resueltos los ids, elegirlos
 * a mano o por filtro es exactamente el mismo problema —hidratar, chequear canal,
 * agrupar por producto y armar la etiqueta— y tener dos caminos para eso garantiza que
 * uno de los dos quede atrás.
 */
export async function listWaFilteredProducts(
  container: MedusaContainer,
  filter: WaCatalogFilter,
  opts: { limit?: number; ctx?: WaOrderContext } = {},
): Promise<WaPresentationOption[]> {
  const ctx = opts.ctx ?? (await resolveWaOrderContext(container));
  const ids = await waFilteredProductIds(container, filter, ctx.sales_channel_ids, 30);
  if (ids.length === 0) return [];
  return listWaPinnedProducts(container, ids, { limit: opts.limit, ctx });
}

/**
 * ACEPTAR UN PRODUCTO DONDE SE PIDE UNA VARIANTE.
 *
 * El editor deja elegir PRODUCTOS, que es como piensa el operador: nadie arma un
 * recorrido decidiendo que muestre "Látex interior 4 L" en vez de "Látex interior".
 * Las tools, en cambio, necesitan una variante — es lo que se agrega a un carrito.
 *
 * La traducción se hace ACÁ y en cada turno, no al guardar el recorrido. Si se
 * resolviera al guardar, el paso quedaría clavado a una variante concreta: se
 * discontinúa esa presentación y el paso deja de funcionar sin que nadie toque nada.
 * Resolviendo en vivo, el recorrido dice "este producto" y siempre apunta a una
 * variante que existe hoy.
 *
 * El prefijo del id es el discriminador (`prod_` contra `variant_`), que es la
 * convención de Medusa y no una heurística nuestra.
 */
export async function resolveWaVariantId(
  container: MedusaContainer,
  id: string,
  opts: { ctx?: WaOrderContext } = {},
): Promise<string | null> {
  const limpio = String(id ?? '').trim();
  if (!limpio) return null;
  if (!limpio.startsWith('prod_')) return limpio;

  const { hits } = await hydrateWaProductIds(container, [limpio], { limit: 50, ctx: opts.ctx });
  // La misma representante que ve el cliente en el carrusel: con stock si hay alguna.
  return groupHitsByProduct(hits)[0]?.variant_id ?? null;
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
 * ¿Este producto lo atiende el bot?
 *
 * El canal de venta es LO QUE ELIGE qué se vende por chat: se arma un canal para
 * WhatsApp, se le asignan los productos y se lo elige en Admin → WhatsApp →
 * Ajustes. Lo que no esté en ninguno de esos canales no se muestra y no se compra.
 *
 * Está separada de la consulta a propósito: es la regla, y siendo pura se puede
 * afirmar en un test sin levantar Medusa.
 *
 * Sin canales configurados devuelve `false` y no `true`: un contexto que no pudo
 * resolver sus canales tiene que CERRAR la puerta. Abrirla "porque no sé" es
 * exactamente cómo el gate de promociones falló abierto.
 */
export function isInBotChannels(
  productChannelIds: Array<string | null | undefined>,
  botChannelIds: string[],
): boolean {
  if (botChannelIds.length === 0) return false;
  const allowed = new Set(botChannelIds);
  return productChannelIds.some((id) => typeof id === 'string' && allowed.has(id));
}

/**
 * Detalle de una variante para mostrarla "en grande": título, precio, imagen y
 * handle (para armar el link a la ficha del producto en el storefront).
 *
 * Devuelve null si no se encuentra O SI EL PRODUCTO NO ESTÁ EN LOS CANALES DEL
 * BOT. Esto último es el gate de compra, y no es una precaución teórica: es la
 * única puerta que mira `wa_add_to_cart` antes de agregar, y filtraba nada más que
 * por id. La vidriera ya estaba acotada —`searchWaProducts` y el asesor guiado
 * filtran por canal— pero el `variant_id` llega en el TAP DEL CLIENTE, y un
 * carrusel viejo que quedó arriba en la conversación sigue siendo un botón vivo:
 * se tocaba y entraba al carrito aunque el producto ya no estuviera en el canal.
 * Que un producto APAREZCA y que se pueda COMPRAR son dos chequeos distintos.
 */
export async function getWaVariantDetail(
  container: MedusaContainer,
  variantId: string,
  opts: { ctx?: WaOrderContext } = {},
): Promise<WaVariantDetail | null> {
  const ctx = opts.ctx ?? (await resolveWaOrderContext(container));
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
      // Se pide acá y no con una segunda consulta: `query.graph` no filtra
      // `product_variant` por el canal del producto, así que el scope se resuelve
      // sobre la fila que ya vino.
      'product.sales_channels.id',
      'calculated_price.calculated_amount',
    ],
    filters: { id: variantId },
    context: { calculated_price: priceContext },
  })) as {
    data: Array<{
      id: string;
      title?: string;
      product?: {
        title?: string;
        handle?: string | null;
        thumbnail?: string | null;
        sales_channels?: Array<{ id?: string }> | null;
      };
      calculated_price?: { calculated_amount?: number } | null;
    }>;
  };
  const v = variants?.[0];
  if (!v) return null;
  const channelIds = (v.product?.sales_channels ?? []).map((c) => c?.id);
  if (!isInBotChannels(channelIds, ctx.sales_channel_ids)) return null;
  return {
    title: displayTitle(v.product?.title, v.title),
    unit_price: v.calculated_price?.calculated_amount ?? null,
    currency_code: ctx.currency_code,
    image_url: v.product?.thumbnail ?? null,
    handle: v.product?.handle ?? null,
    country_code: ctx.country_code,
  };
}
