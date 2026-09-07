import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../../lib/multistore/scope';
import { DELIVERY_ZONE_SITE_SCOPE } from '../../../../../../../modules/delivery/site-scope';
import { DELIVERY_MODULE } from '../../../../../../../modules/delivery';
import type DeliveryModuleService from '../../../../../../../modules/delivery/service';

// DELETE /admin/delivery/zones/:id/resources/:resourceId — desafecta un recurso
// de la zona (borra la fila ZoneResource por su id).
export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // `req.params.id` es la zona, o sea el PADRE. Mismo guard que el listado de
  // `resources`: desafectar es una mutación, y dejarla abierta permite dejar sin
  // flota a la zona de otra tienda con sólo saber el id.
  await assertIdInSite(req.scope, await siteFromRequest(req), DELIVERY_ZONE_SITE_SCOPE, req.params.id as string);

  const resourceId = req.params.resourceId as string;
  const zoneId = req.params.id as string;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  /*
    El guard de arriba cubre la TIENDA; esto cubre la PERTENENCIA, y hacen falta las
    dos. El handler borraba por la PK de `zone_resource` sin volver a mirar `:id`, así
    que una zona propia en el path con un `:resourceId` ajeno pasaba el guard y
    desafectaba la flota de la zona de otra tienda — exactamente el efecto que el
    comentario de arriba dice estar evitando, y que el guard del padre solo no evita.

    La lectura se agrega —antes no había ninguna—: sin la fila no hay contra qué
    comparar. Es una consulta por id contra dejar un reparto sin vehículos asignados.

    Se compara contra el `:id` de la URL y no contra el subselect de tienda: el par
    (zona, recurso) tiene que ser coherente, no alcanza con que el recurso cuelgue de
    ALGUNA zona mía; mover flota entre dos zonas propias también es una escritura que
    el operador no pidió.

    404 y no 403 por lo mismo que el guard de tienda: el status no tiene que delatar
    que ese recurso existe en otro lado.
  */
  const resource = await service.retrieveZoneResource(resourceId).catch(() => null);
  if (resource?.delivery_zone_id !== zoneId) {
    res.status(404).json({ type: 'not_found', message: 'Recurso de zona no encontrado' });
    return;
  }

  await service.deleteZoneResources([resourceId]);

  res
    .status(200)
    .json({ id: resourceId, object: 'zone_resource', deleted: true });
}
