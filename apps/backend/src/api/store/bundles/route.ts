import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { BUNDLE_MODULE } from '../../../modules/bundle';
import { listBundleIdsForStore } from '../../../modules/bundle/link-helpers';
import { resolveActiveBundleStore } from './resolve-store';
import { ListStoreBundlesQuerySchema } from './schemas';

/**
 * GET /store/bundles — bundles published in the active Store.
 *
 * Scoping is enforced server-side (PRD §18). The active Store is derived
 * from the request's publishable API key via `resolveActiveBundleStore`;
 * the frontend cannot alter the filter.
 *
 * When the project has no `demo_store` module, the listing degrades to all
 * published bundles (plan §5.2 single-tenant fallback).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const params = ListStoreBundlesQuerySchema.parse(req.query);
  const service: any = req.scope.resolve(BUNDLE_MODULE);

  const filters: Record<string, unknown> = { status: 'published' };

  const store = await resolveActiveBundleStore(req);
  if (store.scoped) {
    const bundleIds = await listBundleIdsForStore(req.scope, store.storeId);
    if (!bundleIds.length) {
      res.status(200).json({ bundles: [], count: 0, offset: params.offset, limit: params.limit });
      return;
    }
    filters.id = bundleIds;
  }

  const [bundles, count] = await service.listAndCountBundles(filters, {
    skip: params.offset,
    take: params.limit,
    order: { updated_at: 'DESC' },
  });

  res.status(200).json({
    bundles,
    count,
    offset: params.offset,
    limit: params.limit,
  });
}
