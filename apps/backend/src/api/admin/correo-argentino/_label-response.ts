/**
 * Adaptación del resultado POR ÍTEM de `/labels` a lo que devuelven las rutas.
 *
 * `downloadCorreoLabels()` (módulo) ya parsea la respuesta bulk y devuelve un
 * resultado por tracking number. Lo que vive acá es la decisión de RUTA: cómo se
 * expone eso al cliente y cómo se parte para armar el ZIP.
 *
 * La regla que estas funciones existen para hacer cumplir:
 *
 *   **nunca colapsar el resultado a un solo éxito/fracaso.**
 *
 * `POST /labels` devuelve las fallas parciales con **HTTP 200** y
 * `result: "ERROR: <motivo>"` por ítem. Si la ruta responde "200 OK" porque la
 * llamada HTTP no tiró, el operador se lleva un ZIP con 8 PDFs de los 10 que
 * pidió y ninguna explicación de los 2 que faltan. Al revés (500 porque uno
 * falló) le niega los 8 que sí estaban. Las dos cosas son mentiras: el estado
 * real es por ítem y así se devuelve.
 */

import {
  sanitizeLabelFileName,
  toLabelBuffer,
  type CorreoLabelResult,
} from '../../../modules/correo-argentino-fulfillment/label-download';

/** Mensaje único para "vino sin PDF y sin motivo". */
const MISSING_LABEL_MESSAGE = 'Correo no devolvió el rótulo';

/** Ítem de rótulo tal como sale por la API admin (snake_case). */
export interface CorreoLabelResponseItem {
  tracking_number: string;
  ok: boolean;
  file_name: string | null;
  base64: string | null;
  error: string | null;
}

export interface CorreoLabelResponseBody {
  labels: CorreoLabelResponseItem[];
  ok_count: number;
  error_count: number;
}

/**
 * Resultado por ítem → cuerpo JSON, conservando el estado individual.
 *
 * `ok_count`/`error_count` se recalculan acá en vez de confiar en los del
 * módulo: así el conteo SIEMPRE describe la lista que se está devolviendo, y no
 * puede quedar desfasado si el caller filtró antes de responder.
 */
export function toCorreoLabelResponse(
  labels: ReadonlyArray<CorreoLabelResult>
): CorreoLabelResponseBody {
  const items = labels.map(
    (label): CorreoLabelResponseItem => ({
      tracking_number: label.trackingNumber,
      ok: label.ok,
      file_name: label.fileName,
      // Un ítem fallido nunca lleva base64: `null` explícito para que el cliente
      // no tenga que adivinar si un string vacío es un PDF vacío.
      base64: label.ok ? label.base64 : null,
      error: label.ok ? null : (label.error ?? MISSING_LABEL_MESSAGE),
    })
  );

  const errorCount = items.filter((item) => !item.ok).length;

  return {
    labels: items,
    ok_count: items.length - errorCount,
    error_count: errorCount,
  };
}

/** Rótulo listo para meter en el ZIP. */
export interface CorreoZipEntry {
  tracking_number: string;
  file_name: string;
  buffer: Buffer;
}

export interface CorreoLabelFailure {
  tracking_number: string;
  error: string;
}

export interface PartitionedCorreoLabels {
  entries: CorreoZipEntry[];
  failed: CorreoLabelFailure[];
}

/**
 * Parte los rótulos en "van al ZIP" y "van al `summary.json`".
 *
 * `fileNameFor` la provee el caller porque el nombre útil depende del contexto
 * (el display_id de la orden en el bulk de tickets, el del fulfillment en el
 * bulk de rótulos). El `fileName` que manda Correo tiene prioridad; el fallback
 * solo entra cuando viene vacío.
 *
 * Un ítem `ok: true` sin `base64` se trata como FALLA: "OK" sin archivo no es un
 * rótulo, y meter un buffer vacío en el ZIP produce un PDF corrupto que el
 * operador descubre recién en la impresora.
 */
export function partitionCorreoLabels(
  labels: ReadonlyArray<CorreoLabelResult>,
  fileNameFor: (label: CorreoLabelResult) => string
): PartitionedCorreoLabels {
  const entries: CorreoZipEntry[] = [];
  const failed: CorreoLabelFailure[] = [];

  for (const label of labels) {
    if (!label.ok || !label.base64) {
      failed.push({
        tracking_number: label.trackingNumber,
        error: label.error ?? MISSING_LABEL_MESSAGE,
      });
      continue;
    }

    entries.push({
      tracking_number: label.trackingNumber,
      file_name: sanitizeLabelFileName(label.fileName, fileNameFor(label)),
      buffer: toLabelBuffer(label.base64),
    });
  }

  return { entries, failed };
}

export { MISSING_LABEL_MESSAGE };
