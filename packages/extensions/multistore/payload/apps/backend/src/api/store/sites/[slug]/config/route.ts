import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { DEMO_STORE_MODULE } from '../../../../../modules/demo-store';
import { ensureDemoStoreTables } from '../../../../../modules/demo-store/ensure-tables';
import { buildTenantConfig } from '../../../../../modules/demo-store/templates';

/**
 * Public storefront config for a demo, resolved by slug. The storefront's
 * getTenantBySlug() fetches this to render mercatto.studio/demo/{slug} with the
 * demo's branding, template and sales channel. Only `ready` demos are exposed.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const slug = req.params.slug as string;
  const service: any = req.scope.resolve(DEMO_STORE_MODULE);

  await ensureDemoStoreTables(req.scope);

  const [demo] = await service.listDemoStores({ slug });
  // `is_main` da 404 acá A PROPÓSITO: mientras el proxy siga mapeando
  // /demo/{slug} → esta ruta, dejar que la fila principal responda haría que
  // `/demo/principal` renderice el sitio principal en una URL de tienda. Se levanta
  // en la Fase 5, con su propio endpoint (`/store/sites/main/config`).
  if (!demo || demo.is_main || demo.status !== 'ready' || !demo.sales_channel_id) {
    res.status(404).json({ message: `Store "${slug}" not found or not ready.` });
    return;
  }

  res.status(200).json({ config: buildTenantConfig(demo) });
}
