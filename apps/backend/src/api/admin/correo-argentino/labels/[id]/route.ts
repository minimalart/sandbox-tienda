/**
 * Admin API — descargar UN rótulo de Correo Argentino.
 *
 * GET /admin/correo-argentino/labels/:id?label_format=10x15
 *
 * `id` es el **tracking number**. A diferencia de Andreani, Correo no tiene un
 * identificador de envío separado del TN: `POST /labels` se pide con
 * `{ sellerId, trackingNumber }`, así que el TN ES el id del rótulo. Se mantiene
 * el nombre `:id` para que la forma de la URL sea la misma que la de Andreani y
 * el admin UI pueda tratar los dos carriers igual.
 *
 * Existe además del `POST /labels` porque un GET es lo único que un widget puede
 * pedir con `fetch(url, { credentials: 'include' })` + blob para abrir el PDF en
 * una pestaña. Con POST hay que armar el body a mano.
 *
 * ⚠️ Una falla acá llega como **HTTP 200 con `result: "ERROR: ..."`** desde
 * Correo. El 404 lo decidimos NOSOTROS mirando el ítem, no el status del carrier.
 */

import { correoSiteFor } from '../../_site-client';
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import {
  CorreoLabelDownloadError,
  downloadCorreoLabels,
  sanitizeLabelFileName,
  toLabelBuffer,
} from '../../../../../modules/correo-argentino-fulfillment/label-download';
import { extractErrorMessage } from '../../../../../modules/correo-argentino-fulfillment/utils/errors';
import { parseString } from '../../_input';
import { MISSING_LABEL_MESSAGE } from '../../_label-response';

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const trackingNumber = parseString(req.params.id);

  if (!trackingNumber) {
    res.status(400).json({
      error: {
        code: 'MISSING_TRACKING_NUMBER',
        message: 'El tracking number (id) es requerido',
      },
    });
    return;
  }

  try {
    // La cuenta de MiCorreo de la tienda activa, no la de la instancia: el rótulo
    // se pide con las credenciales de quien despacha. Sin esto, con el tracking
    // number a mano una tienda secundaria bajaba el rótulo de la principal.
    const result = await downloadCorreoLabels(logger, {
      tracking_numbers: [trackingNumber],
      label_format: parseString(req.query.label_format) || undefined,
      seller_id: parseString(req.query.seller_id) || undefined,
      site: await correoSiteFor(req, logger),
    });

    const label = result.labels[0];
    if (!label?.ok || !label.base64) {
      // 404 y no 502: para el operador el caso real es "todavía no hay rótulo
      // para este envío", y el motivo textual de Correo va en el mensaje.
      res.status(404).json({
        error: {
          code: 'LABEL_NOT_AVAILABLE',
          message: label?.error ?? MISSING_LABEL_MESSAGE,
        },
      });
      return;
    }

    const buffer = toLabelBuffer(label.base64);
    const fileName = sanitizeLabelFileName(
      label.fileName,
      `correo-${label.trackingNumber || trackingNumber}.pdf`
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', String(buffer.byteLength));
    res.status(200).send(buffer);
  } catch (error) {
    // `CorreoLabelDownloadError` ya trae el status correcto (400 sin TN, 502 si
    // la llamada a Correo se cayó): respetarlo en vez de colapsar todo a 500.
    if (error instanceof CorreoLabelDownloadError) {
      logger.error(
        `[correo-labels] Descarga de ${trackingNumber} falló (${error.code}): ${error.message}`
      );
      res
        .status(error.status_code)
        .json({ error: { code: error.code, message: error.message } });
      return;
    }

    const message = extractErrorMessage(error);
    logger.error(
      `[correo-labels] Descarga de ${trackingNumber} falló: ${message}`
    );
    res.status(500).json({ error: { code: 'LABEL_ERROR', message } });
  }
}
