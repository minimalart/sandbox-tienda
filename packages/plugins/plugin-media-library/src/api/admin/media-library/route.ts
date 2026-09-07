import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MEDIA_LIBRARY_MODULE } from '../../../modules/media-library';
import type MediaLibraryModuleService from '../../../modules/media-library/service';
import { PostRegisterAsset } from './validators';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<MediaLibraryModuleService>(MEDIA_LIBRARY_MODULE);
  const q = req.query.q ? String(req.query.q) : undefined;
  const limit = Number(req.query.limit ?? 100);
  const offset = Number(req.query.offset ?? 0);
  const [media_assets, count] = await service.search(q, { limit, offset });
  res.json({ media_assets, count, limit, offset });
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = PostRegisterAsset.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const service = req.scope.resolve<MediaLibraryModuleService>(MEDIA_LIBRARY_MODULE);
  const asset = await service.registerAsset(parsed.data);
  res.status(201).json({ media_asset: asset });
}
