import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../../lib/multistore/scope';
import { DRIVER_SITE_SCOPE } from '../../../../../../../modules/delivery/site-scope';
import { DELIVERY_MODULE } from '../../../../../../../modules/delivery';
import type DeliveryModuleService from '../../../../../../../modules/delivery/service';

// DELETE /admin/delivery/drivers/:id/shifts/:shiftId — elimina un turno.
export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // `req.params.id` es el chofer, o sea el PADRE. Mismo guard que el listado de
  // `shifts`: si filtrás el GET y dejás el DELETE abierto, la fila de la otra
  // tienda queda escondida pero se borra con sólo saber el id.
  await assertIdInSite(req.scope, await siteFromRequest(req), DRIVER_SITE_SCOPE, req.params.id as string);

  const shiftId = req.params.shiftId as string;
  const driverId = req.params.id as string;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  /*
    El guard de arriba cubre la TIENDA; esto cubre la PERTENENCIA, y hacen falta las
    dos. El handler resolvía el turno SÓLO por su PK y no volvía a mirar `:id`, así
    que un chofer propio en el path con un `:shiftId` ajeno pasaba el guard y borraba
    el turno del chofer de otra tienda: el guard del padre quedaba decorativo, que es
    peor que no tenerlo porque la revisión lo da por cerrado.

    La lectura se agrega —antes no había ninguna— y es el costo mínimo: una consulta
    por id contra un borrado sin undo que deja un reparto sin cobertura horaria.

    Se compara contra el `:id` de la URL y no contra el subselect de tienda a
    propósito: el par (chofer, turno) tiene que ser coherente, no alcanza con que el
    turno cuelgue de ALGÚN chofer mío. Un descriptor `via_parent` para `driver_shift`
    resolvería el eje en una sola llamada y seguiría aceptando el cruce entre dos
    choferes propios.

    404 y no 403 por lo mismo que el guard de tienda: el status no tiene que delatar
    que ese turno existe en otro lado.
  */
  const shift = await service.retrieveDriverShift(shiftId).catch(() => null);
  if (shift?.driver_id !== driverId) {
    res.status(404).json({ type: 'not_found', message: 'Turno no encontrado' });
    return;
  }

  await service.deleteDriverShifts([shiftId]);

  res.status(200).json({ id: shiftId, object: 'driver_shift', deleted: true });
}
