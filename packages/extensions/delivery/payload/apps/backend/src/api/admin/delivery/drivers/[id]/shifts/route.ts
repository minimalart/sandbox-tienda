import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../../lib/multistore/scope';
import { DRIVER_SITE_SCOPE } from '../../../../../../modules/delivery/site-scope';
import { MedusaError } from '@medusajs/framework/utils';
import { DELIVERY_MODULE } from '../../../../../../modules/delivery';
import type DeliveryModuleService from '../../../../../../modules/delivery/service';
import type { AdminCreateShiftType } from '../../../validators';

// GET /admin/delivery/drivers/:id/shifts — turnos (DriverShift) del repartidor.
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // `req.params.id` es el chofer, o sea el PADRE. Guardarlo a él alcanza: sus
  // hijas no son alcanzables por otra vía.
  await assertIdInSite(req.scope, await siteFromRequest(req), DRIVER_SITE_SCOPE, req.params.id as string);

  const driverId = req.params.id as string;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  const [shifts, count] = await service.listAndCountDriverShifts(
    { driver_id: driverId },
    { order: { day_of_week: 'ASC', start_time: 'ASC' } },
  );

  res.status(200).json({ shifts, count });
}

// POST /admin/delivery/drivers/:id/shifts — crea un turno para el repartidor.
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // `req.params.id` es el chofer, o sea el PADRE. Guardarlo a él alcanza: sus
  // hijas no son alcanzables por otra vía.
  await assertIdInSite(req.scope, await siteFromRequest(req), DRIVER_SITE_SCOPE, req.params.id as string);

  const driverId = req.params.id as string;
  const body = req.validatedBody as AdminCreateShiftType;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  // El driver debe existir: FK lógica validada en aplicación.
  const driver = await service.retrieveDriver(driverId).catch(() => null);
  if (!driver) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Driver '${driverId}' no existe.`,
    );
  }

  if (body.start_time >= body.end_time) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      'La hora de inicio debe ser anterior a la de fin.',
    );
  }

  const created = await service.createDriverShifts({
    driver_id: driverId,
    day_of_week: body.day_of_week,
    start_time: body.start_time,
    end_time: body.end_time,
    active: body.active ?? true,
  });

  const shift = Array.isArray(created) ? created[0] : created;
  res.status(201).json({ shift });
}
