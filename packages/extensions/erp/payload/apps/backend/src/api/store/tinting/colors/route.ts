import type { MedusaRequest, MedusaResponse } from '@medusajs/framework';
import { ERP_MODULE } from '../../../../modules/erp';
import type ErpModuleService from '../../../../modules/erp/service';
import type { ErpConfigSettings } from '../../../../modules/erp/types';
import { loadVariantInfo } from '../context';

/**
 * GET /store/tinting/colors?variant_id=... — carta de colores que se puede
 * entonar sobre esa base (flujo base → color).
 *
 * NO devuelve el código de fórmula: es data maestra interna y, sobre todo, el
 * único parámetro que decide qué cotiza el ERP. Si el navegador lo tuviera,
 * podría pedir el precio de una fórmula arbitraria.
 *
 * Cacheable fuerte: la carta cambia cuando alguien importa colores, no por
 * pedido.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<ErpModuleService>(ERP_MODULE);
  const config = await service.getActiveConfig().catch(() => null);
  const settings = (config?.settings ?? {}) as ErpConfigSettings;

  if (!settings.tinting?.enabled) {
    res.json({ tintable: false, colors: [] });
    return;
  }

  const variantId = String(req.query.variant_id ?? '').trim();
  if (!variantId) {
    res.status(400).json({ message: 'Falta variant_id.' });
    return;
  }

  try {
    const variant = await loadVariantInfo(req, variantId, null);
    if (!variant?.sku) {
      res.json({ tintable: false, colors: [] });
      return;
    }

    const { base, colors } = await service.listTintingColorsForBase(variant.sku);
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
    res.json({
      tintable: colors.length > 0,
      /**
       * `true` = elegir color es OPCIONAL: el artículo también se vende
       * terminado. Es la doble función del blanco de las líneas sin base P
       * (DESDEELSUR-22). Sin este dato el PDP bloquea el botón de comprar en
       * cuanto la base es entonable, que es lo correcto para una `BASE P` y
       * rompe la venta del blanco.
       */
      optional: Boolean(base?.sellable_untinted),
      base: { article_code: variant.sku },
      colors: colors.map((color) => ({
        code: color.code,
        name: color.name,
        collection: color.collection,
        family: color.family,
        hex: color.hex,
      })),
    });
  } catch (error) {
    // Igual que la cotización: este endpoint no puede tumbar el PDP. Sin carta,
    // el producto se vende sin entonar.
    console.error('[tinting] colors error:', error instanceof Error ? error.stack : error);
    res.json({ tintable: false, colors: [] });
  }
}
