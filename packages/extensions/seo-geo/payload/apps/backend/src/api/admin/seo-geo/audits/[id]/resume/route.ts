import { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { SEO_GEO_MODULE } from '../../../../../../modules/seo-geo';
import type SeoGeoModuleService from '../../../../../../modules/seo-geo/service';

import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../lib/multistore/scope';
import { SEO_AUDIT_SITE_SCOPE } from '../../../../../../modules/seo-geo/site-scope';

/**
 * POST /admin/seo-geo/audits/:id/resume — vuelve a correr una auditoría pausada
 * (o re-corre una cancelada/fallida). Limpia los datos parciales y la re-encola;
 * el job la ejecuta de nuevo desde cero (no hay checkpoint intermedio).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params.id as string;
  // Todos los handlers: el listado filtra, pero el id se adivina desde ahí. Antes del
  // `retrieve`, para no leer la auditoría de otra tienda ni siquiera para descartarla.
  //
  // `requeueAudit` BORRA los datos parciales y la vuelve a encolar desde cero: sobre
  // una auditoría ajena no es "reanudar", es tirarle el histórico y ponerle a crawlear
  // el sitio de vuelta.
  await assertIdInSite(req.scope, await siteFromRequest(req), SEO_AUDIT_SITE_SCOPE, id);

  const service = req.scope.resolve<SeoGeoModuleService>(SEO_GEO_MODULE);
  const audit = await service.retrieveSeoAudit(id).catch(() => null);
  if (!audit) {
    res.status(404).json({ type: 'not_found', message: `Auditoría ${id} no encontrada` });
    return;
  }
  if (!['paused', 'cancelled', 'failed'].includes(audit.status)) {
    res.status(409).json({ type: 'invalid_state', message: `No se puede reanudar una auditoría ${audit.status}` });
    return;
  }
  await service.requeueAudit(id);
  const updated = await service.retrieveSeoAudit(id);
  res.status(200).json({ audit: updated });
}
