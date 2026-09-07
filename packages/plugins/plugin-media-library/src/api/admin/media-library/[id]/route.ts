import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MEDIA_LIBRARY_MODULE } from '../../../../modules/media-library';
import type MediaLibraryModuleService from '../../../../modules/media-library/service';
import { PutUpdateAsset } from '../validators';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<MediaLibraryModuleService>(MEDIA_LIBRARY_MODULE);
  const media_asset = await service.retrieveMediaAsset(req.params.id as string);
  res.json({ media_asset });
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = PutUpdateAsset.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const service = req.scope.resolve<MediaLibraryModuleService>(MEDIA_LIBRARY_MODULE);
  const media_asset = await service.updateMediaAssets({ id: req.params.id, ...parsed.data } as any);
  res.json({ media_asset });
}

// Borra SOLO el registro del catálogo. No toca el archivo en S3 (puede estar en uso).
export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<MediaLibraryModuleService>(MEDIA_LIBRARY_MODULE);
  await service.deleteMediaAssets([req.params.id as string]);
  res.json({ id: req.params.id, deleted: true });
}
