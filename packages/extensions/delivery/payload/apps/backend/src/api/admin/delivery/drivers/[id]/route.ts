import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import { assertIdInSite } from '../../../../../lib/multistore/scope';
import { DRIVER_SITE_SCOPE } from '../../../../../modules/delivery/site-scope';
import { MedusaError } from '@medusajs/framework/utils';
import { DELIVERY_MODULE } from '../../../../../modules/delivery';
import type DeliveryModuleService from '../../../../../modules/delivery/service';
import type { AdminUpdateDriverType } from '../../validators';

// GET /admin/delivery/drivers/:id
export async function GET(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // El guard va en TODOS los handlers, no sólo en el GET: filtrar el listado y
  // dejar la mutación abierta esconde la fila de la otra tienda pero deja
  // editarla con sólo saber el id.
  await assertIdInSite(req.scope, await siteFromRequest(req), DRIVER_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  const driver = await service.retrieveDriver(id).catch(() => null);
  if (!driver) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      `Driver '${id}' no existe.`,
    );
  }

  res.status(200).json({ driver });
}

// POST /admin/delivery/drivers/:id — update parcial.
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // El guard va en TODOS los handlers, no sólo en el GET: filtrar el listado y
  // dejar la mutación abierta esconde la fila de la otra tienda pero deja
  // editarla con sólo saber el id.
  await assertIdInSite(req.scope, await siteFromRequest(req), DRIVER_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;
  const body = req.validatedBody as AdminUpdateDriverType;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  const update: Record<string, unknown> = { id };
  if (body.name !== undefined) update.name = body.name;
  if (body.phone !== undefined) update.phone = body.phone;
  if (body.email !== undefined) update.email = body.email;
  if (body.status !== undefined) update.status = body.status;
  if (body.store_location_id !== undefined)
    update.store_location_id = body.store_location_id;
  if (body.user_id !== undefined) update.user_id = body.user_id;
  if (body.max_active_deliveries !== undefined)
    update.max_active_deliveries = body.max_active_deliveries;
  if (body.active !== undefined) update.active = body.active;
  if (body.metadata !== undefined) update.metadata = body.metadata;

  const updated = await service.updateDrivers(update);
  const driver = Array.isArray(updated) ? updated[0] : updated;

  res.status(200).json({ driver });
}

// DELETE /admin/delivery/drivers/:id — soft delete.
export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse,
): Promise<void> {
  // El guard va en TODOS los handlers, no sólo en el GET: filtrar el listado y
  // dejar la mutación abierta esconde la fila de la otra tienda pero deja
  // editarla con sólo saber el id.
  await assertIdInSite(req.scope, await siteFromRequest(req), DRIVER_SITE_SCOPE, req.params.id as string);

  const id = req.params.id as string;
  const service = req.scope.resolve<DeliveryModuleService>(DELIVERY_MODULE);

  await service.deleteDrivers([id]);

  res.status(200).json({ id, object: 'driver', deleted: true });
}
