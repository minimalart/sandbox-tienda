import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { BUNDLE_MODULE } from '../../../../../modules/bundle';
import { validateBundleForPublish } from '../../../../../modules/bundle/publish-validation';

/**
 * POST /admin/bundles/:id/publish — validate composition and flip status to
 * `published`. Returns 422 with the full list of issues when validation
 * fails so the admin can render them all at once.
 *
 * Also supports `?dry_run=1` to run validation without persisting the
 * status change (used by the admin Review tab to preview publish readiness).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params.id;
  if (!id) throw new MedusaError(MedusaError.Types.INVALID_DATA, 'Missing bundle id');
  const service: any = req.scope.resolve(BUNDLE_MODULE);

  const bundle = await service.retrieveBundle(id).catch(() => null);
  if (!bundle) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Bundle ${id} not found`);
  }

  const validation = await validateBundleForPublish(req.scope, id);
  const dryRun = String(req.query.dry_run ?? '') === '1';

  if (!validation.ok) {
    res.status(422).json({
      code: 'BUNDLE_PUBLISH_INVALID',
      message: 'Bundle cannot be published in its current state.',
      validation,
    });
    return;
  }

  if (dryRun) {
    res.status(200).json({ bundle, validation, dry_run: true });
    return;
  }

  const updated = await service.updateBundles({ id, status: 'published' });
  res.status(200).json({ bundle: updated, validation });
}
