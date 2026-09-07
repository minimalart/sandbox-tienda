/**
 * Descarga de rótulos de Correo Argentino.
 *
 * `POST /labels` es **bulk nativo**: una sola llamada devuelve el base64 de
 * todos los TNs pedidos, así que a diferencia de Andreani NO hay fan-out de N
 * llamadas ni necesidad de refrescar una URL de etiqueta.
 *
 * Lo que sí hay que manejar acá es la ambigüedad de la respuesta:
 *  - **Las fallas parciales llegan con HTTP 200** y `result: "ERROR: <motivo>"`
 *    por ítem. Un `try/catch` alrededor de la llamada NO alcanza.
 *  - La doc de Correo es internamente inconsistente: muestra tanto `status` como
 *    `result` para el estado del ítem, y tanto `fileName` como `filename` para
 *    el nombre. Se aceptan las dos grafías de cada uno.
 *  - Un TN pedido puede no venir en la respuesta: se devuelve igual como ítem
 *    fallido, para que el caller no lo pierda en silencio.
 *
 * Por eso el resultado es POR ÍTEM (`{ trackingNumber, base64, fileName, ok,
 * error }`): el caller decide si un ZIP parcial es aceptable o si aborta.
 */

import type { Logger } from '@medusajs/framework/types';
import { getCorreoPaqarClient } from './get-client';
import { getCorreoSettings } from './settings';
import { CORREO_LABEL_FORMATS, type CorreoLabelFormat } from './types';
import type { CorreoRawLabelItem } from './types';

type MinimalLogger = Pick<Logger, 'info' | 'warn' | 'error' | 'debug'>;

export interface CorreoLabelResult {
  trackingNumber: string;
  /** base64 del PDF, o null cuando el ítem falló. */
  base64: string | null;
  fileName: string | null;
  ok: boolean;
  /** Motivo del fallo, ya sin el prefijo `ERROR:` de la API. */
  error: string | null;
}

export interface CorreoLabelDownloadResult {
  labels: CorreoLabelResult[];
  ok_count: number;
  error_count: number;
  label_format: CorreoLabelFormat;
}

export class CorreoLabelDownloadError extends Error {
  public readonly code: string;
  public readonly status_code: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = 'CorreoLabelDownloadError';
    this.code = code;
    this.status_code = statusCode;
  }
}

export interface CorreoLabelDownloadInput {
  tracking_numbers: string[];
  /** Default `10x15`. Cualquier valor no soportado se normaliza al default. */
  label_format?: string;
  /** Override del `sellerId` de ENV (multi-seller futuro). */
  seller_id?: string;
  /**
   * Cliente y opciones YA RESUELTOS para una tienda, de
   * `getCorreoClientsForSite(container, hint, logger)`.
   *
   * Existe porque un rótulo se pide con la cuenta de MiCorreo de la tienda dueña
   * del envío, y esta función no puede resolverla sola: `getCorreoPaqarClient` es
   * síncrona y lee las options de la INSTANCIA. Sin este seam, las rutas de
   * descarga bajaban rótulos de la cuenta principal aunque el envío fuera de una
   * secundaria — con el tracking number a mano, una tienda pedía el rótulo de otra.
   *
   * Es opcional y NO cambia el default: sin esto se sigue usando la instancia, que
   * es lo correcto para el provider de fulfillment, que corre sin request. Hacerlo
   * obligatorio habría obligado a inventarle un contenedor a ese llamador.
   */
  site?: { paqar: CorreoPaqarLike; options: { sellerId: string } };
}

/** Lo único que `downloadCorreoLabels` le pide al cliente. */
export interface CorreoPaqarLike {
  getLabels(
    items: Array<{ sellerId: string; trackingNumber: string }>,
    labelFormat: CorreoLabelFormat,
  ): Promise<CorreoRawLabelItem[]>;
}

/**
 * `labelFormat` solo acepta `"10x15"` y `"label"`. Cualquier otro valor la API lo
 * ignora EN SILENCIO y cae al `consRotulo` legacy — así que se normaliza acá en
 * vez de dejar pasar basura.
 */
export function normalizeLabelFormat(value?: string): CorreoLabelFormat {
  const trimmed = value?.trim().toLowerCase();
  return CORREO_LABEL_FORMATS.find((format) => format === trimmed) ?? '10x15';
}

/**
 * Parsea la respuesta bulk de `/labels` a un resultado por ítem.
 *
 * `requested` son los TNs que se pidieron: los que no aparezcan en la respuesta
 * se devuelven como fallidos (`NO_RESPONSE`) en vez de desaparecer.
 */
export function parseCorreoLabelResponse(
  raw: unknown,
  requested: ReadonlyArray<string>
): CorreoLabelResult[] {
  const items = extractItems(raw);
  const byTrackingNumber = new Map<string, CorreoLabelResult>();
  const extras: CorreoLabelResult[] = [];

  for (const item of items) {
    const parsed = parseLabelItem(item);
    if (parsed.trackingNumber) {
      byTrackingNumber.set(parsed.trackingNumber, parsed);
    } else {
      extras.push(parsed);
    }
  }

  const results = requested.map(
    (trackingNumber) =>
      byTrackingNumber.get(trackingNumber) ?? {
        trackingNumber,
        base64: null,
        fileName: null,
        ok: false,
        error: 'NO_RESPONSE: Correo Argentino did not return a label for this tracking number',
      }
  );

  // Ítems que la API devolvió y no pedimos (o sin TN): se conservan igual, para
  // no perder información de diagnóstico.
  for (const extra of extras) {
    results.push(extra);
  }
  for (const [trackingNumber, parsed] of byTrackingNumber) {
    if (!requested.includes(trackingNumber)) {
      results.push(parsed);
    }
  }

  return results;
}

/** Convierte el base64 de un rótulo OK en Buffer. */
export function toLabelBuffer(base64: string): Buffer {
  return Buffer.from(base64, 'base64');
}

/**
 * Nombre de archivo seguro para el rótulo. Correo puede devolver `fileName` con
 * espacios/acentos, y el nombre termina en un header `Content-Disposition` y
 * dentro de un ZIP.
 */
export function sanitizeLabelFileName(
  fileName: string | null | undefined,
  fallback: string
): string {
  const raw = fileName?.trim() || fallback;
  const sanitized = raw.replace(/[^a-zA-Z0-9._-]/g, '_');
  return sanitized.toLowerCase().endsWith('.pdf') ? sanitized : `${sanitized}.pdf`;
}

/**
 * Pide los rótulos de N tracking numbers en UNA llamada y devuelve el resultado
 * por ítem. No tira cuando algunos fallan: eso es información del caller.
 */
export async function downloadCorreoLabels(
  logger: MinimalLogger,
  input: CorreoLabelDownloadInput
): Promise<CorreoLabelDownloadResult> {
  const trackingNumbers = (input.tracking_numbers ?? [])
    .map((tn) => tn?.trim())
    .filter((tn): tn is string => Boolean(tn));

  if (trackingNumbers.length === 0) {
    throw new CorreoLabelDownloadError(
      'LABEL_NOT_AVAILABLE',
      'At least one tracking number is required to download Correo Argentino labels',
      400
    );
  }

  // Con `site` resuelto se usa la cuenta de ESA tienda; sin él, la de la instancia.
  // El `sellerId` viaja junto con el cliente y no por separado a propósito: son la
  // misma cuenta de MiCorreo, y mezclar el seller de una con el token de otra da un
  // 200 con el rótulo vacío en vez de un error.
  const options = input.site?.options ?? getCorreoSettings();
  const client: CorreoPaqarLike = input.site?.paqar ?? getCorreoPaqarClient(logger);
  const sellerId = input.seller_id?.trim() || options.sellerId;
  const labelFormat = normalizeLabelFormat(input.label_format);

  let raw: CorreoRawLabelItem[];
  try {
    raw = await client.getLabels(
      trackingNumbers.map((trackingNumber) => ({ sellerId, trackingNumber })),
      labelFormat
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new CorreoLabelDownloadError(
      'LABEL_FETCH_ERROR',
      `Failed to fetch labels from Correo Argentino: ${message}`,
      502
    );
  }

  const labels = parseCorreoLabelResponse(raw, trackingNumbers);
  const failed = labels.filter((label) => !label.ok);

  if (failed.length > 0) {
    // Fallas parciales con HTTP 200: si esto no se loguea, el operador solo ve
    // un ZIP con menos PDFs de los que pidió y ninguna explicación.
    logger.error(
      `[correo-argentino] ${failed.length}/${labels.length} rótulos fallaron (HTTP 200 con result ERROR): ` +
        failed.map((l) => `${l.trackingNumber}=${l.error ?? 'unknown'}`).join(', ')
    );
  }

  return {
    labels,
    ok_count: labels.length - failed.length,
    error_count: failed.length,
    label_format: labelFormat,
  };
}

// --- internals ---

function extractItems(raw: unknown): CorreoRawLabelItem[] {
  if (Array.isArray(raw)) {
    return raw.filter(isRecord);
  }
  if (isRecord(raw) && Array.isArray(raw.labels)) {
    return raw.labels.filter(isRecord);
  }
  return [];
}

function parseLabelItem(item: CorreoRawLabelItem): CorreoLabelResult {
  const trackingNumber = str(item.trackingNumber) ?? '';
  // `result` y `status` son la misma cosa según qué página del manual se lea.
  const outcome = str(item.result) ?? str(item.status);
  // `fileName` y `filename` idem.
  const fileName = str(item.fileName) ?? str(item.filename) ?? null;
  const base64 = str(item.fileBase64) ?? null;

  // Sin campo de estado el ítem se considera neutro y decide el archivo. Un
  // "OK" sin `fileBase64` NO es un rótulo: se trata como falla.
  const outcomeOk = outcome ? /^ok$/i.test(outcome) : true;
  const ok = outcomeOk && Boolean(base64);

  return {
    trackingNumber,
    base64: ok ? base64 : null,
    fileName,
    ok,
    error: ok
      ? null
      : outcomeOk
        ? 'Correo Argentino returned no fileBase64 for this tracking number'
        : stripErrorPrefix(outcome),
  };
}

/** `"ERROR: motivo"` → `"motivo"`; el prefijo no aporta nada al mensaje. */
function stripErrorPrefix(outcome: string | undefined): string {
  if (!outcome) return 'Unknown label error';
  const withoutPrefix = outcome.replace(/^error\s*:?\s*/i, '').trim();
  return withoutPrefix.length > 0 ? withoutPrefix : outcome;
}

function isRecord(value: unknown): value is CorreoRawLabelItem {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}
