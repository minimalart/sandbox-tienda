/**
 * Admin API — Generación masiva de etiquetas Andreani.
 *
 * POST /admin/andreani/tickets/bulk
 * Body: { order_ids: string[] }  (máx 50, se deduplica)
 *
 * Para cada orden: si ya tiene tickets en metadata, reutiliza el último (no
 * crea un envío nuevo); si no, corre el workflow. Devuelve:
 *   - ZIP con los PDFs + summary.json   (default)
 *   - JSON con succeeded/failed/summary (si Accept: application/json)
 */

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import archiver from 'archiver';
import { ORDER_NOT_IN_SITE, orderIdsInSite } from '../../../_order-site-scope';
import { andreaniGenerateTicketsWorkflow } from '../../../../../workflows/andreani-generate-tickets';
import { downloadAndreaniLabel } from '../../../../../modules/andreani-fulfillment/label-download';
import { extractErrorMessage } from '../../../../../modules/andreani-fulfillment/utils/errors';

const MAX_ORDERS = 50;

interface TicketEntry {
  andreani_order_id?: string;
  tracking_number?: string;
  grouped_label_url?: string;
  bultos?: Array<{ label_url?: string }>;
}

interface SucceededEntry {
  order_id: string;
  display_id: number;
  ticket: TicketEntry;
}

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const body = (req.body ?? {}) as { order_ids?: unknown };
  const rawIds = Array.isArray(body.order_ids) ? body.order_ids : [];
  const orderIds = Array.from(
    new Set(rawIds.filter((id): id is string => typeof id === 'string' && id.length > 0))
  ).slice(0, MAX_ORDERS);

  if (orderIds.length === 0) {
    res
      .status(400)
      .json({ error: { code: 'NO_ORDERS', message: 'order_ids is required' } });
    return;
  }

  const succeeded: SucceededEntry[] = [];
  const failed: Array<{ order_id: string; error: string; code: string }> = [];

  // Qué órdenes del lote son de la tienda activa. Se resuelve UNA vez para todo el
  // lote y no por ítem: son hasta 50 ids y una consulta alcanza.
  const ownOrders = await orderIdsInSite(req, orderIds);

  for (const orderId of orderIds) {
    try {
      // Antes del workflow, que es el que crea el envío facturable. Va por ítem y
      // no cortando el lote: fallar los 50 por un id ajeno le escondería al
      // operador los 49 que sí salieron, que es el criterio que este archivo ya
      // usa para todo lo demás.
      if (ownOrders !== null && !ownOrders.has(orderId)) {
        failed.push({ order_id: orderId, ...ORDER_NOT_IN_SITE });
        continue;
      }
      // ¿Ya tiene ticket? Reutilizar el último.
      const { data: orders } = await query.graph({
        entity: 'order',
        fields: ['id', 'display_id', 'metadata'],
        filters: { id: orderId },
      });
      const order = orders?.[0];
      const existing = (order?.metadata?.andreani_tickets ||
        []) as TicketEntry[];

      const lastTicket = existing[existing.length - 1];
      if (lastTicket) {
        succeeded.push({
          order_id: orderId,
          display_id: Number(order?.display_id) || 0,
          ticket: lastTicket,
        });
        continue;
      }

      const { result } = await andreaniGenerateTicketsWorkflow(req.scope).run({
        input: { order_id: orderId },
      });
      succeeded.push({
        order_id: orderId,
        display_id: result.display_id,
        ticket: result.ticket as TicketEntry,
      });
    } catch (error) {
      const message = extractErrorMessage(error);
      const code = message.split(':')[0]?.trim() || 'ANDREANI_ERROR';
      failed.push({ order_id: orderId, error: message, code });
      logger.warn(`[andreani-bulk] Orden ${orderId} falló: ${message}`);
    }
  }

  const wantsJson = (req.headers.accept || '').includes('application/json');

  if (wantsJson) {
    res.status(succeeded.length === 0 ? 400 : 200).json({
      succeeded,
      failed,
      summary: {
        total: orderIds.length,
        succeeded: succeeded.length,
        failed: failed.length,
      },
    });
    return;
  }

  if (succeeded.length === 0) {
    res.status(400).json({
      error: { code: 'ALL_FAILED', message: 'No tickets could be generated' },
      failed,
    });
    return;
  }

  // Construir ZIP.
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="andreani-tickets-bulk-${timestamp}.zip"`
  );

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err: Error) => {
    logger.error(`[andreani-bulk] Error armando ZIP: ${err.message}`);
    try {
      res.status(500).end();
    } catch {
      /* response ya enviado */
    }
  });
  archive.pipe(res);

  for (const entry of succeeded) {
    const ticket = entry.ticket;
    const labelUrl =
      ticket.grouped_label_url || ticket.bultos?.[0]?.label_url || '';
    try {
      const result = await downloadAndreaniLabel(logger, {
        label_url: labelUrl,
        shipment_id: ticket.andreani_order_id,
        tracking_number: ticket.tracking_number,
        file_name: `andreani-${entry.display_id}-${ticket.tracking_number || 'envio'}.pdf`,
      });
      archive.append(result.buffer, { name: result.file_name });
    } catch (error) {
      const message = extractErrorMessage(error);
      failed.push({
        order_id: entry.order_id,
        error: `LABEL_FETCH: ${message}`,
        code: 'LABEL_FETCH_ERROR',
      });
      logger.warn(
        `[andreani-bulk] PDF de orden ${entry.order_id} falló: ${message}`
      );
    }
  }

  archive.append(
    JSON.stringify(
      {
        generated_at: new Date().toISOString(),
        succeeded: succeeded.map((s) => ({
          order_id: s.order_id,
          display_id: s.display_id,
          tracking_number: s.ticket.tracking_number,
        })),
        failed,
        summary: {
          total: orderIds.length,
          succeeded: succeeded.length,
          failed: failed.length,
        },
      },
      null,
      2
    ),
    { name: 'summary.json' }
  );

  await archive.finalize();
}
