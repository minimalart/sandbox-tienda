import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';
import type { RemoteQueryFunction } from '@medusajs/framework/types';
import { BUNDLE_MODULE } from '../../../../modules/bundle';
import { isBundleAvailableInStore } from '../../../../modules/bundle/link-helpers';
import { resolveActiveBundleStore } from '../resolve-store';
import { readPricingContext } from '../pricing-context';

interface ExpandedVariant {
  id: string;
  title: string;
  sku: string | null;
  options: Record<string, string>; // option_title → value
  prices: Array<{ amount: number; currency_code: string }>;
  calculated_price: { amount: number; currency_code: string } | null;
  inventory_available: boolean;
  allow_backorder: boolean;
  manage_inventory: boolean;
}

interface ExpandedProduct {
  id: string;
  title: string;
  handle: string;
  thumbnail: string | null;
  status: string;
  options: Array<{ id: string; title: string; values: string[] }>;
  variants: ExpandedVariant[];
}

/**
 * GET /store/bundles/:handle — bundle detail for the configurator wizard.
 *
 * Server-side responsibilities (PRD §17-18):
 *  - resolve the active Store via publishable key;
 *  - 404 if the bundle is not linked to that Store;
 *  - expand items with their Product (options + variants + prices) using the
 *    active pricing context so `calculated_price` matches what the wizard
 *    will confirm;
 *  - resolve `auto_resolved_variant_id` when a Product has exactly one
 *    buyable variant (PRD §12);
 *  - compute `pricing.from` as the sum of min-price variants across items —
 *    only when every item has a price (PRD §40 "Desde solo cuando puede
 *    calcularse").
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { handle } = req.params;
  const service: any = req.scope.resolve(BUNDLE_MODULE);
  const query = req.scope.resolve<Omit<RemoteQueryFunction, symbol>>(
    ContainerRegistrationKeys.QUERY,
  );

  const [bundle] = await service.listBundles({ handle, status: 'published' });
  if (!bundle) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Bundle not found');
  }

  const store = await resolveActiveBundleStore(req);
  const activeStoreId = store.scoped ? store.storeId : null;
  const available = await isBundleAvailableInStore(req.scope, bundle.id, activeStoreId);
  if (!available) {
    // Do not reveal whether the bundle exists in a different store — return a
    // plain 404 (PRD §18).
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'Bundle not found');
  }

  const items = (await service.listBundleItems(
    { bundle_id: bundle.id },
    { order: { position: 'ASC' } },
  )) as Array<{
    id: string;
    product_id: string;
    quantity: number;
    position: number;
  }>;

  const ctx = readPricingContext(req);
  const productIds = Array.from(new Set(items.map((it) => it.product_id).filter(Boolean)));
  let productsById: Record<string, ExpandedProduct> = {};

  if (productIds.length) {
    // `variants.calculated_price.*` REQUIERE que Query resuelva el pricing
    // context (region + currency + channel). Medusa's `setPricingContext`
    // sólo corre sobre /store/products y /store/carts/*, no sobre
    // /store/bundles/*. Sin context, aunque no lo pases como override, Query
    // hace fallar toda la request si `calculated_price.*` está en `fields`.
    // Fix: elegir dinámicamente entre `calculated_price.*` (con context) y
    // `prices.*` (raw base prices, sin context). El wizard prefiere el
    // calculated_price cuando existe; sin él cae al primer raw price.
    const priceCtxEntries = Object.entries(ctx).filter(([, v]) => v !== undefined) as Array<
      [string, string]
    >;
    const baseFields = [
      'id',
      'title',
      'handle',
      'thumbnail',
      'status',
      'options.id',
      'options.title',
      'options.values.value',
      'variants.id',
      'variants.title',
      'variants.sku',
      'variants.manage_inventory',
      'variants.allow_backorder',
      'variants.options.value',
      'variants.options.option.title',
    ];
    const priceFields =
      priceCtxEntries.length > 0
        ? [
            'variants.calculated_price.calculated_amount',
            'variants.calculated_price.currency_code',
            'variants.calculated_price.is_calculated_price_price_list',
          ]
        : ['variants.prices.amount', 'variants.prices.currency_code'];
    const graphOptions: {
      entity: string;
      fields: string[];
      filters: Record<string, unknown>;
      context?: unknown;
    } = {
      entity: 'product',
      fields: [...baseFields, ...priceFields],
      filters: { id: productIds },
    };
    if (priceCtxEntries.length > 0) {
      graphOptions.context = {
        variants: {
          calculated_price: {
            context: Object.fromEntries(priceCtxEntries),
          },
        },
      };
    }
    try {
      const { data } = await query.graph(graphOptions as any);

      for (const p of (data ?? []) as Array<any>) {
        productsById[p.id] = {
          id: p.id,
          title: p.title,
          handle: p.handle,
          thumbnail: p.thumbnail ?? null,
          status: p.status,
          options: (p.options ?? []).map((o: any) => ({
            id: o.id,
            title: o.title,
            values: (o.values ?? []).map((v: any) => v.value).filter(Boolean),
          })),
          variants: (p.variants ?? []).map((v: any) => {
            const optionMap: Record<string, string> = {};
            for (const ov of v.options ?? []) {
              const title = ov?.option?.title;
              if (title) optionMap[title] = ov.value;
            }
            const firstRaw =
              Array.isArray(v.prices) && v.prices.length
                ? { amount: v.prices[0].amount, currency_code: v.prices[0].currency_code }
                : null;
            const calc = v.calculated_price
              ? {
                  amount: v.calculated_price.calculated_amount,
                  currency_code: v.calculated_price.currency_code,
                }
              : firstRaw;
            return {
              id: v.id,
              title: v.title ?? null,
              sku: v.sku ?? null,
              options: optionMap,
              prices: calc ? [calc] : [],
              calculated_price: calc,
              // Inventory expansion is deferred to a later phase — until then we
              // assume every variant is available and let the Cart module reject
              // at confirmation time if inventory is enforced.
              inventory_available: true,
              allow_backorder: !!v.allow_backorder,
              manage_inventory: !!v.manage_inventory,
            };
          }),
        };
      }
    } catch {
      /* leave productsById empty on failure — response shape stays valid. */
    }
  }

  // Auto-resolution + pricing.from computation.
  const buyable = (v: ExpandedVariant): boolean =>
    v.inventory_available && (!!v.calculated_price || v.allow_backorder || !v.manage_inventory);

  let fromTotalMinorUnits = 0;
  let fromCurrency: string | null = null;
  let priceable = true;
  let anyConfigurable = false;

  const enrichedItems = items.map((item) => {
    const product = productsById[item.product_id] ?? null;
    const buyableVariants = (product?.variants ?? []).filter(buyable);

    let autoVariantId: string | null = null;
    if (buyableVariants.length === 1) autoVariantId = buyableVariants[0]!.id;
    if (buyableVariants.length !== 1) anyConfigurable = true;

    const cheapest = buyableVariants.reduce<ExpandedVariant | null>((best, v) => {
      if (!v.calculated_price) return best;
      if (!best || v.calculated_price.amount < (best.calculated_price?.amount ?? Infinity)) return v;
      return best;
    }, null);
    if (cheapest?.calculated_price) {
      if (!fromCurrency) fromCurrency = cheapest.calculated_price.currency_code;
      if (cheapest.calculated_price.currency_code !== fromCurrency) priceable = false;
      fromTotalMinorUnits += cheapest.calculated_price.amount * item.quantity;
    } else {
      priceable = false;
    }

    return {
      id: item.id,
      quantity: item.quantity,
      position: item.position,
      product_id: item.product_id,
      product,
      auto_resolved_variant_id: autoVariantId,
    };
  });

  res.status(200).json({
    bundle: {
      ...bundle,
      items: enrichedItems,
      pricing: {
        from:
          priceable && fromCurrency
            ? { amount: fromTotalMinorUnits, currency_code: fromCurrency }
            : null,
        all_configurable: anyConfigurable,
      },
      store_context: {
        active_store_id: activeStoreId,
        region_id: ctx.region_id ?? null,
        currency_code: ctx.currency_code ?? null,
        sales_channel_id: ctx.sales_channel_id ?? null,
      },
    },
  });
}
