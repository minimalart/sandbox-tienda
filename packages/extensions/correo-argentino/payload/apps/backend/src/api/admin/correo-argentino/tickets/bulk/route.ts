/**
 * Admin API — generación masiva de envíos de Correo Argentino.
 *
 * POST /admin/correo-argentino/tickets/bulk
 * Body: { order_ids: string[], force?: boolean, label_format?: string }
 *                                (máx 50 órdenes, se deduplica)
 *
 * Devuelve un ZIP con los rótulos + `summary.json`, o JSON si el request pide
 * `Accept: application/json`.
 *
 * Dos diferencias con el bulk de Andreani, las dos a favor:
 *
 *  1. **No hay chequeo de idempotencia acá.** El workflow ya lo hace
 *     (`skip_creation`) y devuelve el ticket existente con `created: false`.
 *     Duplicar el guard en la ruta significaría dos implementaciones del mismo
 *     criterio, que es exactamente como se desincronizan.
 *  2. **Los rótulos se bajan en UNA sola llamada.** `POST /labels` de Correo es
 *     bulk nativo, así que no hay fan-out de N requests como en Andreani.
 *
 * El parseo del body (dedupe + cap) y el mapeo de errores viven en `_input.ts` y
 * `_status-for-error.ts`: son las dos cosas que tienen que dar EXACTAMENTE igual
 * acá y en la ruta single.
 */

import { correoSiteFor } from '../../_site-client';
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import archiver from 'archiver';
import { ORDER_NOT_IN_SITE, orderIdsInSite } from '../../../_order-site-scope';
import { correoGenerateTicketsWorkflow } from '../../../../../workflows/correo-generate-tickets';
import { downloadCorreoLabels } from '../../../../../modules/correo-argentino-fulfillment/label-download';
import { extractErrorMessage } from '../../../../../modules/correo-argentino-fulfillment/utils/errors';
import { statusForCorreoTicketError } from '../../_status-for-error';
import { MAX_ORDERS, parseOptionalBoolean, parseOrderIds } from '../../_input';
import { partitionCorreoLabels } from '../../_label-response';

interface SucceededEntry {
  order_id: string;
  display_id: number | null;
  tracking_number: string;
  created: boolean;
}

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);

  const body = (req.body ?? {}) as {
    order_ids?: unknown;
    label_format?: unknown;
    force?: unknown;
  };
  // Dedupe obligatoria: cada ID repetido sería un envío REAL y facturable de más.
  const { items: orderIds, requested, truncated } = parseOrderIds(body);
  const force = parseOptionalBoolean(body.force) === true;

  if (orderIds.length === 0) {
    res
      .status(400)
      .json({ error: { code: 'NO_ORDERS', message: 'order_ids es requerido' } });
    return;
  }

  if (truncated) {
    // Nunca truncar en silencio: el operador tiene que saber que 12 de sus 62
    // órdenes quedaron sin procesar.
    logger.warn(
      `[correo-tickets-bulk] Se pidieron ${requested} órdenes; se procesan las primeras ${MAX_ORDERS}.`
    );
  }

  const succeeded: SucceededEntry[] = [];
  const failed: Array<{ order_id: string; code: string; error: string }> = [];

  // Qué órdenes del lote son de la tienda activa. Una consulta para las 50, antes
  // del loop: el guard tiene que estar del lado de acá del `POST /orders`, que es
  // donde el envío se vuelve facturable e irreversible.
  const ownOrders = await orderIdsInSite(req, orderIds);

  // Secuencial a propósito: `POST /orders` crea envíos facturables y un fan-out
  // paralelo contra el gateway de Correo es la forma más rápida de comerse un
  // rate limit a mitad del lote, con la mitad de las órdenes ticketeadas.
  for (const orderId of orderIds) {
    try {
      // Por ítem y no cortando el lote, igual que todo lo demás en este archivo.
      if (ownOrders !== null && !ownOrders.has(orderId)) {
        failed.push({ order_id: orderId, ...ORDER_NOT_IN_SITE });
        continue;
      }

      const { result } = await correoGenerateTicketsWorkflow(req.scope).run({
        input: { order_id: orderId, ...(force ? { force: true } : {}) },
      });

      succeeded.push({
        order_id: result.order_id,
        display_id: result.display_id ?? null,
        tracking_number: result.ticket.tracking_number,
        created: result.created,
      });
    } catch (error) {
      const message = extractErrorMessage(error);
      // En el lote se guarda SOLO el `code`, no el status: la respuesta HTTP del
      // lote es 200 (se procesó) y el status por orden no significa nada; el
      // `code` sí le dice al operador si vale la pena reintentar esa orden.
      const { code } = statusForCorreoTicketError(message);
      failed.push({ order_id: orderId, code, error: message });
      logger.error(
        `[correo-tickets-bulk] Orden ${orderId} falló (${code}): ${message}`
      );
    }
  }

  const wantsJson = String(req.headers.accept ?? '').includes('application/json');
  const summary = {
    generated_at: new Date().toISOString(),
    requested,
    processed: orderIds.length,
    truncated,
    cap: MAX_ORDERS,
    force,
    succeeded_count: succeeded.length,
    failed_count: failed.length,
    succeeded,
    failed,
  };

  if (wantsJson) {
    res.status(200).json(summary);
    return;
  }

  // --- ZIP con los rótulos ---
  const trackingNumbers = succeeded
    .map((entry) => entry.tracking_number)
    .filter(Boolean);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="correo-tickets-${timestamp}.zip"`
  );
  res.setHeader('X-Correo-Succeeded', String(succeeded.length));
  res.setHeader('X-Correo-Failed', String(failed.length));
  res.setHeader('X-Correo-Truncated', truncated ? 'true' : 'false');

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err: Error) => {
    logger.error(`[correo-tickets-bulk] Error armando ZIP: ${err.message}`);
    try {
      res.status(500).end();
    } catch {
      /* respuesta ya enviada */
    }
  });
  archive.pipe(res);

  const labelErrors: Array<{ tracking_number: string; error: string }> = [];

  if (trackingNumbers.length > 0) {
    try {
      // Tercera del trío: esta ruta ya filtra las órdenes por tienda, pero bajaba
      // los rótulos con la cuenta de la instancia. Filtrar qué se descarga y pedirlo
      // con la cuenta de otro es la misma media migración con otra forma.
      const result = await downloadCorreoLabels(logger, {
        tracking_numbers: trackingNumbers,
        label_format:
          typeof body.label_format === 'string' ? body.label_format : undefined,
        site: await correoSiteFor(req, logger),
      });

      const displayByTn = new Map(
        succeeded.map((entry) => [
          entry.tracking_number,
          entry.display_id != null ? String(entry.display_id) : entry.order_id,
        ])
      );

      // ⚠️ Las fallas parciales de `/labels` vienen con HTTP 200 y
      // `result: "ERROR: ..."` por ítem. `partitionCorreoLabels` separa los que
      // van al ZIP de los que van al summary: un ítem fallido NO puede tumbar el
      // lote entero, ni desaparecer sin dejar rastro.
      const { entries, failed: labelFailures } = partitionCorreoLabels(
        result.labels,
        (label) =>
          `correo-${displayByTn.get(label.trackingNumber) ?? 'envio'}-${label.trackingNumber}.pdf`
      );

      for (const entry of entries) {
        archive.append(entry.buffer, { name: entry.file_name });
      }
      labelErrors.push(...labelFailures);
    } catch (error) {
      const message = extractErrorMessage(error);
      logger.error(`[correo-tickets-bulk] Descarga de rótulos falló: ${message}`);
      labelErrors.push({ tracking_number: '*', error: message });
    }
  }

  archive.append(
    JSON.stringify({ ...summary, label_errors: labelErrors }, null, 2),
    { name: 'summary.json' }
  );

  await archive.finalize();
}
