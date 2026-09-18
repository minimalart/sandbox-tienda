import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { BUNDLE_MODULE } from '../../../../../../modules/bundle';
import type { UpdateBundleItemInput } from '../../../schemas';

export async function POST(
  req: MedusaRequest<UpdateBundleItemInput>,
  res: MedusaResponse,
): Promise<void> {
  const { itemId } = req.params;
  const input = req.validatedBody as UpdateBundleItemInput;
  const service: any = req.scope.resolve(BUNDLE_MODULE);
  const existing = await service.retrieveBundleItem(itemId).catch(() => null);
  if (!existing || existing.bundle_id !== req.params.id) {
    res.status(404).json({ type: 'not_found', message: 'Bundle item not found' });
    return;
  }

  const item = await service.updateBundleItems({ id: itemId, ...input });
  res.status(200).json({ item });
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { itemId } = req.params;
  const service: any = req.scope.resolve(BUNDLE_MODULE);
  const existing = await service.retrieveBundleItem(itemId).catch(() => null);
  if (!existing || existing.bundle_id !== req.params.id) {
    res.status(404).json({ type: 'not_found', message: 'Bundle item not found' });
    return;
  }

  await service.deleteBundleItems([itemId]);
  res.status(200).json({ id: itemId, object: 'bundle_item', deleted: true });
}
