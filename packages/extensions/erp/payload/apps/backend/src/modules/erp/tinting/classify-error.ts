import {
  ErpAuthError,
  ErpConnectionError,
  ErpNonRetryableError,
  ErpTintingFormulaNotFoundError,
} from '../adapters/types';

/**
 * Reclasifica el error de una cotización tintométrica.
 *
 * El helper `request` de Zeus ya separa bien lo reintentable de lo que no
 * (401/403 → auth, ≥500/timeout → conexión, resto 4xx → no reintentable), pero
 * mete en la misma bolsa dos cosas que para el storefront son distintas:
 *
 * - "esa fórmula no existe en Zeus Gestión" (409) → es data maestra faltante, no
 *   un error del sistema: la ruta store responde 422 y la UI dice "ese color no
 *   está disponible para esta base".
 * - un parámetro mal armado (400) → es un bug nuestro: 400 + log.
 *
 * `ErpTintingFormulaNotFoundError` es SUBCLASE de `ErpNonRetryableError` a
 * propósito: cualquier `instanceof ErpNonRetryableError` que ya exista (el
 * processor del outbox, por ejemplo) sigue comportándose igual.
 *
 * Se clasifica por mensaje porque `request` ya consumió el body y lo embutió en
 * el `Error` (truncado a 300 caracteres; el JSON de error de Zeus son ~90). La
 * alternativa era cambiar la firma del helper, del que dependen otros 3 flujos.
 */
export function classifyTintingError(
  error: unknown,
  query: { base_code: string; formula_code: string }
): Error {
  // Ya vienen bien clasificados y no hay nada que agregar.
  if (error instanceof ErpAuthError || error instanceof ErpConnectionError) return error;

  const message = error instanceof Error ? error.message : String(error);

  if (/no existe/i.test(message)) {
    return new ErpTintingFormulaNotFoundError(
      `Zeus no reconoce la fórmula ${query.formula_code} para la base ${query.base_code}: ${message}`,
      query.formula_code,
      query.base_code
    );
  }

  if (error instanceof ErpNonRetryableError) return error;
  return new ErpNonRetryableError(message);
}
