"use strict";
/**
 * Estado final de una corrida después de aplicar (PRD §18.2).
 *
 * Vive separado del workflow y SIN imports del framework a propósito: es la
 * decisión que estaba mal y ahora tiene tests. `apply-execution.ts` no se puede
 * testear sin container, así que mientras la regla viviera ahí adentro no había
 * forma de pinnearla.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNFINISHED_PRODUCT_STATUSES = exports.RETRYABLE_PRODUCT_STATUSES = exports.PENDING_REVIEW_STATUSES = void 0;
exports.resolveApplyFinalStatus = resolveApplyFinalStatus;
/**
 * Statuses de producto que significan "todavía nadie decidió".
 *
 * `rejected` y `no_changes` NO están: son decisiones cerradas, no trabajo
 * pendiente — una corrida donde se rechazó todo está terminada.
 *
 * OJO: `maybeAdvanceExecution` (en `api/admin/catalogador/executions/[id]/
 * products/[pid]/route.ts`) mantiene hoy su propia copia de esta lista. Las dos
 * tienen que significar lo mismo; unificarlas es un follow-up.
 */
exports.PENDING_REVIEW_STATUSES = ['proposed', 'generating', 'pending'];
/**
 * Statuses cuyos `accepted_changes` el apply SÍ tiene que leer.
 *
 * `apply_failed` está incluido porque un fallo no borra las decisiones del
 * operador: el producto conserva sus `accepted_changes` y el error pudo ser
 * transitorio (una descarga, el File Module) o ya resuelto. Dejarlo afuera era
 * una vía muerta silenciosa: el producto no se reintentaba en NINGÚN apply
 * posterior, y la única salida era volver a aceptar un campo a mano para que la
 * ruta de revisión lo devolviera a `accepted`.
 */
exports.RETRYABLE_PRODUCT_STATUSES = ['accepted', 'apply_failed'];
/**
 * Trabajo que la corrida no puede dar por cerrado.
 *
 * Se mide DESPUÉS del loop de aplicación, sobre los statuses ya escritos: medirlo
 * antes contaba como pendientes a los `accepted` que el propio loop estaba por
 * convertir en `applied`. Incluye `apply_failed` porque ahora es reintentable, y
 * `accepted` porque un producto aceptado que el loop salteó (sin cambios de texto
 * ni imágenes) sigue esperando algo.
 *
 * `error` queda afuera: es una falla de GENERACIÓN, no algo que un re-apply pueda
 * resolver — reintentarlo es volver a generar, no volver a aplicar.
 */
exports.UNFINISHED_PRODUCT_STATUSES = [
    ...exports.PENDING_REVIEW_STATUSES,
    'accepted',
    'apply_failed',
];
/**
 * `applied` es TERMINAL: ni la ruta de apply ni el botón del detalle dejan volver
 * a aplicar desde ahí una vez que había productos sin revisar.
 *
 * La regla vieja era `failed === 0 ? 'applied' : …`, y un producto salteado no
 * falla: simplemente no se cuenta. Entonces aplicar con productos todavía en
 * revisión sellaba la corrida como aplicada, y todo lo que se aprobaba DESPUÉS
 * quedaba inalcanzable — el producto pasaba a `accepted` y no había forma de
 * escribirlo (reflotar no copia las propuestas, duplicar no copia las
 * decisiones). "No me quedó nada por fallar" no es lo mismo que "terminé".
 */
function resolveApplyFinalStatus({ applied, failed, unfinished, }) {
    if (failed > 0)
        return applied === 0 ? 'error' : 'partially_applied';
    return unfinished > 0 ? 'partially_applied' : 'applied';
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbHktc3RhdHVzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vc3JjL21vZHVsZXMvY2F0YWxvZ2Fkb3IvYXBwbHktc3RhdHVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7OztHQU9HOzs7QUFrRUgsMERBT0M7QUF2RUQ7Ozs7Ozs7OztHQVNHO0FBQ1UsUUFBQSx1QkFBdUIsR0FBRyxDQUFDLFVBQVUsRUFBRSxZQUFZLEVBQUUsU0FBUyxDQUFDLENBQUM7QUFFN0U7Ozs7Ozs7OztHQVNHO0FBQ1UsUUFBQSwwQkFBMEIsR0FBRyxDQUFDLFVBQVUsRUFBRSxjQUFjLENBQUMsQ0FBQztBQUV2RTs7Ozs7Ozs7Ozs7R0FXRztBQUNVLFFBQUEsMkJBQTJCLEdBQUc7SUFDekMsR0FBRywrQkFBdUI7SUFDMUIsVUFBVTtJQUNWLGNBQWM7Q0FDZixDQUFDO0FBYUY7Ozs7Ozs7Ozs7R0FVRztBQUNILFNBQWdCLHVCQUF1QixDQUFDLEVBQ3RDLE9BQU8sRUFDUCxNQUFNLEVBQ04sVUFBVSxHQUNHO0lBQ2IsSUFBSSxNQUFNLEdBQUcsQ0FBQztRQUFFLE9BQU8sT0FBTyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxtQkFBbUIsQ0FBQztJQUNyRSxPQUFPLFVBQVUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7QUFDMUQsQ0FBQyJ9