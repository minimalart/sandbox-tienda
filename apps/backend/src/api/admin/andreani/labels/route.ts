/**
 * Admin API — Descarga de etiqueta Andreani (PDF).
 *
 * POST /admin/andreani/labels
 * Body: { label_url?, shipment_id?, tracking_number?, file_name? }
 *
 * Devuelve el PDF binario. Útil para descargar una etiqueta puntual conocida
 * por su URL o por el shipment_id (agrupadorDeBultos).
 */

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import {
  downloadAndreaniLabel,
  parseAndreaniLabelDownloadInput,
  AndreaniLabelDownloadError,
} from '../../../../modules/andreani-fulfillment/label-download';

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const input = parseAndreaniLabelDownloadInput(req.body);

  try {
    const result = await downloadAndreaniLabel(logger, input);
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
    logger.error(`[andreani-labels] Descarga falló: ${message}`);
    res.status(500).json({ error: { code: 'LABEL_ERROR', message } });
  }
}
