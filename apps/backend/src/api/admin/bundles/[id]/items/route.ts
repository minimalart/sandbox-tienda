import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { BUNDLE_MODULE } from '../../../../../modules/bundle';
import type { CreateBundleItemInput } from '../../schemas';

export async function POST(
  req: MedusaRequest<CreateBundleItemInput>,
  res: MedusaResponse,
): Promise<void> {
  const { id } = req.params;
  const input = req.validatedBody as CreateBundleItemInput;
  const service: any = req.scope.resolve(BUNDLE_MODULE);

  let position = input.position;
  if (position === undefined) {
    const siblings = await service.listBundleItems({ bundle_id: id });
    position = siblings.length;
  }

  const item = await service.createBundleItems({
    bundle_id: id,
    product_id: input.product_id,
    quantity: input.quantity,
    position,
  });

  res.status(201).json({ item });
}
