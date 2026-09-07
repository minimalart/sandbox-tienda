/**
 * Normalización del código de fórmula tintométrica.
 *
 * Zeus Gestión MUESTRA el código con un espacio (`00NN 16/000`) pero la API
 * Ecommerce lo busca SIN espacios: verificado contra la cuenta real
 * (DESDE EL SUR SAS, 2026-07-29, base 113 / color COSMOS):
 *
 * - `00NN 16/000`   → 409 "La fórmula 00NN 16/000 no existe en Zeus Gestión."
 * - `00NN16/000`    → 200 `{"codigoformulaho":"00NN 16/000", ...}` (lo devuelve
 *                     CON el espacio, o sea que el espacio es de presentación)
 * - `00nn16/000`    → 200 (es case-INsensitive)
 * - ` 00NN16/000 `  → 409 (los espacios al borde tampoco perdonan)
 *
 * Por eso se guarda el código tal cual lo muestra Gestión (para mostrarlo) y se
 * normaliza SOLO al llamar a la API. No se cambia el case: la API no lo pide y
 * transformar de más esconde datos mal cargados.
 */
export function normalizeFormulaCode(code: string): string {
  return code.replace(/\s+/g, '');
}

/** `true` si el código tiene algo además de espacios. */
export function isFormulaCodePresent(code: string | null | undefined): boolean {
  return typeof code === 'string' && normalizeFormulaCode(code).length > 0;
}
