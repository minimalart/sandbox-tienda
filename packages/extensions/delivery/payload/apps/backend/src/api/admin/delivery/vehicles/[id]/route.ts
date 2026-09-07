import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { VEHICLE_SITE_SCOPE } from '../../../../../modules/delivery/site-scope';
import { MedusaError } from '@medusajs/framework/utils';
import { DELIVERY_MODULE } from '../../../../../modules/delivery';
import type DeliveryModuleService from '../../../../../modules/delivery/service';
import type { AdminUpdateVehicleType } from '../../validators';

// GET /admin/delivery/vehicles/:id
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // El guard va en TODOS los handlers, no sólo en el GET: filtrar el listado y
  // dejar la mutación abierta esconde la fila de la otra tienda pero deja
  // editarla con sólo saber el id.
  await assertIdInSite(req.scope, await siteFromRequest(req), VEHICLE_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  const vehicle = await service.retrieveVehicle(id).catch(() => null);
  if (!vehicle) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Vehicle '${id}' no existe.`,
    );
  }

  res.status(200).json({ vehicle });
}

// POST /admin/delivery/vehicles/:id — update parcial.
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // El guard va en TODOS los handlers, no sólo en el GET: filtrar el listado y
  // dejar la mutación abierta esconde la fila de la otra tienda pero deja
  // editarla con sólo saber el id.
  await assertIdInSite(req.scope, await siteFromRequest(req), VEHICLE_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;
  const body = req.validatedBody as AdminUpdateVehicleType;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  const update: Record<string, unknown> = { id };
  if (body.plate !== undefined) update.plate = body.plate;
  if (body.type !== undefined) update.type = body.type;
  if (body.capacity_kg !== undefined) update.capacity_kg = body.capacity_kg;
  if (body.capacity_m3 !== undefined) update.capacity_m3 = body.capacity_m3;
  if (body.store_location_ids !== undefined)
    update.store_location_ids = body.store_location_ids;
  if (body.driver_id !== undefined) update.driver_id = body.driver_id;
  if (body.has_refrigeration !== undefined)
    update.has_refrigeration = body.has_refrigeration;
  if (body.max_orders !== undefined) update.max_orders = body.max_orders;
  if (body.temperature_modes !== undefined)
    update.temperature_modes = body.temperature_modes;
  if (body.active !== undefined) update.active = body.active;
  if (body.metadata !== undefined) update.metadata = body.metadata;

  const updated = await service.updateVehicles(update);
  const vehicle = Array.isArray(updated) ? updated[0] : updated;

  res.status(200).json({ vehicle });
}

// DELETE /admin/delivery/vehicles/:id — soft delete.
export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // El guard va en TODOS los handlers, no sólo en el GET: filtrar el listado y
  // dejar la mutación abierta esconde la fila de la otra tienda pero deja
  // editarla con sólo saber el id.
  await assertIdInSite(req.scope, await siteFromRequest(req), VEHICLE_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  await service.deleteVehicles([id]);

  res.status(200).json({ id, object: 'vehicle', deleted: true });
}
