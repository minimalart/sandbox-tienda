import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { SEO_GEO_MODULE } from '../../../../../../modules/seo-geo';
import type SeoGeoModuleService from '../../../../../../modules/seo-geo/service';

import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../lib/multistore/scope';
import { SEO_AUDIT_SITE_SCOPE } from '../../../../../../modules/seo-geo/site-scope';

/**
 * POST /admin/seo-geo/audits/:id/cancel — cancela una auditoría. Si está en
 * curso, el crawl corta en el próximo lote (aborto cooperativo).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params.id as string;
  // Todos los handlers: el listado filtra, pero el id se adivina desde ahí. Antes del
  // `retrieve`, para no leer la auditoría de otra tienda ni siquiera para descartarla.
  //
  // Cancelar es el más destructivo de los tres verbos del recurso: una corrida en curso
  // pierde el crawl ya hecho y hay que relanzarla entera.
  await assertIdInSite(req.scope, await siteFromRequest(req), SEO_AUDIT_SITE_SCOPE, id);

  const service = req.scope.resolve<SeoGeoModuleService>(SEO_GEO_MODULE);
  const audit = await service.retrieveSeoAudit(id).catch(() => null);
  if (!audit) {
    res.status(404).json({ type: 'not_found', message: `Auditoría ${id} no encontrada` });
    return;
  }
  if (!['queued', 'running', 'paused'].includes(audit.status)) {
    res.status(409).json({ type: 'invalid_state', message: `No se puede cancelar una auditoría ${audit.status}` });
    return;
  }
  await service.setStatus(id, 'cancelled');
  const updated = await service.retrieveSeoAudit(id);
  res.status(200).json({ audit: updated });
}
