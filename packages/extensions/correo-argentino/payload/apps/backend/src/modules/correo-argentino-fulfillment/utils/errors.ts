/**
 * Correo Argentino error types.
 *
 * Espeja `andreani-fulfillment/utils/errors.ts`. Las dos APIs de Correo usan el
 * MISMO shape de error (`{ timestamp, status, error, message, path }`), así que
 * el formateo y la clasificación de transitorios son compartidos por los dos
 * clientes.
 */

import axios from 'axios';
import type { CorreoApiErrorBody } from '../types';

export class CorreoAuthError extends Error {
  public code: string;

  constructor(message: string) {
    super(message);
    this.name = 'CorreoAuthError';
    this.code = 'CORREO_AUTH_FAILED';
  }
}

export class CorreoAPIError extends Error {
  public code: string;
  public statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'CorreoAPIError';
    this.code = 'CORREO_API_ERROR';
    this.statusCode = statusCode;
  }
}

export class CorreoRateLimitError extends Error {
  public code: string;
  public retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super(message);
    this.name = 'CorreoRateLimitError';
    this.code = 'CORREO_RATE_LIMIT';
    this.retryAfter = retryAfter;
  }
}

export class CorreoValidationError extends Error {
  public code: string;
  public field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'CorreoValidationError';
    this.code = 'CORREO_VALIDATION_ERROR';
    this.field = field;
  }
}

/**
 * Whether a Correo error is worth retrying: rate limits, server-side 5xx, or a
 * network/timeout failure (a CorreoAPIError with no statusCode, i.e. no HTTP
 * response was received). 4xx are deterministic and NOT retried — en particular
 * el gateway de paqar devuelve 403 para CUALQUIER path (incluso inexistentes),
 * así que reintentarlos solo quema tiempo.
 *
 * Acepta también el error REHIDRATADO por el workflow-engine redis (objeto plano
 * sin prototipo `Error`, donde `instanceof` da false): clasifica por `code` +
 * `statusCode`, que sí sobreviven la serialización. Sin esto, `withRetry` en el
 * workflow trataría todo error de un step como no reintentable.
 */
export function isTransientCorreoError(error: unknown): boolean {
  if (error instanceof CorreoRateLimitError) return true;
  if (error instanceof CorreoAPIError) {
    return error.statusCode === undefined || error.statusCode >= 500;
  }

  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    // El engine envuelve el error del step en `{ error, action, handlerType }`.
    if (obj.error && obj.error !== error) {
      return isTransientCorreoError(obj.error);
    }
    if (obj.code === 'CORREO_RATE_LIMIT') return true;
    if (obj.code === 'CORREO_API_ERROR') {
      const status = obj.statusCode;
      if (status === undefined || status === null) return true;
      return typeof status === 'number' && status >= 500;
    }
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

/**
 * Formatea el body de error de Correo (`{ timestamp, status, error, message,
 * path }`, idéntico en paqar y micorreo).
 *
 * `message` puede venir VACÍO cuando `error` ya es descriptivo (ej.
 * `{ error: "Unauthorized", message: "" }`), así que hay que mirar los dos o el
 * error queda como un pelado "status code 401". Fallback: dump JSON truncado,
 * para nunca perder la razón real de un 400 de validación.
 */
export function formatCorreoApiErrorBody(data: unknown): string | undefined {
  if (data == null) return undefined;
  if (typeof data === 'string') {
    return data.trim().length > 0 ? data.trim() : undefined;
  }
  if (typeof data !== 'object') return String(data);

  const body = data as CorreoApiErrorBody;
  const str = (v: unknown): string | undefined =>
    typeof v === 'string' && v.trim().length > 0 ? v.trim() : undefined;

  const message = str(body.message);
  const error = str(body.error);

  const parts =
    message && error && message !== error
      ? [error, message]
      : [message ?? error].filter((v): v is string => Boolean(v));

  if (parts.length > 0) {
    const path = str(body.path);
    return path ? `${parts.join(': ')} (${path})` : parts.join(': ');
  }

  try {
    return JSON.stringify(data).slice(0, 500);
  } catch {
    return undefined;
  }
}

/**
 * Normaliza cualquier error de axios (o cualquier throw) a los tipos de error
 * del módulo, preservando el status HTTP para `isTransientCorreoError`.
 * Compartido por los dos clientes.
 */
export function toCorreoApiError(error: unknown, prefix: string): Error {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    if (status === 429) {
      const retryAfter = Number(error.response?.headers['retry-after']) || 60;
      return new CorreoRateLimitError('Rate limit exceeded', retryAfter);
    }
    const apiMessage =
      formatCorreoApiErrorBody(error.response?.data) || error.message;
    return new CorreoAPIError(`${prefix}: ${apiMessage}`, status);
  }
  if (
    error instanceof CorreoAPIError ||
    error instanceof CorreoAuthError ||
    error instanceof CorreoRateLimitError ||
    error instanceof CorreoValidationError
  ) {
    return error;
  }
  return new CorreoAPIError(`${prefix}: ${extractErrorMessage(error)}`);
}
