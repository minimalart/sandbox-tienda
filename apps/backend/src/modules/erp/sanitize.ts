/**
 * Sanitización de payloads antes de persistirlos en logs/outbox del ERP:
 * redacta valores cuyas claves suenan a secreto, trunca strings largos y
 * acota el tamaño total del blob. Los logs nunca deben guardar tokens,
 * credenciales ni datos de pago.
 */

const SENSITIVE_KEY_RE = /token|secret|password|authorization|api[_-]?key|credential|card|cvv|cvc/i;

const MAX_STRING_LENGTH = 2000;
const MAX_TOTAL_JSON_LENGTH = 16_384;
const MAX_DEPTH = 8;

export const REDACTED = '[REDACTED]';

/**
 * Devuelve una copia del valor apta para persistir en logs: claves sensibles
 * redactadas, strings truncados, ciclos cortados y tamaño total acotado
 * (si el JSON supera ~16KB se guarda `{ truncated: true, preview }`).
 */
export function sanitizePayload(value: unknown): unknown {
  const seen = new WeakSet<object>();

  const walk = (v: unknown, depth: number): unknown => {
    if (v === null || v === undefined) return v ?? null;
    if (typeof v === 'string') {
      return v.length > MAX_STRING_LENGTH ? `${v.slice(0, MAX_STRING_LENGTH)}…[truncated]` : v;
    }
    if (typeof v === 'number' || typeof v === 'boolean') return v;
    if (typeof v === 'bigint') return v.toString();
    if (v instanceof Date) return v.toISOString();
    if (typeof v !== 'object') return null; // funciones/símbolos no se persisten
    if (depth >= MAX_DEPTH) return '[depth]';
    if (seen.has(v as object)) return '[circular]';
    seen.add(v as object);
    if (Array.isArray(v)) {
      return v.map((item) => walk(item, depth + 1));
    }
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEY_RE.test(key) ? REDACTED : walk(val, depth + 1);
    }
    return out;
  };

  const result = walk(value, 0);
  try {
    const json = JSON.stringify(result);
    if (typeof json === 'string' && json.length > MAX_TOTAL_JSON_LENGTH) {
      return { truncated: true, preview: `${json.slice(0, MAX_TOTAL_JSON_LENGTH)}…` };
    }
  } catch {
    return { truncated: true, preview: '[unserializable]' };
  }
  return result;
}

/**
 * Describe cualquier cosa que llegue por un `catch`.
 *
 * `String(error)` alcanzaba para `Error` y para primitivos, pero un objeto plano
 * quedaba en `[object Object]` y el motivo real se perdía. Y eso NO es un caso
 * raro: los workflows del core rechazan con un objeto (`{errors: [...]}`), así
 * que un alta de producto fallida dejaba en el log un `[object Object]`
 * imposible de diagnosticar (visto en prod, barrido de catálogo del 2026-07-31).
 */
function describeError(error: unknown, depth = 0): string {
  if (error instanceof Error) return error.message;
  if (depth >= 3 || typeof error !== 'object' || error === null) return String(error);

  const record = error as Record<string, unknown>;
  // `errors` es la forma del workflow engine; `error` la de algunos steps.
  const nested = record.errors ?? record.error;
  if (Array.isArray(nested)) {
    const parts = nested.map((item) => describeError(item, depth + 1)).filter(Boolean);
    if (parts.length) return parts.join(' | ');
  } else if (nested !== undefined && nested !== null) {
    return describeError(nested, depth + 1);
  }
  if (typeof record.message === 'string' && record.message) return record.message;
  try {
    return JSON.stringify(error);
  } catch {
    // Referencias circulares: mejor el nombre del constructor que "[object Object]".
    return error.constructor?.name ?? String(error);
  }
}

/** Trunca un mensaje de error a un largo razonable para columnas `last_error`. */
export function truncateError(error: unknown, max = 2000): string {
  const message = describeError(error);
  return message.length > max ? `${message.slice(0, max)}…` : message;
}
