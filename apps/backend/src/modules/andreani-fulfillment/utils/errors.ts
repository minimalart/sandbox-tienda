/**
 * Andreani error types (simplified — no sales channel coupling).
 */

export class AndreaniAuthError extends Error {
  public code: string;

  constructor(message: string) {
    super(message);
    this.name = 'AndreaniAuthError';
    this.code = 'ANDREANI_AUTH_FAILED';
  }
}

export class AndreaniAPIError extends Error {
  public code: string;
  public statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'AndreaniAPIError';
    this.code = 'ANDREANI_API_ERROR';
    this.statusCode = statusCode;
  }
}

export class AndreaniRateLimitError extends Error {
  public code: string;
  public retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super(message);
    this.name = 'AndreaniRateLimitError';
    this.code = 'ANDREANI_RATE_LIMIT';
    this.retryAfter = retryAfter;
  }
}

export class AndreaniValidationError extends Error {
  public code: string;
  public field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'AndreaniValidationError';
    this.code = 'ANDREANI_VALIDATION_ERROR';
    this.field = field;
  }
}

/**
 * Whether an Andreani error is worth retrying: rate limits, server-side 5xx,
 * or a network/timeout failure (an AndreaniAPIError with no statusCode, i.e.
 * no HTTP response was received). 4xx are deterministic and NOT retried.
 */
export function isTransientAndreaniError(error: unknown): boolean {
  if (error instanceof AndreaniRateLimitError) return true;
  if (error instanceof AndreaniAPIError) {
    return error.statusCode === undefined || error.statusCode >= 500;
  }
  return false;
}

/**
 * Extrae un mensaje legible de un error de origen desconocido.
 *
 * El workflow-engine redis serializa el error que lanza un step y lo rehidrata
 * como objeto plano: pierde el prototipo `Error`, así que `instanceof Error` da
 * `false` y `String(error)` devuelve `"[object Object]"`. Este helper recupera
 * el `.message` real (y desanida el `error` que envuelve el engine) en lugar de
 * tragarse la causa. En modo in-memory (local) el error llega como `Error` y
 * cae en la primera rama.
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    // El engine envuelve el error del step en `{ error, action, handlerType }`.
    if (obj.error && obj.error !== error) {
      return extractErrorMessage(obj.error);
    }
    if (typeof obj.message === 'string' && obj.message.trim().length > 0) {
      return obj.message;
    }
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
}
