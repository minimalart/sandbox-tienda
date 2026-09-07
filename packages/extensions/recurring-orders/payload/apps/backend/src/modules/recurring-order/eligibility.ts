/**
 * Elegibilidad de productos para compras recurrentes.
 *
 * La config (`recurring_setting`) es por sales channel con fallback a la fila
 * global (`sales_channel_id` null) y default `scope: 'all'`. En `selected`, un
 * producto es elegible si matchea la UNIÓN de los criterios: id puntual,
 * alguna categoría o algún tag.
 *
 * Se exige al CREAR/EDITAR una suscripción y gobierna la UI (PDP/carrito).
 * Deliberadamente NO se re-exige en las renovaciones: achicar el scope no
 * rompe suscripciones existentes.
 */

import type { MedusaContainer } from '@medusajs/framework/types';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { RECURRING_ORDER_MODULE } from './types';

export type RecurringScope = 'all' | 'selected';

export type RecurringEligibilityConfig = {
  scope: RecurringScope;
  category_ids: string[];
  tag_values: string[];
  product_ids: string[];
};

export const ALL_PRODUCTS_CONFIG: RecurringEligibilityConfig = {
  scope: 'all',
  category_ids: [],
  tag_values: [],
  product_ids: [],
};

/** Shape mínimo del producto que evalúa el predicado (id + categorías + tags). */
export type EligibilityProduct = {
  id: string;
  category_ids?: string[];
  tag_values?: string[];
};

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/** Normaliza una fila de `recurring_setting` (campos json → arrays tipados). */
export function normalizeSetting(row: {
  scope?: string | null;
  category_ids?: unknown;
  tag_values?: unknown;
  product_ids?: unknown;
} | null | undefined): RecurringEligibilityConfig {
  if (!row) return ALL_PRODUCTS_CONFIG;
  return {
    scope: row.scope === 'selected' ? 'selected' : 'all',
    category_ids: asStringArray(row.category_ids),
    tag_values: asStringArray(row.tag_values),
    product_ids: asStringArray(row.product_ids),
  };
}

/** Predicado puro: ¿este producto puede suscribirse bajo esta config? */
export function isProductEligible(
  config: RecurringEligibilityConfig,
  product: EligibilityProduct,
): boolean {
  if (config.scope === 'all') return true;
  if (config.product_ids.includes(product.id)) return true;
  const categories = product.category_ids ?? [];
  if (categories.some((c) => config.category_ids.includes(c))) return true;
  const tags = (product.tag_values ?? []).map((t) => t.toLowerCase());
  return config.tag_values.some((t) => tags.includes(t.toLowerCase()));
}

/**
 * Config efectiva para un canal: fila del canal ?? fila global ?? todo elegible.
 */
export async function resolveEligibilityConfig(
  container: MedusaContainer,
  salesChannelId: string | null | undefined,
): Promise<RecurringEligibilityConfig> {
  const service: any = container.resolve(RECURRING_ORDER_MODULE);
  try {
    if (salesChannelId) {
      const [own] = await service.listRecurringSettings(
        { sales_channel_id: salesChannelId },
        { take: 1 },
      );
      if (own) return normalizeSetting(own);
    }
    const [global] = await service.listRecurringSettings(
      { sales_channel_id: null },
      { take: 1 },
    );
    return normalizeSetting(global);
  } catch {
    // Tabla aún no migrada u otro fallo de lectura: no bloquear la feature.
    return ALL_PRODUCTS_CONFIG;
  }
}

/**
 * Filtra qué productos (por id) son elegibles en un canal, leyendo categorías
 * y tags en vivo. Devuelve el subconjunto elegible de `productIds`.
 */
export async function filterEligibleProducts(
  container: MedusaContainer,
  salesChannelId: string | null | undefined,
  productIds: string[],
): Promise<Set<string>> {
  const unique = [...new Set(productIds.filter(Boolean))];
  if (!unique.length) return new Set();

  const config = await resolveEligibilityConfig(container, salesChannelId);
  if (config.scope === 'all') return new Set(unique);

  const query = container.resolve<{
    graph: (i: unknown) => Promise<{ data: any[] }>;
  }>(ContainerRegistrationKeys.QUERY);
  const { data: products } = await query.graph({
    entity: 'product',
    fields: ['id', 'categories.id', 'tags.value'],
    filters: { id: unique },
  });

  const eligible = new Set<string>();
  for (const p of products) {
    const candidate: EligibilityProduct = {
      id: p.id,
      category_ids: (p.categories ?? []).map((c: { id: string }) => c.id),
      tag_values: (p.tags ?? [])
        .map((t: { value?: string | null }) => t.value)
        .filter(Boolean),
    };
    if (isProductEligible(config, candidate)) eligible.add(p.id);
  }
  return eligible;
}
