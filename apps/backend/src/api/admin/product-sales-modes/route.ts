import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { MedusaError } from '@medusajs/framework/utils';
import { DEMO_STORE_MODULE } from '../../../modules/demo-store';
import { ensureDemoStoreTables } from '../../../modules/demo-store/ensure-tables';
import { DEFAULT_SALES_MODE, isSalesMode } from '../../../lib/multistore/sales-mode';
import { siteFromRequest } from '../../../lib/multistore';

/**
 * Modo de venta de un Product por tienda (PRD Bundles V2 §11).
 *
 * Vive en `/admin/product-sales-modes` y NO dentro de `/admin/bundles`: es
 * disponibilidad comercial del producto en una tienda, no configuración de un
 * bundle. Un mismo producto puede ser `bundle_only` en una tienda y venderse
 * suelto en otra sin que ningún bundle se entere.
 *
 * GET  ?site_id=&product_id=&product_id=…  → filas configuradas
 * POST { site_id, product_id, sales_mode } → upsert; el default borra la fila
 *
 * Guardar el default BORRA la fila en vez de escribirla: la tabla queda con lo
 * que de verdad se configuró, y "sin fila" sigue significando el comportamiento
 * de siempre.
 */

/**
 * Tienda sobre la que opera el request: la que pide el cliente, o la activa del
 * backoffice — `siteFromRequest` lee la pista que deja `attachSiteHint`.
 *
 * El widget del producto manda `site_id` explícito porque recorre TODAS las
 * tiendas; el fallback existe para que la ruta sea usable desde el admin sin
 * repetir el id que el backoffice ya tiene seleccionado.
 */
const resolveSiteId = async (
  req: MedusaRequest,
  explicit: string | null,
): Promise<string | null> => {
  if (explicit) return explicit;
  const resolution = await siteFromRequest(req);
  return resolution.status === 'site' || resolution.status === 'singleSite'
    ? resolution.site.id
    : null;
};

const asArray = (value: unknown): string[] => {
  if (typeof value === 'string' && value) return [value];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && !!v);
  return [];
};

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const siteId = await resolveSiteId(
    req,
    typeof req.query.site_id === 'string' ? req.query.site_id : null,
  );
  if (!siteId) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'site_id is required');
  }
  await ensureDemoStoreTables(req.scope);
  const service: any = req.scope.resolve(DEMO_STORE_MODULE);

  const productIds = asArray(req.query.product_id);
  const filters: Record<string, unknown> = { site_id: siteId };
  if (productIds.length) filters.product_id = productIds;

  const rows = await service.listProductSalesModes(filters);
  res.status(200).json({
    product_sales_modes: rows,
    default_sales_mode: DEFAULT_SALES_MODE,
  });
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const body = (req.body ?? {}) as {
    site_id?: string;
    product_id?: string;
    sales_mode?: string;
  };
  const siteId = await resolveSiteId(req, body.site_id ?? null);
  if (!siteId || !body.product_id) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, 'site_id and product_id are required');
  }
  if (!isSalesMode(body.sales_mode)) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'sales_mode must be standalone, bundle_only or standalone_and_bundle',
    );
  }

  await ensureDemoStoreTables(req.scope);
  const service: any = req.scope.resolve(DEMO_STORE_MODULE);

  const [existing] = await service.listProductSalesModes({
    site_id: siteId,
    product_id: body.product_id,
  });

  // El default no se persiste: volver a "individual y bundles" es volver al
  // estado sin configurar.
  if (body.sales_mode === DEFAULT_SALES_MODE) {
    if (existing) await service.deleteProductSalesModes([existing.id]);
    res.status(200).json({ product_sales_mode: null, sales_mode: DEFAULT_SALES_MODE });
    return;
  }

  const row = existing
    ? await service.updateProductSalesModes({ id: existing.id, sales_mode: body.sales_mode })
    : await service.createProductSalesModes({
        site_id: siteId,
        product_id: body.product_id,
        sales_mode: body.sales_mode,
      });

  res.status(200).json({ product_sales_mode: row, sales_mode: body.sales_mode });
}
