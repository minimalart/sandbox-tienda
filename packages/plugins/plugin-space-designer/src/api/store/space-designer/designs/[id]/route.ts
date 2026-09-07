import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { channelFilter, customerOf, missing, serviceOf, storeChannels } from '../../../../shared';
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const customer = customerOf(req);
  if (!customer) return missing();
  const [design] = await serviceOf(req).listSpaceDesigns(
    { id: req.params.id, customer_id: customer, ...channelFilter(storeChannels(req), false) },
    { take: 1 }
  );
  if (!design) return missing();
  const [current] = await serviceOf(req).listSpaceConfigurators(
    { id: design.configurator_id, status: 'published', ...channelFilter(storeChannels(req)) },
    { take: 1 }
  );
  const stale =
    !current || JSON.stringify(current.config) !== JSON.stringify(design.configuration_snapshot);
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({
    design,
    stale,
    message: stale
      ? 'El configurador cambió desde que guardaste este diseño. Conservamos su configuración original; revisá el catálogo vigente antes de comprar.'
      : null,
  });
}
