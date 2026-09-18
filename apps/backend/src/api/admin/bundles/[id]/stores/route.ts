import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { BUNDLE_MODULE } from '../../../../../modules/bundle';
import { syncBundleStores } from '../../../../../modules/bundle/link-helpers';
import type { SetBundleStoresInput } from '../../schemas';

/**
 * POST /admin/bundles/:id/stores — idempotently replace the set of Stores a
 * Bundle is available in.
 *
 * Computes a diff against the existing links and only creates/dismisses the
 * delta. When the `demo_store` module is not registered in the running
 * project, the sync is skipped and reported to the caller (plan §5.2
 * single-tenant fallback).
 */
export async function POST(
  req: MedusaRequest<SetBundleStoresInput>,
  res: MedusaResponse,
): Promise<void> {
  const id = req.params.id;
  if (!id) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Missing bundle id');
  const input = req.validatedBody as SetBundleStoresInput;
  const service: any = req.scope.resolve(BUNDLE_MODULE);

  const bundle = await service.retrieveBundle(id).catch(() => null);
  if (!bundle) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Bundle ${id} not found`);
  }

  const { added, removed, skipped } = await syncBundleStores(req.scope, id, input.store_ids);

  res.status(200).json({
    bundle_id: id,
    store_ids: input.store_ids,
    added,
    removed,
    skipped: skipped ?? false,
  });
}
