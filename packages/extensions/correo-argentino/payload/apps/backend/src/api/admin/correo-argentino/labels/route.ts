/**
 * Admin API — rótulos de Correo Argentino por tracking number.
 *
 * POST /admin/correo-argentino/labels
 * Body: { tracking_numbers: string[], label_format?: "10x15" | "label", seller_id? }
 *
 * Un solo TN → devuelve el PDF directo (`application/pdf`).
 * Varios TNs → JSON con el base64 y el estado POR ÍTEM.
 *
 * ⚠️ `POST /labels` de Correo es bulk nativo (una llamada trae los N rótulos, sin
 * el fan-out que necesita Andreani) Y devuelve las fallas parciales con
 * **HTTP 200** y `result: "ERROR: ..."` en el ítem. Por eso la respuesta es
 * siempre por ítem: colapsarla a un solo éxito/fracaso le miente al operador en
 * las dos direcciones (le esconde los 8 rótulos que sí salieron, o le esconde los
 * 2 que no).
 */

import { correoSiteFor } from '../_site-client';
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import {
  downloadCorreoLabels,
  sanitizeLabelFileName,
  toLabelBuffer,
} from '../../../../modules/correo-argentino-fulfillment/label-download';
import { extractErrorMessage } from '../../../../modules/correo-argentino-fulfillment/utils/errors';
import { MAX_LABELS, parseString, parseTrackingNumbers } from '../_input';
import { toCorreoLabelResponse, MISSING_LABEL_MESSAGE } from '../_label-response';

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const body = (req.body ?? {}) as {
    tracking_numbers?: unknown;
    label_format?: unknown;
    seller_id?: unknown;
  };

  const {
    items: trackingNumbers,
    requested,
    truncated,
  } = parseTrackingNumbers(body);

  if (trackingNumbers.length === 0) {
    res.status(400).json({
      error: {
        code: 'NO_TRACKING_NUMBERS',
        message: 'tracking_numbers es requerido',
      },
    });
    return;
  }

  if (truncated) {
    logger.warn(
      `[correo-labels] Se pidieron ${requested} rótulos; se devuelven los primeros ${MAX_LABELS}.`
    );
  }

  try {
    // La cuenta de la tienda activa. Va junto con su hermana `labels/[id]`: cambiar
    // sólo una del par dejaría al operador bajando el mismo rótulo con dos cuentas
    // distintas según por dónde entre.
    const result = await downloadCorreoLabels(logger, {
      tracking_numbers: trackingNumbers,
      label_format: parseString(body.label_format) || undefined,
      seller_id: parseString(body.seller_id) || undefined,
      site: await correoSiteFor(req, logger),
    });

    // Atajo de un solo rótulo: el admin lo abre/imprime directo, sin que el
    // cliente tenga que decodificar base64.
    if (trackingNumbers.length === 1) {
      const label = result.labels[0];
      if (!label?.ok || !label.base64) {
        res.status(404).json({
          error: {
            code: 'LABEL_NOT_AVAILABLE',
            message: label?.error ?? MISSING_LABEL_MESSAGE,
          },
        });
        return;
      }

      const fileName = sanitizeLabelFileName(
        label.fileName,
        `correo-${label.trackingNumber}.pdf`
      );
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      res.status(200).send(toLabelBuffer(label.base64));
      return;
    }

    res.status(200).json({
      ...toCorreoLabelResponse(result.labels),
      label_format: result.label_format,
      requested,
      truncated,
    });
  } catch (error) {
    const message = extractErrorMessage(error);
    logger.error(`[correo-labels] Descarga falló: ${message}`);
    res.status(503).json({ error: { code: 'SERVICE_UNAVAILABLE', message } });
  }
}
