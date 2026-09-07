/**
 * Descarga de etiquetas Andreani (single-tenant).
 *
 * Versión simplificada de la de Saphirus: sin modelo andreani_fulfillment ni
 * client-manager por sales-channel. Recibe una `label_url` (y/o `shipment_id`)
 * y devuelve el PDF como Buffer usando el client por ENV. Si solo hay
 * shipment_id, resuelve la URL vía `getLabel`.
 */

import type { Logger } from '@medusajs/framework/types';
import { getAndreaniClient } from './get-client';

export interface AndreaniLabelDownloadInput {
  shipment_id?: string;
  label_url?: string;
  tracking_number?: string;
  file_name?: string;
}

export interface AndreaniLabelDownloadResult {
  buffer: Buffer;
  content_type: string;
  content_length: number;
  file_name: string;
}

export class AndreaniLabelDownloadError extends Error {
  code: string;
  status_code: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = 'AndreaniLabelDownloadError';
    this.code = code;
    this.status_code = statusCode;
  }
}

function normalize(value: string | undefined): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function extractShipmentIdFromLabelUrl(
  labelUrl: string | undefined
): string | undefined {
  if (!labelUrl) return undefined;
  const match = labelUrl.match(
    /\/v2\/ordenes-de-envio\/([^/]+)\/etiquetas\/?$/i
  );
  return match?.[1];
}

function sanitizeFileName(
  fileName: string | undefined,
  fallback: string
): string {
  const raw = normalize(fileName) ?? fallback;
  const sanitized = raw.replace(/[^a-zA-Z0-9._-]/g, '_');
  return sanitized.toLowerCase().endsWith('.pdf')
    ? sanitized
    : `${sanitized}.pdf`;
}

export function parseAndreaniLabelDownloadInput(
  body: unknown
): AndreaniLabelDownloadInput {
  const payload =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)
      : {};
  const str = (key: string): string | undefined =>
    typeof payload[key] === 'string'
      ? normalize(payload[key] as string)
      : undefined;

  const labelUrl = str('label_url') ?? str('labelUrl');
  const shipmentId =
    str('shipment_id') ??
    str('shipmentId') ??
    str('andreani_order_id') ??
    extractShipmentIdFromLabelUrl(labelUrl);

  return {
    label_url: labelUrl,
    shipment_id: shipmentId,
    tracking_number: str('tracking_number') ?? str('trackingNumber'),
    file_name: str('file_name') ?? str('fileName'),
  };
}

export async function downloadAndreaniLabel(
  logger: Logger,
  input: AndreaniLabelDownloadInput
): Promise<AndreaniLabelDownloadResult> {
  const client = getAndreaniClient(logger);

  let labelUrl = normalize(input.label_url);
  const shipmentId =
    normalize(input.shipment_id) ?? extractShipmentIdFromLabelUrl(labelUrl);

  if (!labelUrl && shipmentId) {
    labelUrl = normalize(await client.getLabel(shipmentId));
  }

  if (!labelUrl) {
    throw new AndreaniLabelDownloadError(
      'LABEL_NOT_AVAILABLE',
      'No label_url or shipment_id resolvable to a label',
      400
    );
  }

  try {
    const buffer = await client.getLabelPdf(labelUrl);
    const fileName = sanitizeFileName(
      input.file_name,
      `andreani-label-${input.tracking_number || shipmentId || 'download'}.pdf`
    );
    return {
      buffer,
      content_type: 'application/pdf',
      content_length: buffer.length,
      file_name: fileName,
    };
  } catch (error) {
    // Reintento: refrescar la URL vía getLabel si tenemos shipment_id.
    if (shipmentId) {
      try {
        const refreshed = normalize(await client.getLabel(shipmentId));
        if (refreshed) {
          const buffer = await client.getLabelPdf(refreshed);
          const fileName = sanitizeFileName(
            input.file_name,
            `andreani-label-${input.tracking_number || shipmentId}.pdf`
          );
          return {
            buffer,
            content_type: 'application/pdf',
            content_length: buffer.length,
            file_name: fileName,
          };
        }
      } catch {
        /* cae al throw de abajo */
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new AndreaniLabelDownloadError(
      'LABEL_FETCH_ERROR',
      `Failed to fetch label from Andreani: ${message}`,
      502
    );
  }
}
