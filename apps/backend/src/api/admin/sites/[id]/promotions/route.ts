import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { DEMO_STORE_MODULE } from '../../../../../modules/demo-store';
import { ensureDemoStoreTables } from '../../../../../modules/demo-store/ensure-tables';
import { isMainStore } from '../../../../../modules/demo-store/main-store';
import { createDemoPromotions } from '../../../../../modules/demo-store/promotions';

/**
 * Generate demo promotions for a demo store's catalog (the "Crear promociones"
 * admin action). Puts a random ~15% of the demo's products on sale, scoped to
 * its sales channel, then re-indexes Typesense so the badges/discounts surface.
 * Re-running re-randomizes (cleans this demo's previous promotions first).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params.id as string;
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const service: any = req.scope.resolve(DEMO_STORE_MODULE);

  await ensureDemoStoreTables(req.scope);

  const demo = await service.retrieveDemoStore(id);

  // La tienda principal NO genera promociones de muestra: `createDemoPromotions`
  // escribe promos aleatorias sobre ~15% del catálogo del canal, y en el canal real
  // eso es basura visible para el cliente final.
  if (isMainStore(demo)) {
    res.status(409).json({
      message:
        'La tienda principal no genera promociones de muestra: se aplicarían sobre el ' +
        'catálogo real y las verían los clientes.',
    });
    return;
  }

  if (!demo?.sales_channel_id) {
    res.status(409).json({ message: 'Demo has no sales channel yet (still provisioning?).' });
    return;
  }

  let resyncTypesense: (container: any) => Promise<void>;
  try { ({ resyncTypesense } = require('../../../../../modules/store-importer/run-import')); }
  catch { res.status(409).json({ message: 'Instalá la extensión de importación para generar promociones de muestra.' }); return; }
  try {
    const result = await createDemoPromotions(req.scope, demo.sales_channel_id);
    await resyncTypesense(req.scope);
    res.status(200).json({ ...result });
  } catch (err) {
    logger.error(`[demo-store] Promotions generation failed: ${(err as Error).message}`);
    res.status(500).json({ message: `Promotions failed: ${(err as Error).message}` });
  }
}
