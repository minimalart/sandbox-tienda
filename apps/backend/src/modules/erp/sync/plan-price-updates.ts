import type { ErpCatalogRow } from '../adapters/types';
import type { ErpSyncLogItemStatus } from '../types';

/**
 * Clasificación PURA de los precios de un artículo del ERP (testeable sin
 * container): decide qué escribir en el precio base y en cada price list, o por
 * qué se descarta.
 *
 * Reglas:
 * - SKU repetido en Medusa → no se toca nada (igual que el stock sync).
 * - Artículo inactivo/no publicable con `only_published` → `not_published`.
 * - Variante sin price set vinculado → `no_price_set` (no hay dónde escribir).
 * - Precio igual al actual (a 2 decimales) → `price_unchanged`, cero writes.
 *
 * Los montos NO se transforman: `getCatalogChanges` ya entrega el precio final
 * (con IVA y en la moneda de la tienda) cuando el adapter declara
 * `catalog_prices_include_tax`. Si un ERP devolviera netos, la conversión se
 * hace acá con `tax_rate` de la fila — por eso `pricesIncludeTax` es un input.
 */

export type VariantCatalogEntry = {
  sku: string;
  /** IDs de variantes de Medusa con este SKU (>1 = catálogo roto). */
  variant_ids: string[];
  /** Price set de la variante (null = sin link, no se puede escribir precio). */
  price_set_id: string | null;
  product_id: string | null;
};

/** Precio existente en Medusa, ya normalizado a número. */
export type ExistingPrice = {
  id: string;
  amount: number;
};

export type PriceListTarget = {
  /** Índice de lista en el ERP. */
  zeus_index: number;
  /** ID de la price list de Medusa (ya resuelta/creada). */
  price_list_id: string;
  title: string;
};

/** Una escritura de precio pendiente. */
export type PriceWrite =
  | {
      kind: 'base';
      price_set_id: string;
      currency_code: string;
      amount: number;
    }
  | {
      kind: 'price_list_update';
      price_list_id: string;
      /** ID de la fila de `price` existente. */
      price_id: string;
      amount: number;
    }
  | {
      kind: 'price_list_create';
      price_list_id: string;
      variant_id: string;
      currency_code: string;
      amount: number;
    };

export type PricePlan = {
  status: ErpSyncLogItemStatus;
  /** Vacío cuando no hay nada que escribir. */
  writes: PriceWrite[];
  /** Producto a reindexar en Typesense si hubo cambios. */
  product_id?: string | null;
  /** Se persiste sanitizado como `response_payload` del log item. */
  response_payload: Record<string, unknown>;
  error?: string;
};

/** Redondeo a 2 decimales para comparar: `amount` vuelve como string de bigNumber. */
export function roundAmount(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Convierte el precio del ERP al monto a guardar en Medusa. */
function resolveAmount(
  raw: number,
  taxRatePct: number | null,
  pricesIncludeTax: boolean
): number | null {
  if (!Number.isFinite(raw) || raw <= 0) return null;
  if (pricesIncludeTax) return roundAmount(raw);
  // El ERP devolvió neto: se le suma la alícuota del artículo para que el
  // storefront muestre el precio final.
  const rate = typeof taxRatePct === 'number' && taxRatePct >= 0 ? taxRatePct / 100 : 0;
  return roundAmount(raw * (1 + rate));
}

export function planPriceUpdate(input: {
  row: ErpCatalogRow;
  entry: VariantCatalogEntry | undefined;
  currencyCode: string;
  baseListIndex: number;
  priceLists: PriceListTarget[];
  /** Precio base actual (fila sin reglas ni min_quantity) de esa moneda. */
  currentBase: ExistingPrice | null;
  /** Precio actual por price list, indexado por `price_list_id`. */
  currentByPriceList: Map<string, ExistingPrice>;
  onlyPublished: boolean;
  pricesIncludeTax: boolean;
}): PricePlan {
  const {
    row,
    entry,
    currencyCode,
    baseListIndex,
    priceLists,
    currentBase,
    currentByPriceList,
    onlyPublished,
    pricesIncludeTax,
  } = input;

  if (!entry) {
    return {
      status: 'variant_not_found',
      writes: [],
      response_payload: { erp_code: row.code },
    };
  }

  if (entry.variant_ids.length > 1) {
    return {
      status: 'duplicate_sku',
      writes: [],
      error: `SKU repetido en ${entry.variant_ids.length} variantes de Medusa; no se actualizan precios.`,
      response_payload: { variant_ids: entry.variant_ids },
    };
  }

  if (onlyPublished && (!row.active || !row.published)) {
    return {
      status: 'not_published',
      writes: [],
      response_payload: { active: row.active, published: row.published },
    };
  }

  const rawBase = row.prices[baseListIndex];
  if (rawBase === null || rawBase === undefined) {
    return {
      status: 'skipped',
      writes: [],
      response_payload: { reason: 'no_base_price', base_list_index: baseListIndex },
    };
  }

  const baseAmount = resolveAmount(rawBase, row.tax_rate, pricesIncludeTax);
  if (baseAmount === null) {
    return {
      status: 'invalid_quantity',
      writes: [],
      error: `Precio inválido recibido del ERP para la lista ${baseListIndex}: ${JSON.stringify(rawBase)}`,
      response_payload: { erp_price: rawBase, base_list_index: baseListIndex },
    };
  }

  if (!entry.price_set_id) {
    return {
      status: 'no_price_set',
      writes: [],
      error: 'La variante no tiene price set vinculado; no se puede escribir el precio.',
      response_payload: { variant_id: entry.variant_ids[0], erp_price: baseAmount },
    };
  }

  const writes: PriceWrite[] = [];
  const detail: Record<string, unknown> = {
    erp_code: row.code,
    variant_id: entry.variant_ids[0],
    tax_rate: row.tax_rate,
    base: { list_index: baseListIndex, amount: baseAmount, previous: currentBase?.amount ?? null },
  };

  if (!currentBase || roundAmount(currentBase.amount) !== baseAmount) {
    writes.push({
      kind: 'base',
      price_set_id: entry.price_set_id,
      currency_code: currencyCode,
      amount: baseAmount,
    });
  }

  const listDetail: Array<Record<string, unknown>> = [];
  for (const target of priceLists) {
    const rawList = row.prices[target.zeus_index];
    const current = currentByPriceList.get(target.price_list_id) ?? null;

    if (rawList === null || rawList === undefined) {
      // La lista no aplica a este artículo. No se borra la fila existente: un 0
      // de Zeus significa "sin precio en esa lista", y borrar dejaría al cliente
      // comprando al precio base sin querer. Queda registrado.
      listDetail.push({
        list_index: target.zeus_index,
        title: target.title,
        skipped: 'no_price_in_erp',
        kept: current?.amount ?? null,
      });
      continue;
    }

    const amount = resolveAmount(rawList, row.tax_rate, pricesIncludeTax);
    if (amount === null) {
      listDetail.push({
        list_index: target.zeus_index,
        title: target.title,
        skipped: 'invalid_price',
        erp_price: rawList,
      });
      continue;
    }

    if (!current) {
      writes.push({
        kind: 'price_list_create',
        price_list_id: target.price_list_id,
        variant_id: entry.variant_ids[0]!,
        currency_code: currencyCode,
        amount,
      });
      listDetail.push({ list_index: target.zeus_index, title: target.title, created: amount });
    } else if (roundAmount(current.amount) !== amount) {
      writes.push({
        kind: 'price_list_update',
        price_list_id: target.price_list_id,
        price_id: current.id,
        amount,
      });
      listDetail.push({
        list_index: target.zeus_index,
        title: target.title,
        amount,
        previous: current.amount,
      });
    } else {
      listDetail.push({ list_index: target.zeus_index, title: target.title, unchanged: amount });
    }
  }
  if (listDetail.length) detail.price_lists = listDetail;

  if (!writes.length) {
    return {
      status: 'price_unchanged',
      writes: [],
      product_id: entry.product_id,
      response_payload: detail,
    };
  }

  return {
    status: 'updated',
    writes,
    product_id: entry.product_id,
    response_payload: detail,
  };
}
