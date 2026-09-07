"use strict";
/**
 * Lógica pura de las decisiones de "aceptar todo", separada del handler para
 * poder testearla sin el runtime de Medusa (misma convención que
 * `admin/routes/sites/lib.ts`).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.rawValue = void 0;
exports.lowConfidenceOf = lowConfidenceOf;
exports.planAcceptAll = planAcceptAll;
/**
 * Las propuestas se guardan como `{ value, attempt, confidence, source_trace }`.
 * En `accepted_changes` va SÓLO el valor crudo (lo que se escribe al producto al
 * aplicar); guardar el objeto entero rompía el apply (p.ej. "set subtitle to
 * {object}" o "ids.map is not a function" en categorías).
 */
const rawValue = (prop) => prop && typeof prop === 'object' && 'value' in prop
    ? prop.value
    : prop;
exports.rawValue = rawValue;
/**
 * Confianza del campo cuando cae por debajo del umbral, `null` si no aplica.
 * Devuelve el NÚMERO y no un booleano porque la respuesta informa campo por
 * campo cuánta confianza tuvo cada propuesta diferida.
 */
function lowConfidenceOf(prop, opts) {
    if (!opts.requireReview)
        return null;
    if (!prop || typeof prop !== 'object' || !('confidence' in prop))
        return null;
    const c = prop.confidence;
    return typeof c === 'number' && c < opts.threshold ? c : null;
}
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
function planAcceptAll(opts) {
    const plan = { accept: {}, unreject: [], deferred: [] };
    for (const [field, value] of Object.entries(opts.proposed)) {
        if (field in opts.accepted || field in opts.rejected)
            continue;
        const confidence = lowConfidenceOf(value, {
            requireReview: opts.requireReview,
            threshold: opts.threshold,
        });
        if (confidence !== null) {
            plan.deferred.push({ field, confidence });
            continue;
        }
        plan.accept[field] = (0, exports.rawValue)(value);
        plan.unreject.push(field);
    }
    return plan;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGliLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vLi4vc3JjL2FwaS9hZG1pbi9jYXRhbG9nYWRvci9leGVjdXRpb25zL1tpZF0vcHJvZHVjdHMvW3BpZF0vbGliLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7OztHQUlHOzs7QUFvQkgsMENBUUM7QUF5QkQsc0NBeUJDO0FBMUVEOzs7OztHQUtHO0FBQ0ksTUFBTSxRQUFRLEdBQUcsQ0FBQyxJQUFhLEVBQVcsRUFBRSxDQUNqRCxJQUFJLElBQUksT0FBTyxJQUFJLEtBQUssUUFBUSxJQUFJLE9BQU8sSUFBSyxJQUFnQztJQUM5RSxDQUFDLENBQUUsSUFBMkIsQ0FBQyxLQUFLO0lBQ3BDLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFIRSxRQUFBLFFBQVEsWUFHVjtBQUVYOzs7O0dBSUc7QUFDSCxTQUFnQixlQUFlLENBQzdCLElBQWEsRUFDYixJQUFtRDtJQUVuRCxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWE7UUFBRSxPQUFPLElBQUksQ0FBQztJQUNyQyxJQUFJLENBQUMsSUFBSSxJQUFJLE9BQU8sSUFBSSxLQUFLLFFBQVEsSUFBSSxDQUFDLENBQUMsWUFBWSxJQUFJLElBQUksQ0FBQztRQUFFLE9BQU8sSUFBSSxDQUFDO0lBQzlFLE1BQU0sQ0FBQyxHQUFJLElBQWdDLENBQUMsVUFBVSxDQUFDO0lBQ3ZELE9BQU8sT0FBTyxDQUFDLEtBQUssUUFBUSxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztBQUNoRSxDQUFDO0FBV0Q7Ozs7Ozs7Ozs7Ozs7R0FhRztBQUNILFNBQWdCLGFBQWEsQ0FBQyxJQU03QjtJQUNDLE1BQU0sSUFBSSxHQUFrQixFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQUUsUUFBUSxFQUFFLEVBQUUsRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFLENBQUM7SUFFdkUsS0FBSyxNQUFNLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxJQUFJLE1BQU0sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUM7UUFDM0QsSUFBSSxLQUFLLElBQUksSUFBSSxDQUFDLFFBQVEsSUFBSSxLQUFLLElBQUksSUFBSSxDQUFDLFFBQVE7WUFBRSxTQUFTO1FBRS9ELE1BQU0sVUFBVSxHQUFHLGVBQWUsQ0FBQyxLQUFLLEVBQUU7WUFDeEMsYUFBYSxFQUFFLElBQUksQ0FBQyxhQUFhO1lBQ2pDLFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUztTQUMxQixDQUFDLENBQUM7UUFDSCxJQUFJLFVBQVUsS0FBSyxJQUFJLEVBQUUsQ0FBQztZQUN4QixJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLEtBQUssRUFBRSxVQUFVLEVBQUUsQ0FBQyxDQUFDO1lBQzFDLFNBQVM7UUFDWCxDQUFDO1FBQ0QsSUFBSSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsR0FBRyxJQUFBLGdCQUFRLEVBQUMsS0FBSyxDQUFDLENBQUM7UUFDckMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDNUIsQ0FBQztJQUVELE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQyJ9