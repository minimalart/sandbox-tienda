import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';

/**
 * GET /store/health
 * Simple health endpoint for the storefront to check backend availability.
 */
export const GET = (_req: MedusaRequest, res: MedusaResponse) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
};
