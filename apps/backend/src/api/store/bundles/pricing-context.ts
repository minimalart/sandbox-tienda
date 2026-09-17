import type { MedusaRequest } from '@medusajs/framework/http';

/**
 * The pricing context Medusa attaches to `req.pricingContext` after its own
 * `setPricingContext` middleware (plus our `setPricingChannel`) has run.
 *
 * We narrow it structurally instead of importing Medusa's internal type,
 * following the same pattern as `set-pricing-channel.ts`.
 */
export interface BundlePricingContext {
  region_id?: string;
  currency_code?: string;
  sales_channel_id?: string;
  customer_id?: string;
}

export const readPricingContext = (req: MedusaRequest): BundlePricingContext => {
  const bag = (req as unknown as { pricingContext?: Record<string, unknown> }).pricingContext;
  if (!bag) return {};
  return {
    region_id: typeof bag.region_id === 'string' ? bag.region_id : undefined,
    currency_code: typeof bag.currency_code === 'string' ? bag.currency_code : undefined,
    sales_channel_id: typeof bag.sales_channel_id === 'string' ? bag.sales_channel_id : undefined,
    customer_id: typeof bag.customer_id === 'string' ? bag.customer_id : undefined,
  };
};
