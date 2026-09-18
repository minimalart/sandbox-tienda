import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys, MedusaError } from '@medusajs/framework/utils';
import type { RemoteQueryFunction } from '@medusajs/framework/types';
import { BUNDLE_MODULE } from '../../../../modules/bundle';
import { syncBundleStores } from '../../../../modules/bundle/link-helpers';
import type { UpdateBundleInput } from '../schemas';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params.id;
  if (!id) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Missing bundle id');
  const service: any = req.scope.resolve(BUNDLE_MODULE);
  const query = req.scope.resolve<Omit<RemoteQueryFunction, symbol>>(
    ContainerRegistrationKeys.QUERY,
  );

  const bundle = await service.retrieveBundle(id).catch(() => null);
  if (!bundle) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Bundle ${id} not found`);
  }

  const items = await service.listBundleItems(
    { bundle_id: id },
    { order: { position: 'ASC' } },
  );

  // Expand: linked stores + basic product info (title/handle/thumbnail) for
  // each item so the admin edit surface renders in a single round-trip.
  let stores: Array<{ id: string; name?: string; slug?: string }> = [];
  const productIds = Array.from(new Set((items as any[]).map((it) => it.product_id).filter(Boolean)));
  let productsById: Record<
    string,
    { id: string; title: string; handle: string; thumbnail: string | null; status: string }
  > = {};

  try {
    const { data } = await query.graph({
      entity: 'bundle',
      fields: ['id', 'demo_stores.id', 'demo_stores.name', 'demo_stores.slug'],
      filters: { id },
    });
    const row = data?.[0] as
      | { demo_stores?: Array<{ id: string; name?: string; slug?: string }> }
      | undefined;
    stores = row?.demo_stores ?? [];
  } catch {
    /* demo-store not registered: leave stores empty. */
  }

  if (productIds.length) {
    try {
      const { data } = await query.graph({
        entity: 'product',
        fields: ['id', 'title', 'handle', 'thumbnail', 'status'],
        filters: { id: productIds },
      });
      for (const p of (data ?? []) as Array<{
        id: string;
        title: string;
        handle: string;
        thumbnail: string | null;
        status: string;
      }>) {
        productsById[p.id] = p;
      }
    } catch {
      /* leave productsById empty on failure — edit surface degrades gracefully. */
    }
  }

  const enrichedItems = (items as any[]).map((it) => ({
    id: it.id,
    product_id: it.product_id,
    quantity: it.quantity,
    position: it.position,
    metadata: it.metadata ?? null,
    product: productsById[it.product_id] ?? null,
  }));

  res.status(200).json({
    bundle: {
      ...bundle,
      items: enrichedItems,
      stores,
    },
  });
}

export async function POST(
  req: MedusaRequest<UpdateBundleInput>,
  res: MedusaResponse,
): Promise<void> {
  const id = req.params.id;
  if (!id) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Missing bundle id');
  const input = req.validatedBody as UpdateBundleInput;
  const service: any = req.scope.resolve(BUNDLE_MODULE);

  // The service update takes only Bundle-level fields; store linking is
  // driven by a separate call keyed off `store_ids` when it appears in the
  // payload (idempotent set-replace semantics).
  const { store_ids, items: _items, ...updates } = input as UpdateBundleInput & {
    store_ids?: string[];
  };

  const bundle = await service.updateBundles({ id, ...updates });

  let storeSync: { added: string[]; removed: string[]; skipped?: boolean } | undefined;
  if (Array.isArray(store_ids)) {
    storeSync = await syncBundleStores(req.scope, id, store_ids);
  }

  res.status(200).json({ bundle, store_sync: storeSync ?? null });
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params.id;
  if (!id) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Missing bundle id');
  const service: any = req.scope.resolve(BUNDLE_MODULE);

  await service.softDeleteBundles([id]);
  res.status(200).json({ id, object: 'bundle', deleted: true });
}
