import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../lib/multistore/scope';
import { DELIVERY_ZONE_SITE_SCOPE } from '../../../../../../modules/delivery/site-scope';
import { MedusaError } from '@medusajs/framework/utils';
import { DELIVERY_MODULE } from '../../../../../../modules/delivery';
import type DeliveryModuleService from '../../../../../../modules/delivery/service';
import type { AdminCreateZoneResourceType } from '../../../validators';

// GET /admin/delivery/zones/:id/resources — recursos (ZoneResource) de la zona.
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // `req.params.id` es la zona, o sea el PADRE. Guardarlo a él alcanza: sus
  // hijas no son alcanzables por otra vía.
  await assertIdInSite(req.scope, await siteFromRequest(req), DELIVERY_ZONE_SITE_SCOPE, req.params.id as string);

  const zoneId = req.params.id as string;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  const [resources, count] = await service.listAndCountZoneResources(
    { delivery_zone_id: zoneId },
    { order: { created_at: 'ASC' } },
  );

  res.status(200).json({ resources, count });
}

// POST /admin/delivery/zones/:id/resources — asocia un driver o vehicle a la zona.
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // `req.params.id` es la zona, o sea el PADRE. Guardarlo a él alcanza: sus
  // hijas no son alcanzables por otra vía.
  await assertIdInSite(req.scope, await siteFromRequest(req), DELIVERY_ZONE_SITE_SCOPE, req.params.id as string);

  const zoneId = req.params.id as string;
  const body = req.validatedBody as AdminCreateZoneResourceType;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  // La zona debe existir: FK lógica validada en aplicación.
  const zone = await service.retrieveDeliveryZone(zoneId).catch(() => null);
  if (!zone) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `DeliveryZone '${zoneId}' no existe.`,
    );
  }

  // El recurso (driver/vehicle) debe existir.
  const resource =
    body.resource_type === 'driver'
      ? await service.retrieveDriver(body.resource_id).catch(() => null)
      : await service.retrieveVehicle(body.resource_id).catch(() => null);
  if (!resource) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `${body.resource_type} '${body.resource_id}' no existe.`,
    );
  }

  const created = await service.createZoneResources({
    delivery_zone_id: zoneId,
    resource_type: body.resource_type,
    resource_id: body.resource_id,
    active: body.active ?? true,
  });

  const zoneResource = Array.isArray(created) ? created[0] : created;
  res.status(201).json({ zone_resource: zoneResource });
}
