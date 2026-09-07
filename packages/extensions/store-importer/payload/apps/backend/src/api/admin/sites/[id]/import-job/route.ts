import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { DEMO_STORE_MODULE } from '../../../../../modules/demo-store';
import { ensureDemoStoreTables } from '../../../../../modules/demo-store/ensure-tables';
import { isMainStore } from '../../../../../modules/demo-store/main-store';

/**
 * Latest import-job progress for a demo, polled by the admin to render a live
 * progress bar while status is `running`.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params.id as string;
  const service: any = req.scope.resolve(DEMO_STORE_MODULE);

  await ensureDemoStoreTables(req.scope);

  // La tienda principal no importa nada (`source_type: 'native'`), así que no tiene
  // jobs y el bloque de progreso del admin no debe montarse para ella.
  const demo = await service.retrieveDemoStore(id).catch(() => null);
  if (isMainStore(demo)) {
    res.status(409).json({
      message: 'La tienda principal no importa catálogo: su catálogo ya es de esta instancia.',
    });
    return;
  }

  const [jobs] = await service.listAndCountImportJobs(
    { demo_store_id: id },
    { order: { created_at: 'DESC' }, take: 1 },
  );

  res.status(200).json({ import_job: jobs?.[0] ?? null });
}
