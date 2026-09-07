import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { QueryContext } from '@medusajs/utils';
import { COMPANY_MODULE } from '../../../modules/company';
import type CompanyModuleService from '../../../modules/company/service';
import { b2bPricingRegion } from './pricing-region';

export type OrderLineInput = { sku?: string; variant_id?: string; quantity: number };

export type ResolvedLine = {
  variant_id: string;
  sku: string | null;
  title: string;
  quantity: number;
  available: number;
  unit_price: number | null;
};

export type ResolveResult = {
  resolved: ResolvedLine[];
  out_of_stock: Array<{ sku: string | null; variant_id: string; available: number; quantity: number }>;
  not_found: string[];
};

type VariantRow = {
  id: string;
  sku?: string | null;
  title?: string;
  product?: { title?: string } | null;
  calculated_price?: { calculated_amount?: number } | null;
  inventory_items?: Array<{
    inventory?: { location_levels?: Array<{ available_quantity?: number }> } | null;
  }>;
  manage_inventory?: boolean;
};

const stockOf = (v: VariantRow): number => {
  if (v.manage_inventory === false) return 999999;
  const items = v.inventory_items ?? [];
  return items.reduce((acc, it) => {
    const levels = it.inventory?.location_levels ?? [];
    return acc + levels.reduce((a, l) => a + (l.available_quantity || 0), 0);
  }, 0);
};

/**
 * Resuelve líneas (sku/variant_id + cantidad) a variantes con precio mayorista
 * (contexto del customer_group de la empresa del comprador) y stock.
 */
export async function resolveB2BLines(
  scope: { resolve: <T = unknown>(k: string) => T },
  customerId: string,
  lines: OrderLineInput[],
): Promise<ResolveResult> {
  const companyService = scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const membership = await companyService.getMembershipByCustomer(customerId);
  const company = membership
    ? await companyService.retrieveCompany(membership.company_id).catch(() => null)
    : null;
  const customerGroupId = (company?.customer_group_id as string | null) ?? null;
  // NOTE: quick-order / reorder / import resolve variants by explicit SKU/id and
  // are NOT scoped by sales channel here — the B2B cart enforces the channel when
  // a line is added (a variant not in the demo's wholesale channel is rejected),
  // so cross-demo SKUs can't actually be ordered. The catalog route IS scoped by
  // the company's sales channel (the primary browsing surface).

  const query = scope.resolve<{
    graph: (input: unknown) => Promise<{ data: any[] }>;
  }>(ContainerRegistrationKeys.QUERY);

  // Región de precios del demo (NO regions[0]: puede ser una región ajena y dejar
  // calculated_price en null).
  const region = await b2bPricingRegion(scope, company);

  const priceContext = QueryContext({
    currency_code: region.currency_code,
    region_id: region.id,
    ...(customerGroupId ? { customer: { groups: [{ id: customerGroupId }] } } : {}),
  });
  const fields = [
    'id',
    'sku',
    'title',
    'manage_inventory',
    'product.title',
    'calculated_price.calculated_amount',
    'inventory_items.inventory.location_levels.available_quantity',
  ];

  const skus = [...new Set(lines.map((l) => l.sku).filter(Boolean))] as string[];
  const ids = [...new Set(lines.map((l) => l.variant_id).filter(Boolean))] as string[];

  const bySku = new Map<string, VariantRow>();
  const byId = new Map<string, VariantRow>();

  if (skus.length) {
    const { data } = (await query.graph({
      entity: 'product_variant',
      fields,
      filters: { sku: skus },
      context: { calculated_price: priceContext },
    })) as { data: VariantRow[] };
    for (const v of data) if (v.sku) bySku.set(v.sku, v);
  }
  if (ids.length) {
    const { data } = (await query.graph({
      entity: 'product_variant',
      fields,
      filters: { id: ids },
      context: { calculated_price: priceContext },
    })) as { data: VariantRow[] };
    for (const v of data) byId.set(v.id, v);
  }

  const result: ResolveResult = { resolved: [], out_of_stock: [], not_found: [] };
  for (const line of lines) {
    const v = line.variant_id ? byId.get(line.variant_id) : line.sku ? bySku.get(line.sku) : undefined;
    if (!v) {
      result.not_found.push(line.sku ?? line.variant_id ?? '');
      continue;
    }
    const available = stockOf(v);
    const resolved: ResolvedLine = {
      variant_id: v.id,
      sku: v.sku ?? null,
      title: v.product?.title ? `${v.product.title}${v.title ? ` · ${v.title}` : ''}` : v.title ?? v.id,
      quantity: line.quantity,
      available,
      unit_price: v.calculated_price?.calculated_amount ?? null,
    };
    result.resolved.push(resolved);
    if (available < line.quantity) {
      result.out_of_stock.push({ sku: v.sku ?? null, variant_id: v.id, available, quantity: line.quantity });
    }
  }
  return result;
}
