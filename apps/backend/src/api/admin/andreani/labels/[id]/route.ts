/**
 * Admin API — Descarga de etiqueta por shipment_id (agrupadorDeBultos).
 *
 * GET /admin/andreani/labels/:id
 *
 * `id` es el shipment_id / andreani_order_id. Resuelve la URL de la etiqueta
 * vía Andreani y devuelve el PDF.
 */

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import {
  downloadAndreaniLabel,
  AndreaniLabelDownloadError,
} from '../../../../../modules/andreani-fulfillment/label-download';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const id = req.params.id;

  if (!id) {
    res
      .status(400)
      .json({ error: { code: 'MISSING_ID', message: 'shipment id is required' } });
    return;
  }

  try {
    const result = await downloadAndreaniLabel(logger, { shipment_id: id });
    res.setHeader('Content-Type', result.content_type);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.file_name}"`
    );
    res.setHeader('Content-Length', String(result.content_length));
    res.status(200).send(result.buffer);
  } catch (error) {
    if (error instanceof AndreaniLabelDownloadError) {
      res
        .status(error.status_code)
        .json({ error: { code: error.code, message: error.message } });
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`[andreani-labels] Descarga por id ${id} falló: ${message}`);
    res.status(500).json({ error: { code: 'LABEL_ERROR', message } });
  }
}
