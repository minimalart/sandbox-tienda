import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { QueryContext } from '@medusajs/utils';
import { COMPANY_MODULE } from '../../../../modules/company';
import type CompanyModuleService from '../../../../modules/company/service';
import { b2bPricingRegion } from '../pricing-region';

type VariantRow = {
  id: string;
  manage_inventory?: boolean;
  calculated_price?: { calculated_amount?: number } | null;
  inventory_items?: Array<{
    inventory?: { location_levels?: Array<{ available_quantity?: number }> } | null;
  }>;
};
type ProductRow = { id: string; variants?: VariantRow[] };

const stockOf = (v: VariantRow): number => {
  if (v.manage_inventory === false) return 999999;
  return (v.inventory_items ?? []).reduce((acc, it) => {
    const levels = it.inventory?.location_levels ?? [];
    return acc + levels.reduce((a, l) => a + (l.available_quantity || 0), 0);
  }, 0);
};

/**
 * POST /store/b2b/prices — precios mayoristas + stock para un set de productos.
 * Recibe { product_ids } (los que devuelve Typesense en el selector) y responde
 * el precio (según el customer_group de la empresa) y el stock por variante.
 * Body: { product_ids: string[] } → { prices: { [variant_id]: { unit_price, available } } }
 */
export async function POST(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  const body = (req.body ?? {}) as { product_ids?: string[] };
  // Cap defensivo: el selector pide de a una página de Typesense (≤50 ids).
  const productIds = Array.isArray(body.product_ids)
    ? body.product_ids.filter(Boolean).slice(0, 100)
    : [];
  if (!productIds.length) {
    res.json({ prices: {} });
    return;
  }

  const customerId = req.auth_context.actor_id;
  const companyService = req.scope.resolve<CompanyModuleService>(COMPANY_MODULE);
  const membership = await companyService.getMembershipByCustomer(customerId);
  const company = membership
    ? await companyService.retrieveCompany(membership.company_id).catch(() => null)
    : null;
  const customerGroupId = (company?.customer_group_id as string | null) ?? null;

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const region = await b2bPricingRegion(req.scope, company);

  const priceContext = QueryContext({
    currency_code: region.currency_code,
    region_id: region.id,
    ...(customerGroupId ? { customer: { groups: [{ id: customerGroupId }] } } : {}),
  });

  const { data: products } = (await query.graph({
    entity: 'product',
    fields: [
      'id',
      'variants.id',
      'variants.manage_inventory',
      'variants.calculated_price.calculated_amount',
      'variants.inventory_items.inventory.location_levels.available_quantity',
    ],
    filters: { id: productIds, status: 'published' },
    context: { variants: { calculated_price: priceContext } },
  })) as { data: ProductRow[] };

  const prices: Record<string, { unit_price: number | null; available: number }> = {};
  for (const p of products) {
    for (const v of p.variants ?? []) {
      prices[v.id] = {
        unit_price: v.calculated_price?.calculated_amount ?? null,
        available: stockOf(v),
      };
    }
  }

  res.json({ prices });
}
