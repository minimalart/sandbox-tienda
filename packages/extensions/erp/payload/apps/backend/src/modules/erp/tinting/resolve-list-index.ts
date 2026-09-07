import { DEFAULT_CATALOG_SYNC_SETTINGS } from '../types';
import type { ErpConfigSettings } from '../types';

/**
 * Qué lista del ERP usar para cotizar un entonado.
 *
 * MEDIDO: el parámetro `lista` de `formulaTintometrico` es EXACTAMENTE el mismo
 * índice que `precioN` del artículo. Con la base 113: lista 1/2/3 devuelven
 * 66352.822 y lista 4 devuelve 46446.975, o sea el mismo ratio 0.700000 que
 * `precio4/precio1` en el catálogo; las listas sin precio devuelven `total: 0.0`.
 *
 * Por eso NO hace falta un mapeo nuevo: se reusa el que ya tiene el catalog sync
 * y el mayorista cotiza el entonado con su misma lista automáticamente.
 */
export type ResolvedTintingListIndex = {
  list_index: number;
  source: 'price_list' | 'base_list';
  /** Título de la price list que ganó, para logs. */
  price_list_title?: string;
};

export function resolveTintingListIndex(
  settings: ErpConfigSettings,
  customerGroupIds: string[] = []
): ResolvedTintingListIndex {
  const catalog = settings.catalog_sync ?? {};
  const groups = new Set(customerGroupIds.filter(Boolean));

  if (groups.size > 0) {
    for (const mapping of catalog.price_lists ?? []) {
      if (mapping.enabled === false) continue;
      if (!mapping.customer_group_id || !groups.has(mapping.customer_group_id)) continue;
      if (!Number.isInteger(mapping.zeus_index) || mapping.zeus_index < 0) continue;
      return {
        list_index: mapping.zeus_index,
        source: 'price_list',
        price_list_title: mapping.title,
      };
    }
  }

  const base = catalog.base_list_index;
  return {
    list_index:
      Number.isInteger(base) && (base as number) >= 0
        ? (base as number)
        : (DEFAULT_CATALOG_SYNC_SETTINGS.base_list_index as number),
    source: 'base_list',
  };
}
