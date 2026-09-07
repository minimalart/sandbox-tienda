import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { Modules, MedusaError } from '@medusajs/framework/utils';
import { MEDIA_LIBRARY_MODULE } from '../../../../modules/media-library';
import type MediaLibraryModuleService from '../../../../modules/media-library/service';
import { PostAttach } from '../validators';

/**
 * Agrega imágenes de la Biblioteca a un producto: mergea con las actuales,
 * dedup por URL (no agrega las que ya tiene), mantiene las existentes.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const parsed = PostAttach.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Datos inválidos' });
    return;
  }
  const { product_id, asset_ids } = parsed.data;

  const library = req.scope.resolve<MediaLibraryModuleService>(MEDIA_LIBRARY_MODULE);
  const assets = await library.listMediaAssets({ id: asset_ids });
  if (!assets.length) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, 'No se encontraron assets.');
  }

  const productService = req.scope.resolve(Modules.PRODUCT);
  const product = await productService.retrieveProduct(product_id, {
    relations: ['images'],
  });

  const current = (product.images ?? []) as Array<{ id: string; url: string }>;
  const currentUrls = new Set(current.map((i) => i.url));

  const toAdd = assets
    .map((a) => a.url as string)
    .filter((url) => url && !currentUrls.has(url));

  if (toAdd.length === 0) {
    res.json({ added: 0, total: current.length, message: 'Ya estaban todas en el producto.' });
    return;
  }

  // Preservar las actuales (con id) + agregar las nuevas (solo url).
  const images = [
    ...current.map((i) => ({ id: i.id, url: i.url })),
    ...toAdd.map((url) => ({ url })),
  ];

  await productService.updateProducts(product_id, { images } as any);

  res.json({ added: toAdd.length, total: images.length });
}
