import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import type { RemoteQueryFunction } from '@medusajs/framework/types';
import { BUNDLE_MODULE } from '../../../modules/bundle';
import { syncBundleStores } from '../../../modules/bundle/link-helpers';
import { ListBundlesQuerySchema, type CreateBundleInput } from './schemas';

interface AdminBundleRow {
  id: string;
  title: string;
  handle: string;
  status: string;
  description: string | null;
  thumbnail: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  items_count: number;
  store_ids: string[];
}

/**
 * GET /admin/bundles — paginated list with optional filters (q on
 * title/handle, status, store_id) and enrichment (items_count, store_ids).
 *
 * `store_id` filter: joins the `bundle_demo_store` link via Query. If Query
 * is unable to resolve the link (demo-store not registered) the filter is
 * silently ignored — matches the single-tenant fallback.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const params = ListBundlesQuerySchema.parse(req.query);
  const service: any = req.scope.resolve(BUNDLE_MODULE);
  const query = req.scope.resolve<Omit<RemoteQueryFunction, symbol>>(
    ContainerRegistrationKeys.QUERY,
  );

  // Resolve the id set constrained by `store_id` first (when present) so the
  // downstream service call can apply the filter alongside pagination.
  let filterIds: string[] | undefined;
  if (params.store_id) {
    try {
      const { data } = await query.graph({
        entity: 'demo_store',
        fields: ['id', 'bundles.id'],
        filters: { id: params.store_id },
      });
      const store = data?.[0] as { bundles?: { id: string }[] } | undefined;
      filterIds = (store?.bundles ?? []).map((b) => b.id);
      if (!filterIds.length) {
        res.status(200).json({ bundles: [], count: 0, offset: params.offset, limit: params.limit });
        return;
      }
    } catch {
      // demo-store not present — ignore the filter and fall through to a full listing.
    }
  }

  const filters: Record<string, unknown> = {};
  if (params.status) filters.status = params.status;
  if (filterIds) filters.id = filterIds;
  if (params.q) {
    // MikroORM `$ilike` requires the LIKE pattern to include % markers. We
    // search both title and handle so the admin's single search box works
    // like most Medusa admin surfaces.
    const like = `%${params.q}%`;
    filters.$or = [{ title: { $ilike: like } }, { handle: { $ilike: like } }];
  }

  const [bundles, count] = await service.listAndCountBundles(filters, {
    skip: params.offset,
    take: params.limit,
    order: { updated_at: 'DESC' },
  });

  // Enrichment: items_count + store_ids via a single Query graph traversal.
  const bundleIds = (bundles as Array<{ id: string }>).map((b) => b.id);
  let enrichment: Record<string, { items_count: number; store_ids: string[] }> = {};
  if (bundleIds.length) {
    try {
      const { data } = await query.graph({
        entity: 'bundle',
        fields: ['id', 'items.id', 'demo_stores.id'],
        filters: { id: bundleIds },
      });
      for (const row of (data ?? []) as Array<{
        id: string;
        items?: { id: string }[];
        demo_stores?: { id: string }[];
      }>) {
        enrichment[row.id] = {
          items_count: row.items?.length ?? 0,
          store_ids: (row.demo_stores ?? []).map((s) => s.id),
        };
      }
    } catch {
      // fall through: enrichment stays empty, response still valid.
    }
  }

  const rows: AdminBundleRow[] = (bundles as Array<Record<string, any>>).map((b) => ({
    id: b.id,
    title: b.title,
    handle: b.handle,
    status: b.status,
    description: b.description ?? null,
    thumbnail: b.thumbnail ?? null,
    metadata: b.metadata ?? null,
    created_at: b.created_at,
    updated_at: b.updated_at,
    items_count: enrichment[b.id]?.items_count ?? 0,
    store_ids: enrichment[b.id]?.store_ids ?? [],
  }));

  res.status(200).json({
    bundles: rows,
    count,
    offset: params.offset,
    limit: params.limit,
  });
}

/**
 * POST /admin/bundles — create a Bundle with optional initial items and
 * store availability. Body is validated by `middlewares.ts`.
 */
export async function POST(
  req: MedusaRequest<CreateBundleInput>,
  res: MedusaResponse,
): Promise<void> {
  const input = req.validatedBody as CreateBundleInput;
  const service: any = req.scope.resolve(BUNDLE_MODULE);

  const bundle = await service.createBundles({
    title: input.title,
    handle: input.handle,
    description: input.description ?? null,
    thumbnail: input.thumbnail ?? null,
    status: input.status ?? 'draft',
    metadata: input.metadata ?? null,
  });

  if (input.items?.length) {
    await service.createBundleItems(
      input.items.map((item, index) => ({
        bundle_id: bundle.id,
        product_id: item.product_id,
        quantity: item.quantity,
        position: item.position ?? index,
      })),
    );
  }

  let storeSync: { added: string[]; removed: string[]; skipped?: boolean } | undefined;
  if (input.store_ids?.length) {
    storeSync = await syncBundleStores(req.scope, bundle.id, input.store_ids);
  }

  res.status(201).json({ bundle, store_sync: storeSync ?? null });
}
