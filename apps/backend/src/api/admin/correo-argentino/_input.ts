/**
 * Parseo y validación de la entrada de las rutas admin de Correo Argentino.
 *
 * Está separado de los `route.ts` por una razón práctica: es la lógica que MÁS
 * se rompe en silencio (un `limit` que llega como `"abc"`, 62 órdenes cuando el
 * cap son 50, IDs duplicados que ticketean dos veces la misma orden) y la que un
 * `route.ts` no deja testear sin levantar un server. Acá son funciones puras con
 * tests directos.
 *
 * Lo comparten `tickets/bulk`, `labels`, `labels/bulk` y `fulfillments`, así que
 * el cap y la dedupe son UNA implementación y no cuatro copias.
 */

/** Cap de órdenes por lote en `tickets/bulk`. */
export const MAX_ORDERS = 50;

/**
 * Cap de rótulos por request. Más alto que `MAX_ORDERS` porque bajar rótulos no
 * crea nada facturable: es una sola llamada bulk contra `/labels`.
 */
export const MAX_LABELS = 200;

export interface CappedList {
  /** Los que se procesan: deduplicados, sin vacíos y cortados al cap. */
  items: string[];
  /** Cuántos distintos pidió el cliente, ANTES de cortar. */
  requested: number;
  /** `true` = se descartaron elementos por el cap. */
  truncated: boolean;
}

/**
 * Deduplica, descarta lo que no es string no vacío y corta al cap.
 *
 * La dedupe no es cosmética: en `tickets/bulk` cada ID repetido sería un envío
 * REAL y facturable de más contra Correo. Y el truncado nunca es silencioso —
 * `requested` vs `items.length` es lo que el caller loguea y mete en el summary,
 * para que el operador sepa que 12 de sus 62 órdenes quedaron afuera.
 */
export function dedupeAndCap(value: unknown, cap: number): CappedList {
  const raw = Array.isArray(value) ? value : [];
  const unique = Array.from(
    new Set(
      raw
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0)
    )
  );

  return {
    items: unique.slice(0, cap),
    requested: unique.length,
    truncated: unique.length > cap,
  };
}

/** `order_ids` del body de `tickets/bulk`, con el cap de 50. */
export function parseOrderIds(body: unknown): CappedList {
  return dedupeAndCap(readField(body, 'order_ids'), MAX_ORDERS);
}

/** `tracking_numbers` del body de `labels`, con el cap de 200. */
export function parseTrackingNumbers(body: unknown): CappedList {
  return dedupeAndCap(readField(body, 'tracking_numbers'), MAX_LABELS);
}

/**
 * Booleano de un body/query HTTP. `"true"` y `true` son `true`; `"false"` y
 * `false` son `false`; cualquier otra cosa (incluido `undefined`) es
 * `undefined`, NO `false`.
 *
 * La distinción importa para los filtros de sucursales: `undefined` significa
 * "no filtres", y colapsarlo a `false` mandaría
 * `?pickup_availability=false` — o sea, pedir explícitamente las sucursales que
 * NO reciben retiros, el opuesto exacto de lo que quiso el caller.
 */
export function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return undefined;
}

/** String limpio de un campo de body/query; `''` cuando no es un string útil. */
export function parseString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export interface CorreoPagination {
  limit: number;
  offset: number;
}

/**
 * `limit`/`offset` del listado de fulfillments.
 *
 * `Number("abc")` es `NaN` y `NaN` se propaga a un `slice()` que devuelve
 * ARRAY VACÍO sin error: el admin vería una tabla vacía y creería que no hay
 * envíos. Por eso todo valor no finito o negativo cae al default en vez de
 * pasar.
 */
export function parsePagination(
  query: unknown,
  defaults: { limit: number; maxLimit: number } = { limit: 20, maxLimit: 100 }
): CorreoPagination {
  const rawLimit = Number(readField(query, 'limit'));
  const limit =
    Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.floor(rawLimit), defaults.maxLimit)
      : defaults.limit;

  const rawOffset = Number(readField(query, 'offset'));
  const offset =
    Number.isFinite(rawOffset) && rawOffset > 0 ? Math.floor(rawOffset) : 0;

  return { limit, offset };
}

export interface CorreoFulfillmentQuery {
  search: string;
  status: string;
  date_from: string;
  date_to: string;
  ticketed_only: boolean;
}

/**
 * Filtros del listado de fulfillments. `ticketed_only` es booleano DURO (no
 * `undefined`): en este listado "no lo mandaste" y "mandaste false" significan
 * lo mismo — mostrame todo.
 */
export function parseFulfillmentQuery(query: unknown): CorreoFulfillmentQuery {
  return {
    search: parseString(readField(query, 'search')),
    status: parseString(readField(query, 'status')),
    date_from: parseString(readField(query, 'date_from')),
    date_to: parseString(readField(query, 'date_to')),
    ticketed_only: parseOptionalBoolean(readField(query, 'ticketed_only')) === true,
  };
}

// --- internals ---

function readField(source: unknown, key: string): unknown {
  if (typeof source !== 'object' || source === null) return undefined;
  return (source as Record<string, unknown>)[key];
}
