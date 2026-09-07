/**
 * Admin API — descarga masiva (SOLO descarga) de rótulos de Correo Argentino.
 *
 * POST /admin/correo-argentino/labels/bulk
 * Body: { status?, date_from?, date_to?, search? }
 *
 * CRÍTICO: este endpoint **no crea envíos ni corre workflows**. Resuelve los
 * fulfillments de Correo que ya existen y matchean los filtros, y baja sus
 * rótulos. Para CREAR envíos está `POST /admin/correo-argentino/tickets/bulk`.
 *
 * Devuelve siempre un ZIP (con `summary.json` adentro, incluso si no se pudo
 * bajar ningún rótulo: es preferible a un error opaco).
 */

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import archiver from 'archiver';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import {
  listCorreoFulfillments,
  type NormalizedCorreoFulfillment,
} from '../../../../../modules/correo-argentino-fulfillment/utils/list-fulfillments';
import { downloadCorreoLabels } from '../../../../../modules/correo-argentino-fulfillment/label-download';
import { extractErrorMessage } from '../../../../../modules/correo-argentino-fulfillment/utils/errors';
import { MAX_LABELS, parseFulfillmentQuery, parseString } from '../../_input';
import { partitionCorreoLabels } from '../../_label-response';

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const body = (req.body ?? {}) as Record<string, unknown>;
  // Mismo parseo que el listado: lo que el operador vio en la tabla es
  // EXACTAMENTE lo que se selecciona acá. `ticketed_only` no se propaga a
  // propósito: abajo se separa por `tracking_number` igual, y con más detalle
  // (el summary dice CUÁLES quedaron sin rótulo, no solo cuántos).
  const parsed = parseFulfillmentQuery(body);
  const filters = {
    search: parsed.search,
    status: parsed.status,
    date_from: parsed.date_from,
    date_to: parsed.date_to,
    // El mismo eje que el listado hermano (`admin/correo-argentino/fulfillments`).
    // El comentario de arriba promete "lo que el operador vio en la tabla es
    // EXACTAMENTE lo que se selecciona acá", y sin esto la promesa era falsa en la
    // dirección peligrosa: la tabla filtra por tienda y el ZIP se bajaba los envíos
    // de todas.
    site_channel_ids: ((await siteFromRequest(req)) as { site?: { channel_ids: string[] } }).site
      ?.channel_ids,
  };

  let matched: NormalizedCorreoFulfillment[];
  try {
    matched = await listCorreoFulfillments(query, filters);
  } catch (error) {
    const message = extractErrorMessage(error);
    logger.error(`[correo-labels-bulk] Query falló: ${message}`);
    res.status(500).json({ error: { code: 'QUERY_FAILED', message } });
    return;
  }

  const totalMatched = matched.length;
  // Sin tracking_number no hay envío creado en Correo, así que no hay rótulo
  // que pedir. Se separan para que el summary diga POR QUÉ faltan, en vez de
  // que el operador cuente PDFs y no le cierre.
  const withTicket = matched.filter((f) => f.tracking_number);
  const withoutTicket = matched.filter((f) => !f.tracking_number);

  const truncated = withTicket.length > MAX_LABELS;
  const selected = withTicket.slice(0, MAX_LABELS); // ya viene ordenado desc

  if (truncated) {
    logger.warn(
      `[correo-labels-bulk] ${withTicket.length} envíos con rótulo; se truncó a ${MAX_LABELS} (los más recientes).`
    );
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="correo-labels-${timestamp}.zip"`
  );
  res.setHeader('X-Correo-Total-Matched', String(totalMatched));
  res.setHeader('X-Correo-Truncated', truncated ? 'true' : 'false');

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err: Error) => {
    logger.error(`[correo-labels-bulk] Error armando ZIP: ${err.message}`);
    try {
      res.status(500).end();
    } catch {
      /* respuesta ya enviada */
    }
  });
  archive.pipe(res);

  const downloaded: Array<{ fulfillment_id: string; tracking_number: string }> = [];
  const failed: Array<{ tracking_number: string; error: string }> = [];

  if (selected.length > 0) {
    try {
      // UNA sola llamada para todos los rótulos: `/labels` es bulk nativo. El
      // fan-out de N requests que necesita Andreani acá no existe.
      const result = await downloadCorreoLabels(logger, {
        tracking_numbers: selected.map((f) => f.tracking_number),
        label_format: parseString(body.label_format) || undefined,
      });

      const byTrackingNumber = new Map(
        selected.map((f) => [f.tracking_number, f])
      );

      // ⚠️ Fallas parciales con HTTP 200: se separan los que van al ZIP de los
      // que van al summary. Ningún ítem se pierde ni tumba el lote.
      const { entries, failed: labelFailures } = partitionCorreoLabels(
        result.labels,
        (label) => {
          const fulfillment = byTrackingNumber.get(label.trackingNumber);
          const reference =
            fulfillment?.order_display_id?.replace('#', '') ??
            fulfillment?.order_id ??
            'envio';
          return `correo-${reference}-${label.trackingNumber}.pdf`;
        }
      );

      for (const entry of entries) {
        archive.append(entry.buffer, { name: entry.file_name });
        downloaded.push({
          fulfillment_id:
            byTrackingNumber.get(entry.tracking_number)?.id ?? '',
          tracking_number: entry.tracking_number,
        });
      }
      failed.push(...labelFailures);
    } catch (error) {
      const message = extractErrorMessage(error);
      logger.error(`[correo-labels-bulk] Descarga falló: ${message}`);
      failed.push({ tracking_number: '*', error: message });
    }
  }

  archive.append(
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        filters,
        cap: MAX_LABELS,
        total_matched: totalMatched,
        truncated,
        summary: {
          selected: selected.length,
          downloaded: downloaded.length,
          failed: failed.length,
          without_ticket: withoutTicket.length,
        },
        downloaded,
        failed,
        // Estos necesitan que alguien corra la generación de tickets primero.
        without_ticket: withoutTicket.map((f) => ({
          fulfillment_id: f.id,
          order_id: f.order_id,
          order_display_id: f.order_display_id,
          status: f.status,
        })),
      },
      null,
      2
    ),
    { name: 'summary.json' }
  );

  await archive.finalize();
}
