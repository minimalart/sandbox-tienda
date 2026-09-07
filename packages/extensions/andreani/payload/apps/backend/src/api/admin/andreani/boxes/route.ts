/**
 * Admin API — Cajas Andreani (listar / crear).
 *
 * GET  /admin/andreani/boxes
 * POST /admin/andreani/boxes  Body: { name, height, width, deep, max_capacity?, is_active? }
 */

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import { ANDREANI_DATA_MODULE } from '../../../../modules/andreani-data';
import type { AndreaniDataModuleService } from '../../../../modules/andreani-data';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const service = req.scope.resolve(
    ANDREANI_DATA_MODULE
  ) as AndreaniDataModuleService;
  const boxes = await service.listAndreaniBoxes(
    {},
    { order: { name: 'ASC' } }
  );
  res.status(200).json({ boxes });
}

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const service = req.scope.resolve(
    ANDREANI_DATA_MODULE
  ) as AndreaniDataModuleService;

  const body = (req.body ?? {}) as Record<string, unknown>;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const height = Number(body.height);
  const width = Number(body.width);
  const deep = Number(body.deep);
  const maxCapacity = Number(body.max_capacity ?? 0);
  const isActive = body.is_active === undefined ? true : Boolean(body.is_active);

  if (!name || !(height > 0) || !(width > 0) || !(deep > 0)) {
    res.status(400).json({
      error: {
        code: 'INVALID_BOX',
        message: 'name and positive height/width/deep are required',
      },
    });
    return;
  }

  try {
    const [box] = await service.createAndreaniBoxes([
      {
        name,
        height,
        width,
        deep,
        max_capacity: Number.isFinite(maxCapacity) ? maxCapacity : 0,
        is_active: isActive,
      },
    ]);
    res.status(201).json({ box });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[andreani-boxes] Creación falló: ${message}`);
    res.status(500).json({ error: { code: 'BOX_CREATE_FAILED', message } });
  }
}
