import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import {
  linkProductsToSalesChannelWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from '@medusajs/medusa/core-flows';
import type { PersistResult } from '../demo-store/persist';

/**
 * Origen de catálogo `sales_channel`: la demo toma los productos de un canal que
 * YA existe en esta instancia.
 *
 * CAMINO NORMAL (desde el fix del canal duplicado): la demo ADOPTA el canal de
 * origen como propio, así que no hay nada que vincular — el catálogo ya está donde
 * tiene que estar. Ese caso lo cubre `countAdoptedChannelProducts`, que solo mide
 * el catálogo para el log del import.
 *
 * `linkFromSalesChannel` queda para las demos creadas ANTES de ese fix, que tienen
 * un canal propio además del de origen: ahí los productos existentes se VINCULAN al
 * canal de la demo (nunca se clonan). Clonarlos sería peor por dos razones
 * concretas:
 *
 *  - El `sku` de variante es único en Medusa, así que un clon obligaría a
 *    mutilar los SKUs (perdiendo la trazabilidad contra el ERP o la fuente).
 *  - Duplicaría miles de productos, precios e items de inventario para mostrar
 *    exactamente el mismo catálogo.
 *
 * La contracara, que hay que tener presente: los productos quedan COMPARTIDOS.
 * Editar uno desde la demo lo cambia también en el canal de origen. Para una demo
 * que justamente busca espejar una tienda existente, eso es lo deseable.
 *
 * INVENTARIO: vincular productos no alcanza. Medusa resuelve la disponibilidad
 * por canal → stock location → nivel, y los niveles viven en las ubicaciones del
 * canal de ORIGEN. La demo se provisiona con una stock location propia y VACÍA,
 * así que un producto con `manage_inventory: true` quedaba imposible de comprar:
 * el add-to-cart moría con "Sales channel ... is not associated with any stock
 * location for variant ...". Por eso acá también se vincula el canal de la demo a
 * las stock locations del origen: la disponibilidad resuelve sola y no se duplica
 * un solo nivel de stock.
 */

/** Página al leer productos del canal de origen. */
const READ_PAGE = 200;
/** Productos por llamada al workflow de vinculación. */
const LINK_BATCH = 200;

export type LinkFromSalesChannelInput = {
  /** Canal de origen (de dónde salen los productos). */
  sourceSalesChannelId: string;
  /** Canal de la demo (a dónde se vinculan). */
  targetSalesChannelId: string;
  /** Moneda de la demo, para avisar si los productos no tienen precio en ella. */
  currencyCode: string;
  /** Tope de productos a vincular; `null` = todo el canal de origen. */
  targetCount?: number | null;
  onProgress?: (progress: { total: number; linked: number }) => Promise<void> | void;
  logger?: { info: (msg: string) => void; warn: (msg: string) => void };
};

export type LinkFromSalesChannelResult = PersistResult & {
  /** Productos del canal de origen encontrados (antes de aplicar el tope). */
  sourceProducts: number;
  /** Ya estaban vinculados al canal de la demo (re-import). */
  alreadyLinked: number;
  /** Vinculados que NO tienen precio en la moneda de la demo. */
  withoutPriceInCurrency: number;
  /** Stock locations del origen que quedaron vinculadas al canal de la demo. */
  stockLocationsLinked: number;
};

/** Fila de producto que necesita la clasificación (subconjunto de lo que trae query.graph). */
export type ChannelProductRow = {
  id: string;
  sales_channels?: Array<{ id: string } | null> | null;
  variants?: Array<{
    prices?: Array<{ currency_code?: string | null; amount?: unknown }> | null;
  } | null> | null;
};

export type ChannelProductVerdict = {
  /** Pertenece al canal de origen (si no, se ignora por completo). */
  inSource: boolean;
  /** Ya está vinculado al canal de la demo. */
  alreadyLinked: boolean;
  /** Tiene al menos un precio > 0 en la moneda de la demo. */
  hasPriceInCurrency: boolean;
};

/**
 * Decisión PURA por producto (testeable sin container). Se mantiene por fila en
 * lugar de acumular todo el catálogo en memoria: el import de demos ya se quedó
 * sin memoria una vez por materializar el catálogo completo en la caja de 2 GB.
 */
export function classifyChannelProduct(
  row: ChannelProductRow,
  opts: { sourceSalesChannelId: string; targetSalesChannelId: string; currencyCode: string }
): ChannelProductVerdict {
  const channels = (row.sales_channels ?? [])
    .map((channel) => channel?.id)
    .filter((id): id is string => Boolean(id));
  const currency = opts.currencyCode.toLowerCase();

  return {
    inSource: channels.includes(opts.sourceSalesChannelId),
    alreadyLinked: channels.includes(opts.targetSalesChannelId),
    hasPriceInCurrency: (row.variants ?? []).some((variant) =>
      (variant?.prices ?? []).some(
        (price) => price?.currency_code?.toLowerCase() === currency && Number(price.amount) > 0
      )
    ),
  };
}

/**
 * Canal ADOPTADO: la demo ES el canal de origen, así que no se vincula ni se crea
 * nada — solo se mide el catálogo para que el import quede con números en el log.
 *
 * Se pagina y se cuenta por fila (sin acumular el catálogo en memoria) por lo mismo
 * que el resto del módulo: materializar el catálogo completo ya se comió la caja de
 * 2 GB una vez.
 */
export async function countAdoptedChannelProducts(
  container: any,
  input: {
    salesChannelId: string;
    currencyCode: string;
    logger?: { info: (msg: string) => void; warn: (msg: string) => void };
  }
): Promise<LinkFromSalesChannelResult> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const currency = input.currencyCode.toLowerCase();
  let products = 0;
  let withoutPriceInCurrency = 0;

  for (let offset = 0; ; offset += READ_PAGE) {
    const { data } = await query.graph({
      entity: 'product',
      fields: [
        'id',
        'sales_channels.id',
        'variants.prices.currency_code',
        'variants.prices.amount',
      ],
      pagination: { skip: offset, take: READ_PAGE, order: { id: 'ASC' } },
    });
    const rows = (data ?? []) as ChannelProductRow[];
    if (!rows.length) break;

    for (const product of rows) {
      // Origen y destino son el mismo canal: `inSource` y `alreadyLinked` cuentan
      // lo mismo, y lo único que agrega valor es el precio en la moneda de la demo.
      const verdict = classifyChannelProduct(product, {
        sourceSalesChannelId: input.salesChannelId,
        targetSalesChannelId: input.salesChannelId,
        currencyCode: currency,
      });
      if (!verdict.inSource) continue;
      products++;
      if (!verdict.hasPriceInCurrency) withoutPriceInCurrency++;
    }

    if (rows.length < READ_PAGE) break;
  }

  input.logger?.info(
    `La demo usa el canal de origen tal cual (${products} productos, sin duplicar el canal ni los productos).`
  );
  if (withoutPriceInCurrency > 0) {
    input.logger?.warn(
      `${withoutPriceInCurrency} de los ${products} productos del canal no tienen precio en ` +
        `${currency.toUpperCase()}; esos no se van a poder comprar en la demo hasta que se les cargue.`
    );
  }

  return {
    created: 0,
    failed: 0,
    skipped: 0,
    skippedReasons: {},
    // Nada que vincular: el canal ya trae su catálogo.
    linkedExisting: 0,
    recreated: 0,
    linkedBrands: 0,
    categories: 0,
    errors: [],
    sourceProducts: products,
    alreadyLinked: products,
    withoutPriceInCurrency,
    stockLocationsLinked: 0,
  };
}

/**
 * Vincula el canal de la demo a las stock locations del canal de origen, para que
 * la disponibilidad de los productos vinculados resuelva sin duplicar niveles.
 *
 * Idempotente: solo agrega las ubicaciones que al canal de la demo le faltan, así
 * que un re-import no vuelve a pedir links existentes. No lanza: si esto falla la
 * demo sigue sirviendo el catálogo, solo que los productos con inventario
 * gestionado van a aparecer sin stock — se avisa por el log del import.
 */
async function linkSourceStockLocations(
  container: any,
  input: {
    sourceSalesChannelId: string;
    targetSalesChannelId: string;
    logger?: { info: (msg: string) => void; warn: (msg: string) => void };
  }
): Promise<number> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  type ChannelRow = { id: string; stock_locations?: Array<{ id: string } | null> | null };

  const locationsOf = async (salesChannelId: string): Promise<string[]> => {
    const { data } = await query.graph({
      entity: 'sales_channel',
      fields: ['id', 'stock_locations.id'],
      filters: { id: salesChannelId },
    });
    const row = ((data ?? []) as ChannelRow[])[0];
    return (row?.stock_locations ?? [])
      .map((location) => location?.id)
      .filter((id): id is string => Boolean(id));
  };

  let sourceLocations: string[];
  let targetLocations: string[];
  try {
    [sourceLocations, targetLocations] = await Promise.all([
      locationsOf(input.sourceSalesChannelId),
      locationsOf(input.targetSalesChannelId),
    ]);
  } catch (err) {
    input.logger?.warn(
      `No se pudieron leer las stock locations del canal de origen: ${(err as Error).message}. ` +
        'Los productos con inventario gestionado van a aparecer sin stock en la demo.'
    );
    return 0;
  }

  if (!sourceLocations.length) {
    input.logger?.warn(
      'El canal de origen no tiene ninguna stock location vinculada, así que no hay inventario que ' +
        'heredar: los productos con inventario gestionado van a aparecer sin stock en la demo.'
    );
    return 0;
  }

  const already = new Set(targetLocations);
  const missing = sourceLocations.filter((id) => !already.has(id));
  if (!missing.length) {
    input.logger?.info(
      `El canal de la demo ya comparte las ${sourceLocations.length} stock location(s) del origen.`
    );
    return 0;
  }

  let linked = 0;
  for (const locationId of missing) {
    try {
      await linkSalesChannelsToStockLocationWorkflow(container).run({
        input: { id: locationId, add: [input.targetSalesChannelId], remove: [] },
      });
      linked++;
    } catch (err) {
      input.logger?.warn(
        `No se pudo vincular la stock location ${locationId} al canal de la demo: ${(err as Error).message}`
      );
    }
  }
  input.logger?.info(
    `Stock: el canal de la demo quedó vinculado a ${linked}/${missing.length} stock location(s) del origen.`
  );
  return linked;
}

export async function linkFromSalesChannel(
  container: any,
  input: LinkFromSalesChannelInput
): Promise<LinkFromSalesChannelResult> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const logger = input.logger;
  const currency = input.currencyCode.toLowerCase();
  const limit =
    Number.isFinite(input.targetCount) && input.targetCount && input.targetCount > 0
      ? Math.floor(input.targetCount)
      : null;

  if (input.sourceSalesChannelId === input.targetSalesChannelId) {
    throw new Error('El canal de origen y el de la demo son el mismo; elegí otro canal.');
  }

  // ── Leer los productos del canal de origen ─────────────────────────────────
  // `sales_channel_id` sí filtra en la API de productos, pero query.graph NO
  // filtra por canal (solo permite SELECCIONAR los ids), así que se pagina y se
  // filtra en memoria — el mismo patrón que usa `salesChannelHasProducts`.
  const toLink: string[] = [];
  let sourceProducts = 0;
  let alreadyLinked = 0;
  let withoutPriceInCurrency = 0;

  for (let offset = 0; ; offset += READ_PAGE) {
    const { data } = await query.graph({
      entity: 'product',
      fields: [
        'id',
        'sales_channels.id',
        'variants.prices.currency_code',
        'variants.prices.amount',
      ],
      pagination: { skip: offset, take: READ_PAGE, order: { id: 'ASC' } },
    });
    const rows = (data ?? []) as ChannelProductRow[];
    if (!rows.length) break;

    for (const product of rows) {
      const verdict = classifyChannelProduct(product, {
        sourceSalesChannelId: input.sourceSalesChannelId,
        targetSalesChannelId: input.targetSalesChannelId,
        currencyCode: currency,
      });
      if (!verdict.inSource) continue;

      sourceProducts++;
      if (verdict.alreadyLinked) {
        alreadyLinked++;
        continue;
      }
      if (limit !== null && toLink.length >= limit) continue;

      if (!verdict.hasPriceInCurrency) withoutPriceInCurrency++;
      toLink.push(product.id);
    }

    if (rows.length < READ_PAGE) break;
  }

  logger?.info(
    `Canal de origen: ${sourceProducts} productos (${alreadyLinked} ya vinculados, ${toLink.length} a vincular` +
      `${limit !== null ? `, tope ${limit}` : ''}).`
  );

  if (withoutPriceInCurrency > 0) {
    logger?.warn(
      `${withoutPriceInCurrency} de los ${toLink.length} productos a vincular no tienen precio en ${currency.toUpperCase()}; ` +
        'esos no se van a poder comprar en la demo hasta que se les cargue precio en esa moneda.'
    );
  }

  // ── Vincular al canal de la demo ───────────────────────────────────────────
  let linked = 0;
  const errors: string[] = [];
  for (let index = 0; index < toLink.length; index += LINK_BATCH) {
    const add = toLink.slice(index, index + LINK_BATCH);
    try {
      await linkProductsToSalesChannelWorkflow(container).run({
        input: { id: input.targetSalesChannelId, add, remove: [] },
      });
      linked += add.length;
    } catch (err) {
      // Una tanda que falla no aborta el resto: se registra y se sigue, igual que
      // hace `persistProducts`.
      if (errors.length < 25) errors.push(`link@${index}: ${(err as Error).message}`);
    }
    await input.onProgress?.({ total: toLink.length, linked });
  }

  logger?.info(`Vinculados ${linked}/${toLink.length} productos al canal de la demo.`);

  // Inventario: sin esto, los productos con `manage_inventory: true` quedan sin
  // disponibilidad en la demo y el add-to-cart falla.
  const stockLocationsLinked = await linkSourceStockLocations(container, {
    sourceSalesChannelId: input.sourceSalesChannelId,
    targetSalesChannelId: input.targetSalesChannelId,
    logger,
  });

  return {
    // No se crea, borra ni saltea nada: este origen solo vincula.
    created: 0,
    failed: toLink.length - linked,
    skipped: 0,
    skippedReasons: {},
    linkedExisting: linked,
    recreated: 0,
    linkedBrands: 0,
    categories: 0,
    errors,
    sourceProducts,
    alreadyLinked,
    withoutPriceInCurrency,
    stockLocationsLinked,
  };
}
