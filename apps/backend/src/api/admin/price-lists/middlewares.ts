import { type MiddlewareRoute, validateAndTransformBody } from '@medusajs/framework/http';
import { UpsertSalesChannelRuleSchema } from './[id]/sales-channel-rule/validators';

/**
 * Middlewares for `/admin/price-lists/*` — restricted to the endpoints WE
 * define. The core `/admin/price-lists` endpoints are owned by Medusa and use
 * their own validation. We do NOT touch those.
 *
 * The Zod schema for our POST body is applied here because the route file
 * itself only exports the handler; validation MUST be a middleware to run
 * before the handler and prevent unknown-field silent strip (same pattern used
 * across ERP, sites, and others in this repo).
 *
 * Related ticket: EDUCABOT-9
 */
export const adminPriceListsMiddlewares: MiddlewareRoute[] = [
  {
    matcher: '/admin/price-lists/:id/sales-channel-rule',
    method: ['POST'],
    middlewares: [validateAndTransformBody(UpsertSalesChannelRuleSchema)],
  },
];
