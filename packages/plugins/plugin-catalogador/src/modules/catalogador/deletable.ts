/**
 * Quién se puede sacar del listado, y por qué el resto no.
 *
 * Vive separado y SIN imports del framework, igual que `apply-status.ts`: es una
 * decisión de producto que tiene que poder pinnearse con un test, y una ruta de
 * Medusa no se puede testear sin container.
 *
 * El borrado es LÓGICO (`deleted_at`), no destructivo: la fila sale del listado y
 * se puede recuperar desde la papelera. Por eso el gate no protege datos —protege
 * PROCESOS—, y esa distinción es la que decide la lista de abajo.
 */

import type { ExecutionStatus } from './statuses';

/**
 * Estados desde los que se puede borrar.
 *
 * El criterio son dos preguntas, no una:
 *
 *  1. ¿Hay algo escrito en el catálogo que esta corrida sea la única en explicar?
 *     Si sí, no se borra: `applied` y `partially_applied` son la trazabilidad de
 *     productos que HOY están distintos, y son el origen de la restauración
 *     (`POST /:id/restore` arma el rollback con sus snapshots `pre`). Sacarlas del
 *     listado deja el catálogo cambiado sin nada que diga quién lo cambió.
 *     `ready_to_apply` todavía no escribió, pero es trabajo humano ya decidido:
 *     alguien revisó y aceptó propuesta por propuesta, y eso no se descarta con un
 *     click en una lista.
 *
 *  2. ¿Hay un proceso corriendo contra esta fila? Si sí, tampoco. `generating` y
 *     `applying` son EN VUELO: el job de `generating` sigue gastando crédito de
 *     OpenRouter y el workflow de `applying` está escribiendo productos y termina
 *     releyendo la corrida. Con la fila soft-deleted el repositorio de MikroORM la
 *     filtra, `retrieveCatalogingExecution` tira `NotFound` y el apply queda a
 *     mitad de camino: catálogo escrito, corrida sin cerrar. La salida existe y es
 *     el botón que ya está: **Cancelar** primero, borrar después.
 *
 * Lo que queda es lo que el operador quiere sacar de encima: borradores que nunca
 * arrancaron, corridas que fallaron, canceladas, revisiones a medio hacer y
 * restauradas —que son la corrida ORIGEN de un rollback ya aplicado; la que
 * escribió es la de `kind: 'restoration'`, y esa cae en `applied`—.
 */
export const DELETABLE_STATUSES: ExecutionStatus[] = [
  'draft',
  'pending_review',
  'partially_reviewed',
  'error',
  'cancelled',
  'restored',
];

/** ¿Se puede mandar a la papelera? */
export function isDeletableStatus(status: ExecutionStatus): boolean {
  return DELETABLE_STATUSES.includes(status);
}

/**
 * Por qué NO se puede, en el idioma del operador.
 *
 * Devuelve `null` cuando sí se puede. Existe para que el 409 diga la razón en vez
 * del estado crudo: "aplicada o en proceso" no distingue entre "cancelá y volvé" y
 * "esto no se borra nunca", y son dos acciones distintas del otro lado.
 */
export function deleteBlockReason(status: ExecutionStatus): string | null {
  if (isDeletableStatus(status)) return null;
  if (status === 'generating' || status === 'applying') {
    return 'La corrida está en proceso. Cancelala primero y después podés eliminarla.';
  }
  if (status === 'ready_to_apply') {
    return 'La corrida está lista para aplicar: tiene propuestas ya revisadas y aceptadas. Cancelala si no la vas a usar.';
  }
  // `applied` / `partially_applied`
  return 'La corrida modificó productos del catálogo y es la única trazabilidad de esos cambios (y el origen de una restauración). No se puede eliminar.';
}
