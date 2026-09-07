/**
 * Correo Argentino — piezas PURAS que consumen el adapter de delivery y el job
 * de sync de tracking.
 *
 * ⚠️ Esto NO es un normalizador de estados. El mapeo `statusId`/`status` →
 * vocabulario interno tiene UNA sola fuente de verdad y vive en
 * `modules/correo-argentino-fulfillment/normalizers/tracking-status.ts` (con sus
 * buckets, su doble derivación `status`/`code` y su log de `statusId`
 * desconocidos). Acá solo se PROYECTA ese resultado al contrato
 * `NormalizedStatusUpdate` de la abstracción DeliveryProvider y se resuelve el
 * BATCHEO, que es lo único propio de la capa delivery.
 *
 * Vive en `modules/delivery/normalizers/` y no en el módulo de fulfillment para
 * no meterle a ese módulo una dependencia hacia los tipos de `providers/`.
 */

import { normalizeCorreoTrackingItem } from '../../correo-argentino-fulfillment/normalizers/tracking-status';
import type { CorreoRawTrackingItem } from '../../correo-argentino-fulfillment/types';
import type { NormalizedStatusUpdate } from '../providers/types';

type MinimalLogger = {
  error: (message: string) => void;
};

/**
 * Cuántos tracking numbers se piden por llamada a `GET /tracking`.
 *
 * `GET /tracking` acepta un ARRAY de TNs (`?trackingNumbers=A&trackingNumbers=B`),
 * así que el sync no necesita una llamada HTTP por envío como el de Andreani.
 * El tamaño es un compromiso entre tres cosas:
 *
 *  1. **Largo de la URL.** El client manda los TNs como query param repetido
 *     (`?trackingNumbers=A&trackingNumbers=B`), aunque el manual los documenta
 *     como array en el CUERPO de un GET. ⚠️ Cuál de las dos formas acepta el
 *     gateway está SIN VERIFICAR — no hay credenciales todavía. Asumiendo la
 *     forma del client: un TN son ~30 chars ⇒ 25 TNs ≈ 800 chars, holgado
 *     incluso para un límite conservador de 2 KB. Si la forma correcta fuera el
 *     body, el techo dejaría de ser la URL y este número podría subir.
 *  2. **Radio de daño de un fallo.** La llamada es todo-o-nada: un 500 se lleva
 *     el lote entero. Con 25 el peor caso son 25 envíos sin revisar en esta
 *     corrida (se reintentan en la siguiente, el job es horario).
 *  3. **Presión de memoria.** Cada ítem trae su historial completo de eventos.
 *     25 ítems por respuesta es despreciable frente a la página de 200
 *     ejecuciones que ya materializa el job.
 *
 * Con `PAGE_SIZE = 200` esto son 8 llamadas por página en vez de 200.
 */
export const CORREO_TRACKING_BATCH_SIZE = 25;

/**
 * ¿Este valor de `data.carrier` / `data.provider` identifica a Correo Argentino?
 *
 * Compara IGNORANDO el separador (`correo-argentino`, `correo_argentino`,
 * `Correo Argentino` y `correo` son todos el mismo carrier) porque el valor lo
 * escriben lugares distintos y nada garantiza que sigan coincidiendo: hoy el
 * `CARRIER_REGISTRY` del storefront usa `correo_argentino` (snake, alineado a
 * propósito con este backend), `isCorreoShippingMethod()` del workflow acepta
 * guión bajo o el token pelado, y el provider de fulfillment estampa su propio
 * id. Normalizar acá es más barato que sincronizar tres constantes, y además
 * deja que el storefront cambie de convención sin romper la detección.
 *
 * Es una comparación EXACTA sobre el valor normalizado, no un `includes`: este
 * es el camino de la señal EXPLÍCITA y no debe aceptar coincidencias parciales
 * (el match laxo por nombre se resuelve en otro lado, con `\bcorreo\b`).
 */
export function hasCorreoCarrierToken(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return normalized === 'correo' || normalized === 'correoargentino';
}

/**
 * Deduplica, descarta vacíos y parte en lotes de `batchSize`.
 *
 * La deduplicación importa: dos ejecuciones de la misma orden pueden compartir
 * tracking number (el workflow escribe el TN en TODAS las DeliveryExecutions de
 * Correo activas de la orden), y pedir el mismo TN dos veces en el mismo lote es
 * gastar cuota al gateway sin obtener nada nuevo.
 */
export function chunkCorreoTrackingNumbers(
  trackingNumbers: ReadonlyArray<string | null | undefined>,
  batchSize: number = CORREO_TRACKING_BATCH_SIZE,
): string[][] {
  const size = Math.max(Math.trunc(batchSize) || 0, 1);
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const raw of trackingNumbers) {
    const trimmed = typeof raw === 'string' ? raw.trim() : '';
    if (!trimmed) continue;
    const key = trimmed.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(trimmed);
  }

  const batches: string[][] = [];
  for (let index = 0; index < unique.length; index += size) {
    batches.push(unique.slice(index, index + size));
  }
  return batches;
}

/**
 * Ítem crudo de `GET /tracking` → `NormalizedStatusUpdate`.
 *
 * `has_history: false` (o sea `event: []` con HTTP 200) devuelve `status: null`:
 * es la respuesta de Correo tanto para un TN inexistente como para uno recién
 * creado, y en los dos casos no hay transición que proponer.
 */
export function toCorreoStatusUpdate(
  raw: CorreoRawTrackingItem,
  logger?: MinimalLogger,
): NormalizedStatusUpdate {
  const tracking = normalizeCorreoTrackingItem(raw, logger);

  if (!tracking.has_history) {
    return { status: null };
  }

  return {
    status: tracking.status,
    ...(tracking.latest?.raw_status_id
      ? { raw_status: tracking.latest.raw_status_id }
      : {}),
    events: tracking.events.map((event) => ({
      timestamp: event.occurred_at ?? new Date().toISOString(),
      raw_status: event.raw_status_id ?? '',
      description: event.raw_status ?? undefined,
    })),
  };
}

/** Clave de indexación de un TN (case-insensitive, sin espacios). */
export function correoTrackingKey(trackingNumber: string): string {
  return trackingNumber.trim().toUpperCase();
}

export interface PollCorreoTrackingOptions {
  logger?: MinimalLogger & { warn?: (message: string) => void };
  batchSize?: number;
}

/**
 * Consulta el estado de MUCHOS envíos en lotes y devuelve un índice
 * `TN normalizado → NormalizedStatusUpdate`.
 *
 * `fetchBatch` se INYECTA (no se resuelve el client acá) por dos razones: deja
 * la función pura y testeable sin HTTP, y evita que este archivo dependa de la
 * construcción del client por ENV.
 *
 * Un lote que falla NO tumba la corrida: se loguea y se siguen los demás. Es
 * deliberado — un 500 del gateway sobre 25 TNs no debe impedir revisar los otros
 * 175 de la página.
 *
 * El match es por `trackingNumber` de la RESPUESTA, nunca por posición: según el
 * manual (SIN VERIFICAR contra la API real) un TN inexistente vuelve como
 * `{ id: null, quantity: 0, event: [] }` sin `trackingNumber`, así que la
 * respuesta no sería posicionalmente comparable con el pedido. Aparear por TN es
 * la opción segura incluso si esa forma resulta distinta: los TNs que no
 * aparecen en el índice quedan sin update, que es lo que corresponde ("no hay
 * novedad").
 */
export async function pollCorreoTrackingBatched(
  trackingNumbers: ReadonlyArray<string | null | undefined>,
  fetchBatch: (batch: string[]) => Promise<CorreoRawTrackingItem[]>,
  options: PollCorreoTrackingOptions = {},
): Promise<Map<string, NormalizedStatusUpdate>> {
  const index = new Map<string, NormalizedStatusUpdate>();
  const batches = chunkCorreoTrackingNumbers(trackingNumbers, options.batchSize);

  for (const batch of batches) {
    let items: CorreoRawTrackingItem[];
    try {
      items = await fetchBatch(batch);
    } catch (error) {
      options.logger?.warn?.(
        `[correo-sync] Lote de tracking de ${batch.length} envío(s) falló, se saltea y se reintenta en la próxima corrida: ${
          (error as Error)?.message ?? String(error)
        }`,
      );
      continue;
    }

    for (const item of items ?? []) {
      const trackingNumber =
        typeof item?.trackingNumber === 'string' ? item.trackingNumber : '';
      if (!trackingNumber.trim()) continue;
      index.set(
        correoTrackingKey(trackingNumber),
        toCorreoStatusUpdate(item, options.logger),
      );
    }
  }

  return index;
}
