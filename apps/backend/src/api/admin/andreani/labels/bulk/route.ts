/**
 * Admin API — Descarga masiva (download-only) de etiquetas Andreani.
 *
 * POST /admin/andreani/labels/bulk
 * Body: { status?, date_from?, date_to?, search? }
 *
 * CRÍTICO: este endpoint NO genera envíos ni corre workflows. Resuelve los
 * fulfillments Andreani EXISTENTES que matchean los filtros (misma lógica que
 * el listado), baja el PDF de cada uno que tenga etiqueta y arma un ZIP.
 *
 * - Los fulfillments sin etiqueta disponible NO hacen fallar todo: se anotan
 *   en summary.json como "sin etiqueta".
 * - Cap de seguridad: máximo MAX_LABELS por descarga. Si el filtro matchea
 *   más, se procesan los primeros MAX_LABELS (ya ordenados por fecha desc) y
 *   se deja constancia en summary.json y en el header X-Andreani-Truncated.
 *
 * Devuelve siempre un ZIP (mismo patrón que tickets/bulk: archiver +
 * Content-Disposition attachment).
 */

import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http';
import { ContainerRegistrationKeys } from '@medusajs/framework/utils';
import archiver from 'archiver';
import { siteFromRequest } from '../../../../../lib/multistore/request';
import {
  listAndreaniFulfillments,
  type NormalizedFulfillment,
} from '../../../../../modules/andreani-fulfillment/utils/list-fulfillments';
import { downloadAndreaniLabel } from '../../../../../modules/andreani-fulfillment/label-download';
import { extractErrorMessage } from '../../../../../modules/andreani-fulfillment/utils/errors';

const MAX_LABELS = 200;

interface BulkLabelsBody {
  status?: unknown;
  date_from?: unknown;
  date_to?: unknown;
  search?: unknown;
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** ¿Este fulfillment tiene de qué bajar una etiqueta? */
function hasLabelSource(f: NormalizedFulfillment): boolean {
  return Boolean(f.label_url || f.tracking_number);
}

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER);
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const body = (req.body ?? {}) as BulkLabelsBody;
  /**
   * El MISMO filtro de tienda que el listado hermano (`admin/andreani/fulfillments`).
   *
   * La cabecera de este archivo dice que resuelve "los fulfillments que matchean los
   * filtros (misma lógica que el listado)", y esa promesa estaba rota justo en la
   * mitad que importa: el listado pasa `site_channel_ids` y esto no, así que el
   * operador veía 12 envíos en su tabla y se bajaba un ZIP con los 300 de la
   * instalación —con número de tracking, id de orden y rótulo—. Es la forma más
   * cara del hueco: no hay que adivinar ningún id, se exporta solo.
   */
  const filters = {
    search: str(body.search),
    status: str(body.status),
    date_from: str(body.date_from),
    date_to: str(body.date_to),
    site_channel_ids: ((await siteFromRequest(req)) as { site?: { channel_ids: string[] } }).site
      ?.channel_ids,
  };

  let matched: NormalizedFulfillment[];
  try {
    matched = await listAndreaniFulfillments(query, filters);
  } catch (error) {
    const message = extractErrorMessage(error);
    logger.error(`[andreani-labels-bulk] Query falló: ${message}`);
    res.status(500).json({ error: { code: 'QUERY_FAILED', message } });
    return;
  }

  const totalMatched = matched.length;
  const truncated = totalMatched > MAX_LABELS;
  // Ya viene ordenado por created_at desc desde el helper.
  const selected = matched.slice(0, MAX_LABELS);

  if (truncated) {
    logger.warn(
      `[andreani-labels-bulk] Filtro matcheó ${totalMatched} etiquetas; ` +
        `se truncó a ${MAX_LABELS} (las más recientes).`
    );
  }

  // Partición: con/sin fuente de etiqueta.
  const withLabel = selected.filter(hasLabelSource);
  const withoutLabel = selected.filter((f) => !hasLabelSource(f));

  // Si NADA en el conjunto seleccionado tiene etiqueta, devolvemos un ZIP con
  // solo el summary.json (en vez de fallar): el usuario igual ve qué pasó.

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="andreani-labels-${timestamp}.zip"`
  );
  res.setHeader('X-Andreani-Total-Matched', String(totalMatched));
  res.setHeader('X-Andreani-Truncated', truncated ? 'true' : 'false');

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err: Error) => {
    logger.error(`[andreani-labels-bulk] Error armando ZIP: ${err.message}`);
    try {
      res.status(500).end();
    } catch {
      /* response ya enviado */
    }
  });
  archive.pipe(res);

  const downloaded: Array<{
    fulfillment_id: string;
    order_id: string | null;
    tracking_number: string;
  }> = [];
  const failed: Array<{
    fulfillment_id: string;
    order_id: string | null;
    tracking_number: string;
    error: string;
  }> = [];

  for (const f of withLabel) {
    try {
      const result = await downloadAndreaniLabel(logger, {
        label_url: f.label_url || undefined,
        tracking_number: f.tracking_number || undefined,
        file_name: `andreani-${
          f.order_display_id?.replace('#', '') || f.order_id || 'envio'
        }-${f.tracking_number || f.id}.pdf`,
      });
      archive.append(result.buffer, { name: result.file_name });
      downloaded.push({
        fulfillment_id: f.id,
        order_id: f.order_id,
        tracking_number: f.tracking_number,
      });
    } catch (error) {
      const message = extractErrorMessage(error);
      failed.push({
        fulfillment_id: f.id,
        order_id: f.order_id,
        tracking_number: f.tracking_number,
        error: message,
      });
      logger.warn(
        `[andreani-labels-bulk] PDF de fulfillment ${f.id} falló: ${message}`
      );
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
          processed: selected.length,
          downloaded: downloaded.length,
          failed: failed.length,
          without_label: withoutLabel.length,
        },
        downloaded,
        failed,
        without_label: withoutLabel.map((f) => ({
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
