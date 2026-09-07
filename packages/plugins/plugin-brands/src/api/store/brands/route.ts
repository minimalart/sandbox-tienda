import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { BRAND_MODULE } from '../../../modules/brand';
import BrandModuleService from '../../../modules/brand/service';

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const brandService: BrandModuleService = req.scope.resolve(BRAND_MODULE);

  const salesChannelId =
    typeof req.query.sales_channel_id === 'string' ? req.query.sales_channel_id : undefined;
  const strict = req.query.strict === '1' || req.query.strict === 'true';

  const allBrands = await brandService.listBrands({
    is_active: true,
  });

  // Visibilidad por canal (misma regla que el blog, ver isPostInSalesChannel):
  // `sales_channel_ids` vacío = global (visible en todos, incl. store principal);
  // no vacío = solo en esos canales; `strict` (contexto demo) además oculta los
  // globales para que una demo muestre solo lo suyo.
  const inScope = (brand: Record<string, any>): boolean => {
    if (!salesChannelId) return true;
    const ids = (brand as any).sales_channel_ids;
    const scoped = Array.isArray(ids) && ids.length > 0;
    if (scoped) return (ids as string[]).includes(salesChannelId);
    return !strict;
  };
  const brands = allBrands.filter(inScope);

  if (brands.length === 0) {
    res.status(200).json({ brands: [] });
    return;
  }

  // Adjuntamos las imágenes inline en UNA sola query. Antes el storefront hacía
  // un fetch por marca a /store/brands/:id/images: con ~870 marcas seedeadas eso
  // son ~870 requests por render, que bajo carga fallan parcialmente y hacían que
  // "solo aparezca 1 marca" en la home. brand_image no es relación navegable
  // desde brand (sólo guarda brand_id), así que las traemos por separado y las
  // agrupamos por brand_id.
  const query = req.scope.resolve('query');
  const { data: brandImages } = await query.graph({
    entity: 'brand_image',
    fields: ['id', 'url', 'file_id', 'type', 'brand_id'],
    filters: { brand_id: brands.map((brand) => brand.id) },
  });

  const imagesByBrand = new Map<string, typeof brandImages>();
  for (const image of brandImages) {
    const list = imagesByBrand.get(image.brand_id) ?? [];
    list.push(image);
    imagesByBrand.set(image.brand_id, list);
  }

  const brandsWithImages = brands.map((brand) => ({
    ...brand,
    images: imagesByBrand.get(brand.id) ?? [],
  }));

  res.status(200).json({ brands: brandsWithImages });
}
