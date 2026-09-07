/**
 * Lógica pura de las decisiones de "aceptar todo", separada del handler para
 * poder testearla sin el runtime de Medusa (misma convención que
 * `admin/routes/sites/lib.ts`).
 */
export type FieldMap = Record<string, unknown>;
/**
 * Las propuestas se guardan como `{ value, attempt, confidence, source_trace }`.
 * En `accepted_changes` va SÓLO el valor crudo (lo que se escribe al producto al
 * aplicar); guardar el objeto entero rompía el apply (p.ej. "set subtitle to
 * {object}" o "ids.map is not a function" en categorías).
 */
export declare const rawValue: (prop: unknown) => unknown;
/**
 * Confianza del campo cuando cae por debajo del umbral, `null` si no aplica.
 * Devuelve el NÚMERO y no un booleano porque la respuesta informa campo por
 * campo cuánta confianza tuvo cada propuesta diferida.
 */
export declare function lowConfidenceOf(prop: unknown, opts: {
    requireReview: boolean;
    threshold: number;
}): number | null;
export type AcceptAllPlan = {
    /** Campos a escribir en `accepted_changes` (valor crudo ya extraído). */
    accept: FieldMap;
    /** Campos a sacar de `rejected_changes`. */
    unreject: string[];
    /** Diferidos por baja confianza — lo que el toast le informa al usuario. */
    deferred: Array<{
        field: string;
        confidence: number;
    }>;
};
/**
 * Decide qué hace "aceptar todo" sobre los campos de TEXTO.
 *
 * Un campo que YA tiene decisión explícita (está en `accepted` o en `rejected`)
 * se saltea entero: no se re-decide y —lo importante— NO cuenta como diferido.
 *
 * Antes no se chequeaba, y el loop volvía a mirar la confianza de campos ya
 * decididos. El efecto: alguien aceptaba los siete campos uno por uno, apretaba
 * "aceptar todo", y recibía "7 campos quedaron pendientes por baja confianza —
 * faltan decidirlos campo por campo" con los siete ya guardados en
 * `accepted_changes`. El aviso mandaba a rehacer trabajo hecho y se leía como
 * "no se guardó nada". Verificado en producción: el producto tenía los 7 en
 * `accepted_changes`, cero campos sin decisión, y el toast decía 7 pendientes.
 */
export declare function planAcceptAll(opts: {
    proposed: FieldMap;
    accepted: FieldMap;
    rejected: FieldMap;
    requireReview: boolean;
    threshold: number;
}): AcceptAllPlan;
