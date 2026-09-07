/**
 * Admin API — Caja Andreani (actualizar / borrar).
 *
 * POST   /admin/andreani/boxes/:id   Body: campos a actualizar
 * DELETE /admin/andreani/boxes/:id
 */

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { ANDREANI_DATA_MODULE } from '../../../../../modules/andreani-data';
import type { AndreaniDataModuleService } from '../../../../../modules/andreani-data';

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const service = req.scope.resolve(
    ANDREANI_DATA_MODULE
  ) as AndreaniDataModuleService;
  const id = req.params.id;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const update: Record<string, unknown> = { id };
  if (typeof body.name === 'string') update.name = body.name.trim();
  if (body.height !== undefined) update.height = Number(body.height);
  if (body.width !== undefined) update.width = Number(body.width);
  if (body.deep !== undefined) update.deep = Number(body.deep);
  if (body.max_capacity !== undefined)
    update.max_capacity = Number(body.max_capacity);
  if (body.is_active !== undefined) update.is_active = Boolean(body.is_active);

  try {
    const [box] = await service.updateAndreaniBoxes([update]);
    res.status(200).json({ box });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[andreani-boxes] Update ${id} falló: ${message}`);
    res.status(500).json({ error: { code: 'BOX_UPDATE_FAILED', message } });
  }
}

export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const service = req.scope.resolve(
    ANDREANI_DATA_MODULE
  ) as AndreaniDataModuleService;
  const id = req.params.id;

  try {
    await service.deleteAndreaniBoxes([id]);
    res.status(200).json({ id, deleted: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[andreani-boxes] Delete ${id} falló: ${message}`);
    res.status(500).json({ error: { code: 'BOX_DELETE_FAILED', message } });
  }
}
