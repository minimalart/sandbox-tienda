/**
 * Post-import B2B pricing for a demo store.
 *
 * Runs at the end of the import (see run-import.ts), gated on `b2b_enabled`.
 * Depends on the imported products existing with prices, so it CANNOT run during
 * the synchronous provisioning (which only creates the channel/group/company).
 *
 * Two steps:
 *  1. Link every product in the demo's B2C channel to its wholesale (B2B) channel
 *     — required so the B2B cart accepts those variants and the catalog can be
 *     scoped to the demo.
 *  2. (Re)create the tiered wholesale price list: for each variant, three prices
 *     with `min_quantity` breaks (the escalas), targeting the demo's B2B customer
 *     group. Medusa applies the matching tier by line-item quantity in the cart.
 *
 * Idempotent: product links skip products already in the B2B channel; the price
 * list is deleted+recreated by title so re-imports refresh it from current prices.
 */
import { linkProductsToSalesChannelWorkflow } from '@medusajs/core-flows';
import { createPriceListsWorkflow } from '@medusajs/medusa/core-flows';
import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils';
import { QueryContext } from '@medusajs/utils';

/**
 * Fixed wholesale quantity tiers (escalas). Shared with the storefront via the
 * demo config payload so the order builder shows the same breaks it will charge.
 * Open-ended `minQty` bands: Medusa picks the price with the highest `minQty`
 * that is <= the line quantity.
 */
export const WHOLESALE_TIERS = [
  { minQty: 1, discount: 0.2 },
  { minQty: 10, discount: 0.25 },
  { minQty: 50, discount: 0.3 },
] as const;

export type ProvisionDemoB2BPricingInput = {
  /** Existing list to associate without replacing its prices. */
  priceListId?: string | null;
  demoSlug: string;
  /** The demo's B2C channel — source of the demo's product set. */
  sourceSalesChannelId: string;
  /** The demo's wholesale channel — products get linked here + price list target. */
  b2bSalesChannelId: string;
  customerGroupId: string | null;
  currencyCode: string;
  regionId?: string | null;
};

export type ProvisionDemoB2BPricingResult = {
  linkedProducts: number;
  priceListId: string | null;
  tierPrices: number;
};

/** Product ids in a sales channel + which are already in the B2B channel. */
async function collectDemoProductIds(
  query: any,
  sourceSalesChannelId: string,
  b2bSalesChannelId: string
): Promise<{ all: string[]; missingFromB2B: string[] }> {
  const all: string[] = [];
  const missingFromB2B: string[] = [];
  const PAGE = 200;
  // query.graph can't FILTER products by sales_channels, but it CAN select
  // sales_channels.id. Page through and keep the lightweight ids (memory: the
  // unbounded take OOM'd the 2GB box — same pattern as promotions.ts).
  for (let offset = 0; ; offset += PAGE) {
    const { data: page } = await query.graph({
      entity: 'product',
      fields: ['id', 'sales_channels.id'],
      filters: { status: 'published' },
      pagination: { skip: offset, take: PAGE },
    });
    const rows = (page ?? []) as any[];
    if (rows.length === 0) break;
    for (const p of rows) {
      const channels = Array.isArray(p.sales_channels)
        ? p.sales_channels.map((sc: any) => sc?.id).filter(Boolean)
        : [];
      if (channels.includes(sourceSalesChannelId)) {
        all.push(p.id as string);
        if (!channels.includes(b2bSalesChannelId)) missingFromB2B.push(p.id as string);
      }
    }
    if (rows.length < PAGE) break;
  }
  return { all, missingFromB2B };
}

export async function provisionDemoB2BPricing(
  container: any,
  input: ProvisionDemoB2BPricingInput
): Promise<ProvisionDemoB2BPricingResult> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const pricing: any = container.resolve(Modules.PRICING);
  const currency = input.currencyCode.toLowerCase();

  // ── 1. Link the demo's products to the wholesale channel ───────────────────
  const { all: productIds, missingFromB2B } = await collectDemoProductIds(
    query,
    input.sourceSalesChannelId,
    input.b2bSalesChannelId
  );
  const LINK_BATCH = 200;
  for (let i = 0; i < missingFromB2B.length; i += LINK_BATCH) {
    const add = missingFromB2B.slice(i, i + LINK_BATCH);
    await linkProductsToSalesChannelWorkflow(container).run({
      input: { id: input.b2bSalesChannelId, add, remove: [] },
    });
  }

  if (input.priceListId) {
    const list = await pricing.retrievePriceList(input.priceListId, {
      relations: ['price_list_rules'],
    });
    if (input.customerGroupId) {
      const rules = Object.fromEntries(
        (list.price_list_rules ?? []).map((rule: any) => [rule.attribute, rule.value])
      );
      const groups = Array.isArray(rules['customer.groups.id']) ? rules['customer.groups.id'] : [];
      // An unrestricted list already applies to wholesale customers. Restricting
      // it here would silently remove its prices from existing retail buyers.
      if (Object.hasOwn(rules, 'customer.groups.id')) {
        await pricing.setPriceListRules({
          price_list_id: input.priceListId,
          rules: { ...rules, 'customer.groups.id': [...new Set([...groups, input.customerGroupId])] },
        });
      }
    }
    return { linkedProducts: missingFromB2B.length, priceListId: input.priceListId, tierPrices: 0 };
  }

  // ── 2. Base prices of the demo's published variants ────────────────────────
  const variantPrices = new Map<string, number>();
  const ID_PAGE = 100;
  for (let i = 0; i < productIds.length; i += ID_PAGE) {
    const chunk = productIds.slice(i, i + ID_PAGE);
    const { data: products } = await query.graph({
      entity: 'product',
      fields: ['id', 'variants.id', 'variants.calculated_price.calculated_amount'],
      filters: { id: chunk },
      context: {
        variants: {
          calculated_price: QueryContext({
            currency_code: currency,
            region_id: input.regionId ?? undefined,
          }),
        },
      },
    });
    for (const p of (products ?? []) as any[]) {
      for (const v of p.variants ?? []) {
        const amount = v.calculated_price?.calculated_amount;
        if (amount != null) variantPrices.set(v.id, amount);
      }
    }
  }

  // ── 3. Build tiered prices (escalas) ───────────────────────────────────────
  const prices: Array<{
    variant_id: string;
    currency_code: string;
    amount: number;
    min_quantity: number;
  }> = [];
  for (const [variantId, base] of variantPrices) {
    for (const tier of WHOLESALE_TIERS) {
      prices.push({
        variant_id: variantId,
        currency_code: currency,
        amount: Math.round(base * (1 - tier.discount) * 100) / 100,
        min_quantity: tier.minQty,
      });
    }
  }

  // ── 4. (Re)create the price list (idempotent by title) ─────────────────────
  const title = `Mayorista Demo ${input.demoSlug}`;
  try {
    const existing: Array<{ id: string; title: string }> = await pricing.listPriceLists({});
    const stale = existing.filter((pl) => pl.title === title).map((pl) => pl.id);
    if (stale.length) await pricing.deletePriceLists(stale);
  } catch (err) {
    logger.warn(`[demo-store] B2B price list cleanup skipped: ${(err as Error).message}`);
  }

  const status = input.customerGroupId ? 'active' : 'draft';
  const { result } = await createPriceListsWorkflow(container).run({
    input: {
      price_lists_data: [
        {
          title,
          description: `Precios mayoristas del demo con escalas por cantidad (${WHOLESALE_TIERS.map(
            (t) => `${t.minQty}+ -${Math.round(t.discount * 100)}%`
          ).join(' · ')}).`,
          type: 'override',
          status,
          prices,
          ...(input.customerGroupId
            ? { rules: { 'customer.groups.id': [input.customerGroupId] } }
            : {}),
        } as any,
      ],
    },
  });
  const priceListId = (result?.[0]?.id as string | undefined) ?? null;

  logger.info(
    `[demo-store] B2B pricing for "${input.demoSlug}": linked ${missingFromB2B.length} products, price list ${priceListId} (${status}) with ${prices.length} tier prices over ${variantPrices.size} variants.`
  );

  return { linkedProducts: missingFromB2B.length, priceListId, tierPrices: prices.length };
}
