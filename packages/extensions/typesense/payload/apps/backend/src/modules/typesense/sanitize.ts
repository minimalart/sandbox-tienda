/**
 * Descripción de errores para las filas de `typesense_sync_log`.
 *
 * Copia mínima de `modules/erp/sanitize.ts` a propósito: las extensiones se
 * instalan por separado, así que un proyecto con Typesense pero sin ERP no
 * puede depender de ese archivo.
 */

/**
 * Describe cualquier cosa que llegue por un `catch`.
 *
 * `String(error)` alcanza para `Error` y primitivos, pero un objeto plano queda
 * en `[object Object]` y el motivo real se pierde — y no es un caso raro: los
 * workflows del core rechazan con `{ errors: [...] }`.
 */
function describeError(error: unknown, depth = 0): string {
  if (error instanceof Error) return error.message;
  if (depth >= 3 || typeof error !== 'object' || error === null) return String(error);

  const record = error as Record<string, unknown>;
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
    return error.constructor?.name ?? String(error);
  }
}

/** Trunca un mensaje de error a un largo razonable para columnas de log. */
export function truncateError(error: unknown, max = 2000): string {
  const message = describeError(error);
  return message.length > max ? `${message.slice(0, max)}…` : message;
}
