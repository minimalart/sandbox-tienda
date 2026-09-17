import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { BUNDLE_MODULE } from '../../../../../modules/bundle';

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const { id } = req.params;
  const service: any = req.scope.resolve(BUNDLE_MODULE);

  const bundle = await service.retrieveBundle(id).catch(() => null);
  if (!bundle) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, `Bundle ${id} not found`);
  }

  const updated = await service.updateBundles({ id, status: 'draft' });
  res.status(200).json({ bundle: updated });
}
