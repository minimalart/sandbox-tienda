import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { MEDIA_LIBRARY_MODULE } from '../../../../modules/media-library';
import type MediaLibraryModuleService from '../../../../modules/media-library/service';

const filenameFromUrl = (url: string): string => {
  try {
    const path = new URL(url).pathname;
    const seg = path.split('/').filter(Boolean).pop();
    return decodeURIComponent(seg || url);
  } catch {
    return url.split('/').pop() || url;
  }
};

// POST /admin/media-library/backfill — importa las imágenes actuales de los
// productos al catálogo (dedup por URL). Idempotente.
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const service = req.scope.resolve<MediaLibraryModuleService>(MEDIA_LIBRARY_MODULE);

  const urls = new Set<string>();
  const PAGE = 200;
  let offset = 0;
  for (;;) {
    const { data: products } = (await query.graph({
      entity: 'product',
      fields: ['id', 'images.url'],
      pagination: { skip: offset, take: PAGE },
    })) as { data: Array<{ id: string; images?: Array<{ url?: string }> }> };
    if (products.length === 0) break;
    for (const p of products) {
      for (const img of p.images ?? []) {
        if (img.url) urls.add(img.url);
      }
    }
    offset += products.length;
    if (products.length < PAGE) break;
  }

  const allUrls = [...urls];
  const existing = await service.existingUrls(allUrls);
  let imported = 0;
  for (const url of allUrls) {
    if (existing.has(url)) continue;
    await service.registerAsset({
      url,
      filename: filenameFromUrl(url),
      source: 'backfill:product',
    });
    imported++;
  }

  res.json({ imported, skipped: allUrls.length - imported, total: allUrls.length });
}
